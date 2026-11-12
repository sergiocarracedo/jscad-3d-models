import modeling from "@jscad/modeling";
import { svgPathProperties } from "svg-path-properties";
import { SVGPathData } from "svg-pathdata";
import coasterSvgRaw from "../../coaster-assets/coasters.svg?raw";

const { booleans, colors, extrusions, geometries, measurements, primitives, transforms } = modeling;
const { geom2 } = geometries;

export const id = "coasters";
export const title = "Coasters";
export const exportFileName = "coasters.stl";

// SVG dimensions from viewBox="0 0 575 575"
const svgWidth = 575;
const svgHeight = 575;
const sourceCenterX = 287.19812;
const sourceCenterY = 288.39883;
const sourceRadiusX = 262.8519;
const sourceRadiusY = 264.55136;

// Global sizing controls.
const coasterDiameterMm = 95;
const coasterThicknessMm = 4;
const engravingDepthMm = 1.1;

// Scale from SVG units to real millimeters based on requested diameter.
const sourceDiameterSvg = Math.max(sourceRadiusX * 2, sourceRadiusY * 2);
const mmPerSvgUnit = coasterDiameterMm / sourceDiameterSvg;
const safeEngravingDepth = Math.max(0.2, Math.min(engravingDepthMm, coasterThicknessMm - 0.2));
const curveSamplingStepSvg = 0.75;

const svgToModel = (x, y) => [
  (x - svgWidth / 2) * mmPerSvgUnit,
  (svgHeight / 2 - y) * mmPerSvgUnit,
];

const unionAll = (shapes) => {
  const filtered = shapes.filter(Boolean);
  if (filtered.length === 0) return null;
  if (filtered.length === 1) return filtered[0];
  return booleans.union(...filtered);
};

const subtractAll = (base, holes) => {
  const filtered = holes.filter(Boolean);
  if (!base) return null;
  if (filtered.length === 0) return base;
  return booleans.subtract(base, ...filtered);
};

const polygonSignedArea = (points) => {
  if (!points || points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return sum / 2;
};

const pointInPolygon = (point, polygon) => {
  const [px, py] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi + Number.EPSILON) + xi;

    if (intersects) inside = !inside;
  }

  return inside;
};

const dedupePoints = (points, eps = 1e-4) => {
  const out = [];
  for (const p of points) {
    const prev = out[out.length - 1];
    if (!prev || Math.abs(prev[0] - p[0]) > eps || Math.abs(prev[1] - p[1]) > eps) {
      out.push(p);
    }
  }
  if (out.length > 1) {
    const first = out[0];
    const last = out[out.length - 1];
    if (Math.abs(first[0] - last[0]) <= eps && Math.abs(first[1] - last[1]) <= eps) {
      out.pop();
    }
  }
  return out;
};

const normalizeAndSplitCompoundPath = (d) => {
  const absCommands = new SVGPathData(d).toAbs().commands;
  const subpaths = [];
  let current = [];

  const flushCurrent = () => {
    if (current.length === 0) return;
    if (current[current.length - 1].type !== SVGPathData.CLOSE_PATH) {
      current.push({ type: SVGPathData.CLOSE_PATH });
    }
    subpaths.push(current);
    current = [];
  };

  for (const cmd of absCommands) {
    if (cmd.type === SVGPathData.MOVE_TO) {
      flushCurrent();
      current.push(cmd);
      continue;
    }

    if (current.length === 0) {
      // Skip malformed sequences until a MOVE_TO starts a valid subpath.
      continue;
    }

    current.push(cmd);
    if (cmd.type === SVGPathData.CLOSE_PATH) {
      flushCurrent();
    }
  }

  flushCurrent();
  return subpaths;
};

const sampleSubpathToPoints = (commands) => {
  const subpathD = new SVGPathData(commands).encode();
  const props = new svgPathProperties(subpathD);
  const length = props.getTotalLength();
  const sampleCount = Math.max(28, Math.ceil(length / curveSamplingStepSvg));

  const points = [];
  for (let i = 0; i < sampleCount; i += 1) {
    const t = (i / sampleCount) * length;
    const { x, y } = props.getPointAtLength(t);
    points.push(svgToModel(x, y));
  }

  const clean = dedupePoints(points);
  if (clean.length < 3) return null;
  return clean;
};

