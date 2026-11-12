import modeling from "@jscad/modeling";
import { svgPathProperties } from "svg-path-properties";
import { SVGPathData } from "svg-pathdata";
import feverLogoSvg from "./assets/fever-logo-vector.svg?raw";

const {
  booleans,
  colors,
  expansions,
  extrusions,
  geometries,
  measurements,
  primitives,
  transforms,
} = modeling;
const { geom2, geom3 } = geometries;

export const id = "fever-magnet";
export const title = "Fever Refrigerator Magnet";
export const exportFileName = "fever-magnet.stl";

// Main sizing knob. The logo keeps its original aspect ratio when this changes.
const logoWidthMm = 70;
// This overlap joins the individual letter wrappers into one printable backing.
const backingBorderMm = 2.5;
const backingThicknessMm = 1.2;
const logoLayerHeightMm = 0.8;
const interfaceOverlapMm = 0.02;

const magnetDiameterMm = 5;
const magnetClearanceMm = 0.2;
const magnetHeight = 0.7;
const magnetPocketDiameterMm = magnetDiameterMm + magnetClearanceMm;
const magnetPocketDepthMm = magnetHeight + magnetClearanceMm;
const curveSamplingStepSvg = 4;
const curveSimplificationToleranceSvg = 0.25;

// Coordinates are in the SVG's coordinate system and sit under the two e
// letters.
const magnetPositions = [
  [178, 330],
  [464, 330],
];

const extractSubpaths = () => {
  const path = feverLogoSvg.match(/<path[^>]+\sd="([^"]+)"/i)?.[1];
  if (!path) throw new Error("Fever SVG did not contain a usable path");

  const subpaths = [];
  let current = [];
  for (const command of new SVGPathData(path).toAbs().commands) {
    if (command.type === SVGPathData.MOVE_TO && current.length > 0) {
      subpaths.push(current);
      current = [];
    }
    current.push(command);
    if (command.type === SVGPathData.CLOSE_PATH) {
      subpaths.push(current);
      current = [];
    }
  }
  if (current.length > 0) subpaths.push(current);
  return subpaths;
};

const pointDistanceToLine = (point, start, end) => {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  if (dx === 0 && dy === 0) return Math.hypot(point[0] - start[0], point[1] - start[1]);
  return (
    Math.abs(dy * point[0] - dx * point[1] + end[0] * start[1] - end[1] * start[0]) /
    Math.hypot(dx, dy)
  );
};

const simplifyLine = (points) => {
  if (points.length <= 2) return points;

  let furthestIndex = 0;
  let furthestDistance = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = pointDistanceToLine(points[index], points[0], points.at(-1));
    if (distance > furthestDistance) {
      furthestDistance = distance;
      furthestIndex = index;
    }
  }

  if (furthestDistance <= curveSimplificationToleranceSvg) {
    return [points[0], points.at(-1)];
  }

  return [
    ...simplifyLine(points.slice(0, furthestIndex + 1)).slice(0, -1),
    ...simplifyLine(points.slice(furthestIndex)),
  ];
};

const samplePath = (commands) => {
  const properties = new svgPathProperties(new SVGPathData(commands).encode());
  const points = [];

  for (const part of properties.getParts()) {
    if (part.length === 0) continue;
    const sampleCount = Math.max(1, Math.ceil(part.length / curveSamplingStepSvg));
    const samples = [];
    for (let index = 0; index <= sampleCount; index += 1) {
      const point = part.getPointAtLength((index / sampleCount) * part.length);
      samples.push([point.x, -point.y]);
    }
    points.push(...simplifyLine(samples).slice(points.length > 0 ? 1 : 0));
  }

  const [firstX, firstY] = points[0];
  const [lastX, lastY] = points.at(-1);
  if (Math.hypot(lastX - firstX, lastY - firstY) < curveSimplificationToleranceSvg) {
    points.pop();
  }
  return points;
};

const pathToGeom2 = (commands) => {
  const points = samplePath(commands);
  const area = points.reduce((sum, [x1, y1], index) => {
    const [x2, y2] = points[(index + 1) % points.length];
    return sum + x1 * y2 - x2 * y1;
  }, 0);

  return {
    isOuter: area < 0,
    shape: geom2.fromPoints(area < 0 ? points.reverse() : points),
    points,
  };
};

const containsPoint = (polygon, [x, y]) => {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const [x1, y1] = polygon[index];
    const [x2, y2] = polygon[previous];
    if (y1 > y !== y2 > y && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) {
      inside = !inside;
    }
  }
  return inside;
};

const createLogoContext = () => {
  const importedShapes = extractSubpaths().map(pathToGeom2);
  const outerPaths = importedShapes.filter(({ isOuter }) => isOuter);
  const holePaths = importedShapes.filter(({ isOuter }) => !isOuter);
  const letterShapes = outerPaths.map(({ shape, points }) =>
    booleans.subtract(
      shape,
      ...holePaths
        .filter((hole) => containsPoint(points, hole.points[0]))
        .map((hole) => hole.shape),
    ),
  );

  const bounds = letterShapes.map((shape) => measurements.measureBoundingBox(shape));
  const min = [
    Math.min(...bounds.map(([lower]) => lower[0])),
    Math.min(...bounds.map(([lower]) => lower[1])),
  ];
  const max = [
    Math.max(...bounds.map(([, upper]) => upper[0])),
    Math.max(...bounds.map(([, upper]) => upper[1])),
  ];
  const sourceWidth = max[0] - min[0];
  const scale = logoWidthMm / sourceWidth;
  const sourceCenter = [(min[0] + max[0]) / 2, -(min[1] + max[1]) / 2];

  return {
    logo2d: letterShapes.map((shape) =>
      transforms.translate(
        [-sourceCenter[0] * scale, sourceCenter[1] * scale, 0],
        transforms.scale([scale, scale, 1], shape),
      ),
    ),
    backing2d: outerPaths.map(({ shape }) =>
      transforms.translate(
        [-sourceCenter[0] * scale, sourceCenter[1] * scale, 0],
        transforms.scale([scale, scale, 1], shape),
      ),
    ),
    center: sourceCenter,
    scale,
  };
};

const createMagnetPocket = ([sourceX, sourceY], { center, scale }) => {
  const x = (sourceX - center[0]) * scale;
  const y = (center[1] - sourceY) * scale;

  return {
    center: [x, y],
    shape: primitives.circle({
      center: [x, y],
      radius: magnetPocketDiameterMm / 2,
      segments: 32,
    }),
  };
};

export const main = () => {
  const logoContext = createLogoContext();
  const pockets = magnetPositions.map((position) => createMagnetPocket(position, logoContext));
  const backingShapes = logoContext.backing2d.map((letter) =>
    expansions.expand({ delta: backingBorderMm, corners: "round", segments: 4 }, letter),
  );
  // Keep each wrapper as a simple solid. Their enlarged outlines overlap, so
  // slicers fuse them into one body without fragile boolean operations on the
  // imported SVG's dense curves.
  const backing = backingShapes.map((shape, index) => {
    const pocketedShape = booleans.subtract(shape, ...pockets.map(({ shape: pocket }) => pocket));
    const wall = colors.colorize(
      [0.03, 0.03, 0.03, 1],
      extrusions.extrudeLinear({ height: magnetPocketDepthMm }, pocketedShape),
    );
    wall.name = `Black backing wall ${index + 1}`;

    const translatedFloor = transforms.translate(
      [0, 0, magnetPocketDepthMm],
      extrusions.extrudeLinear({ height: backingThicknessMm - magnetPocketDepthMm }, shape),
    );
    const floor = colors.colorize(
      [0.03, 0.03, 0.03, 1],
      geom3.create(geom3.toPolygons(translatedFloor)),
    );
    floor.name = `Black backing floor ${index + 1}`;
    return [wall, floor];
  });

  const letters = logoContext.logo2d.map((letter, index) => {
    const solid = colors.colorize(
      [1, 1, 1, 1],
      transforms.translate(
        [0, 0, backingThicknessMm - interfaceOverlapMm],
        extrusions.extrudeLinear({ height: logoLayerHeightMm + interfaceOverlapMm }, letter),
      ),
    );
    solid.name = `White letter ${index + 1}`;
    return solid;
  });

  return [...backing.flat(), ...letters];
};