const shapeFromPathData = (d) => {
  let subpaths;
  try {
    subpaths = normalizeAndSplitCompoundPath(d);
  } catch {
    return null;
  }

  const entries = [];
  for (const sub of subpaths) {
    try {
      const pts = sampleSubpathToPoints(sub);
      if (!pts) continue;
      const polygon = geom2.fromPoints(pts);
      const area = polygonSignedArea(pts);
      entries.push({ polygon, area, points: pts });
    } catch {
      // Ignore invalid sampled contours.
    }
  }

  if (entries.length === 0) return null;

  const outers = [];
  const holes = [];
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    const entryAbsArea = Math.abs(entry.area);
    if (entryAbsArea < 1e-3) continue;

    const probe = entry.points[0];
    const entrySign = entry.area >= 0 ? 1 : -1;

    let bestContainer = null;
    let bestContainerArea = Number.POSITIVE_INFINITY;

    for (let j = 0; j < entries.length; j += 1) {
      if (i === j) continue;
      const container = entries[j];
      const containerAbsArea = Math.abs(container.area);
      if (containerAbsArea <= entryAbsArea) continue;
      if (!pointInPolygon(probe, container.points)) continue;

      if (containerAbsArea < bestContainerArea) {
        bestContainer = container;
        bestContainerArea = containerAbsArea;
      }
    }

    if (!bestContainer) {
      outers.push(entry.polygon);
      continue;
    }

    const containerSign = bestContainer.area >= 0 ? 1 : -1;
    if (containerSign !== entrySign) holes.push(entry.polygon);
    else outers.push(entry.polygon);
  }

  const outerShape = unionAll(outers);
  return subtractAll(outerShape, holes);
};

const extractLayer2PathData = () => {
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(coasterSvgRaw, "image/svg+xml");
  const pathElements = Array.from(svgDoc.querySelectorAll("g#layer2 path"));
  return pathElements
    .map((pathElement) => pathElement.getAttribute("d"))
    .filter((d) => typeof d === "string" && d.length > 0);
};

const rasterRunsToRectangles = ({ runsByRow, cellSize }) => {
  const active = new Map();
  const rects = [];

  const finalizeRow = (nextActive, yRow) => {
    for (const [key, state] of active.entries()) {
      if (!nextActive.has(key)) {
        rects.push({ x1: state.x1, x2: state.x2, y1: state.yStart, y2: yRow });
      }
    }
    active.clear();
    for (const [key, state] of nextActive.entries()) active.set(key, state);
  };

  for (let y = 0; y < runsByRow.length; y += 1) {
    const rowRuns = runsByRow[y];
    const nextActive = new Map();

    for (const run of rowRuns) {
      const key = `${run.x1}:${run.x2}`;
      const prev = active.get(key);
      if (prev) nextActive.set(key, { ...prev });
      else nextActive.set(key, { x1: run.x1, x2: run.x2, yStart: y });
    }

    finalizeRow(nextActive, y);
  }

  for (const state of active.values()) {
    rects.push({
      x1: state.x1,
      x2: state.x2,
      y1: state.yStart,
      y2: runsByRow.length,
    });
  }

  return rects
    .map(({ x1, x2, y1, y2 }) => {
      const svgX1 = x1 * cellSize;
      const svgX2 = x2 * cellSize;
      const svgY1 = y1 * cellSize;
      const svgY2 = y2 * cellSize;
      const svgCenterX = (svgX1 + svgX2) / 2;
      const svgCenterY = (svgY1 + svgY2) / 2;

      const [mx, my] = svgToModel(svgCenterX, svgCenterY);
      const width = (svgX2 - svgX1) * mmPerSvgUnit;
      const height = (svgY2 - svgY1) * mmPerSvgUnit;

      if (width <= 0 || height <= 0) return null;
      return transforms.translate(
        [mx, my],
        primitives.rectangle({ size: [width, height], center: [0, 0] }),
      );
    })
    .filter(Boolean);
};

const createRasterFallbackDetail2D = (pathData) => {
  if (typeof document === "undefined" || typeof Path2D === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = svgWidth;
  canvas.height = svgHeight;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.clearRect(0, 0, svgWidth, svgHeight);
  ctx.fillStyle = "#000";

  for (const d of pathData) {
    try {
      ctx.fill(new Path2D(d), "nonzero");
    } catch {
      // Ignore malformed individual paths and continue.
    }
  }

  const pixels = ctx.getImageData(0, 0, svgWidth, svgHeight).data;
  const cellSize = 1;
  const gridW = Math.ceil(svgWidth / cellSize);
  const gridH = Math.ceil(svgHeight / cellSize);
  const runsByRow = [];

  const isFilledCell = (gx, gy) => {
    const px = Math.min(svgWidth - 1, gx * cellSize + Math.floor(cellSize / 2));
    const py = Math.min(svgHeight - 1, gy * cellSize + Math.floor(cellSize / 2));
    const idx = (py * svgWidth + px) * 4;
    return pixels[idx + 3] > 24;
  };

  for (let gy = 0; gy < gridH; gy += 1) {
    const runs = [];
    let gx = 0;
    while (gx < gridW) {
      while (gx < gridW && !isFilledCell(gx, gy)) gx += 1;
      if (gx >= gridW) break;
      const start = gx;
      while (gx < gridW && isFilledCell(gx, gy)) gx += 1;
      runs.push({ x1: start, x2: gx });
    }
    runsByRow.push(runs);
  }

  const rects2d = rasterRunsToRectangles({ runsByRow, cellSize });
  return unionAll(rects2d);
};

const createSvgDetailShapes2D = () => {
  const pathData = extractLayer2PathData();
  if (pathData.length === 0) return [];

  const shapes = [];
  for (const d of pathData) {
    const shape = shapeFromPathData(d);
    if (shape) shapes.push(shape);
  }

  return shapes;
};

const engraveWithShapes = (base, detailShapes2d) => {
  if (!detailShapes2d || detailShapes2d.length === 0) return base;

  const engravingTools = detailShapes2d.map((detail2d) => {
    const tool = extrusions.extrudeLinear({ height: safeEngravingDepth }, detail2d);
    return transforms.translate([0, 0, coasterThicknessMm - safeEngravingDepth], tool);
  });

  let engraved = base;
  for (const tool of engravingTools) engraved = booleans.subtract(engraved, tool);
  return engraved;
};

const isRenderableSolid = (solid) => {
  try {
    const [min, max] = measurements.measureBoundingBox(solid);
    const dims = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
    if (dims.some((d) => !Number.isFinite(d) || d <= 0)) return false;
    if (dims[0] > coasterDiameterMm * 4 || dims[1] > coasterDiameterMm * 4) return false;
    if (dims[0] < coasterDiameterMm * 0.25 || dims[1] < coasterDiameterMm * 0.25) return false;
    return true;
  } catch {
    return false;
  }
};

const createBaseLayer = () => {
  const [cx, cy] = svgToModel(sourceCenterX, sourceCenterY);
  const rx = sourceRadiusX * mmPerSvgUnit;
  const ry = sourceRadiusY * mmPerSvgUnit;

  const base2d = transforms.translate(
    [cx, cy],
    transforms.scale([rx, ry], primitives.circle({ radius: 1, segments: 160 })),
  );

  const base = extrusions.extrudeLinear({ height: coasterThicknessMm }, base2d);
  return colors.colorize([0.55, 0.82, 0.94, 1], base);
};

export const main = () => {
  const base = createBaseLayer();
  const pathData = extractLayer2PathData();
  if (pathData.length === 0) return [base];

  const vectorShapes = createSvgDetailShapes2D();
  const vectorEngraved = engraveWithShapes(base, vectorShapes);
  if (isRenderableSolid(vectorEngraved)) {
    return [colors.colorize([0.55, 0.82, 0.94, 1], vectorEngraved)];
  }

  const rasterDetail = createRasterFallbackDetail2D(pathData);
  if (!rasterDetail) return [base];

  const rasterEngraved = engraveWithShapes(base, [rasterDetail]);
  if (!isRenderableSolid(rasterEngraved)) return [base];

  return [colors.colorize([0.55, 0.82, 0.94, 1], rasterEngraved)];
};
