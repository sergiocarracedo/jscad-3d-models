import modeling from "@jscad/modeling";
import { selectiveRoundedRectanglePoints } from "./rounded-corners.js";
const { booleans, colors, extrusions, primitives, transforms } = modeling;

const ribCurveDirectionByPosition = {
  "bottom-left": { x: -1, z: -1 },
  "bottom-right": { x: 1, z: -1 },
  "top-left": { x: -1, z: 1 },
  "top-right": { x: 1, z: 1 },
};

const resolveRibDimensions = ({ size, sizeX, sizeZ }) => {
  const resolvedSizeX = sizeX ?? size;
  const resolvedSizeZ = sizeZ ?? size;

  if (!resolvedSizeX || resolvedSizeX <= 0) {
    throw new Error("Rib sizeX must be > 0");
  }
  if (!resolvedSizeZ || resolvedSizeZ <= 0) {
    throw new Error("Rib sizeZ must be > 0");
  }

  return {
    sizeX: resolvedSizeX,
    sizeZ: resolvedSizeZ,
  };
};

const polygonSignedArea = (points) => {
  let area = 0;

  for (let index = 0; index < points.length; index += 1) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[(index + 1) % points.length];
    area += x1 * y2 - x2 * y1;
  }

  return area / 2;
};

const clipPolygonAtX = (points, x, keepGreater) => {
  const clipped = [];
  const isInside = ([pointX]) => (keepGreater ? pointX >= x : pointX <= x);

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const previous = points[(index + points.length - 1) % points.length];
    const currentInside = isInside(current);
    const previousInside = isInside(previous);

    if (currentInside !== previousInside) {
      const ratio = (x - previous[0]) / (current[0] - previous[0]);
      clipped.push([x, previous[1] + ratio * (current[1] - previous[1])]);
    }
    if (currentInside) clipped.push(current);
  }

  return clipped;
};

const ribProfilePoints = ({
  start,
  sizeX,
  sizeZ,
  curvePosition,
  profile = "curved",
  segments = 16,
}) => {
  const direction = ribCurveDirectionByPosition[curvePosition];
  if (!direction) {
    throw new Error(`Invalid curvePosition: ${curvePosition}`);
  }

  const [startX, , startZ] = start;
  const centerX = startX + direction.x * sizeX;
  const centerZ = startZ + direction.z * sizeZ;

  const points = [
    [startX, startZ],
    [startX, centerZ],
  ];

  if (profile === "flat") {
    points.push([centerX, startZ]);

    if (polygonSignedArea(points) < 0) {
      points.reverse();
    }

    return points;
  }

  if (profile !== "curved") {
    throw new Error(`Invalid rib profile: ${profile}`);
  }

  for (let index = 0; index <= segments; index += 1) {
    const ratio = index / segments;
    const angle = (Math.PI / 2) * ratio;
    const arcX = centerX - direction.x * sizeX * Math.cos(angle);
    const arcZ = centerZ - direction.z * sizeZ * Math.sin(angle);

    points.push([arcX, arcZ]);
  }

  // Keep polygon winding consistent so all curve positions extrude as positive solids.
  if (polygonSignedArea(points) < 0) {
    points.reverse();
  }

  return points;
};

export const startRoundedSlab = (params) => {
  const { start, size, roundedCorners = "all", borderRadius = 4 } = params;
  const [width, depth, height] = size;
  const roundRadius = Math.min(borderRadius, width / 2, depth / 2);
  const profile = primitives.polygon({
    points: selectiveRoundedRectanglePoints({
      width,
      depth,
      radius: roundRadius,
      roundedCorners,
    }),
  });
  const slab = extrusions.extrudeLinear({ height }, profile);

  return transforms.translate(start, slab);
};

export const startCuboid = (params) => {
  const { start, size } = params;
  // Calculamos el centro basado en el inicio y el tamaño
  const center = [start[0] + size[0] / 2, start[1] + size[1] / 2, start[2] + size[2] / 2];
  return primitives.cuboid({ ...params, size, center });
};

export const createWedge = ({
  width,
  height,
  depth,
  plane = "xy",
  widthDirection = "positive",
  slopePosition = "top",
  start = [0, 0, 0],
}) => {
  if (width <= 0) throw new Error("width must be > 0");
  if (height <= 0) throw new Error("height must be > 0");
  if (depth <= 0) throw new Error("depth must be > 0");
  if (!["xy", "xz", "yz"].includes(plane)) {
    throw new Error('plane must be "xy", "xz", or "yz"');
  }
  if (!["positive", "negative"].includes(widthDirection)) {
    throw new Error('widthDirection must be "positive" or "negative"');
  }
  if (!["top", "bottom"].includes(slopePosition)) {
    throw new Error('slopePosition must be "top" or "bottom"');
  }
  if (
    !Array.isArray(start) ||
    start.length !== 3 ||
    start.some((value) => !Number.isFinite(value))
  ) {
    throw new Error("start must be a 3D position");
  }

  const coordinateMap = {
    xy: ([run, rise, extrusion]) => [run, rise, extrusion],
    xz: ([run, rise, extrusion]) => [run, extrusion, rise],
    yz: ([run, rise, extrusion]) => [extrusion, run, rise],
  }[plane];

  const run = widthDirection === "positive" ? width : -width;
  const farTop = slopePosition === "bottom";
  // The profile always starts at the lower vertex of its vertical h-side.
  const points = [
    [0, 0, 0],
    farTop ? [0, height, 0] : [run, 0, 0],
    farTop ? [run, height, 0] : [0, height, 0],
    [0, 0, depth],
    farTop ? [0, height, depth] : [run, 0, depth],
    farTop ? [run, height, depth] : [0, height, depth],
  ].map(coordinateMap);

  let faces = [
    [0, 2, 1],
    [3, 4, 5],
    [0, 1, 4, 3],
    [1, 2, 5, 4],
    [2, 0, 3, 5],
  ];
  // Account for axis permutation, mirrored width, and profile point winding.
  const reverseWinding = ((plane === "xz") !== (widthDirection === "negative")) !== farTop;
  if (reverseWinding) faces = faces.map((face) => [...face].reverse());

  const wedge = primitives.polyhedron({ points, faces });
  return transforms.translate(start, wedge);
};

export const startRib = (params) => {
  const {
    start,
    length,
    size,
    sizeX,
    sizeZ,
    curvePosition = "bottom-right",
    ribProfile = "curved",
    segments = 16,
  } = params;

  if (length <= 0) throw new Error("Rib length must be > 0");
  const ribDimensions = resolveRibDimensions({ size, sizeX, sizeZ });

  const polygonProfile = primitives.polygon({
    points: ribProfilePoints({
      start,
      sizeX: ribDimensions.sizeX,
      sizeZ: ribDimensions.sizeZ,
      curvePosition,
      profile: ribProfile,
      segments,
    }),
  });
  const rib = extrusions.extrudeLinear({ height: length }, polygonProfile);

  return transforms.translate([0, start[1] + length, 0], transforms.rotateX(Math.PI / 2, rib));
};

export const createArcWall = ({
  radius,
  wallWidth,
  height,
  axis = "z",
  startAngle = 0,
  endAngle = startAngle === 0 ? 360 : undefined,
  startCutPlane = "radial",
  endCutPlane = "radial",
  position = [0, 0, 0],
  segments = 32,
}) => {
  endAngle ??= startAngle + 360;

  if (radius <= 0) throw new Error("radius must be > 0");
  if (wallWidth <= 0) throw new Error("wallWidth must be > 0");
  if (height <= 0) throw new Error("height must be > 0");
  if (!Number.isFinite(startAngle) || !Number.isFinite(endAngle) || startAngle === endAngle) {
    throw new Error("startAngle and endAngle must be different finite angles");
  }
  if (!["x", "y", "z"].includes(axis)) throw new Error(`Invalid axis: ${axis}`);
  if (!Number.isInteger(segments) || segments < 1)
    throw new Error("segments must be an integer >= 1");
  const supportedCutPlanes =
    axis === "z" ? ["radial", "yz"] : axis === "x" ? ["radial", "xy"] : ["radial"];
  if (!supportedCutPlanes.includes(startCutPlane) || !supportedCutPlanes.includes(endCutPlane)) {
    throw new Error(
      `startCutPlane and endCutPlane must be ${supportedCutPlanes.map((plane) => `"${plane}"`).join(" or ")}`,
    );
  }
  if ((startCutPlane === "xy" || endCutPlane === "xy") && axis !== "x") {
    throw new Error('The "xy" cut plane is supported only when axis is "x"');
  }

  const startRadians = (startAngle * Math.PI) / 180;
  const endRadians = (endAngle * Math.PI) / 180;
  const angleSpan = endRadians - startRadians;
  // `segments` controls smoothness across this arc, not across a full circle.
  const pointCount = segments;
  const innerRadius = radius;
  const outerRadius = radius + wallWidth;
  const points = [];

  for (let index = 0; index <= pointCount; index += 1) {
    const angle = startRadians + (angleSpan * index) / pointCount;
    points.push([outerRadius * Math.cos(angle), outerRadius * Math.sin(angle)]);
  }
  for (let index = pointCount; index >= 0; index -= 1) {
    const angle = startRadians + (angleSpan * index) / pointCount;
    points.push([innerRadius * Math.cos(angle), innerRadius * Math.sin(angle)]);
  }

  const hasPlanarCut = ["yz", "xy"].includes(startCutPlane) || ["yz", "xy"].includes(endCutPlane);
  if (hasPlanarCut) {
    const middleAngle = (startRadians + endRadians) / 2;
    if (["yz", "xy"].includes(startCutPlane)) {
      const planeX = innerRadius * Math.cos(startRadians);
      points.splice(
        0,
        points.length,
        ...clipPolygonAtX(points, planeX, Math.cos(middleAngle) >= Math.cos(startRadians)),
      );
    }
    if (["yz", "xy"].includes(endCutPlane)) {
      const planeX = innerRadius * Math.cos(endRadians);
      points.splice(
        0,
        points.length,
        ...clipPolygonAtX(points, planeX, Math.cos(middleAngle) >= Math.cos(endRadians)),
      );
    }
  }

  const profile = primitives.polygon({ points });
  let wall = extrusions.extrudeLinear({ height }, profile);
  if (axis === "x") wall = transforms.rotateY(Math.PI / 2, wall);
  if (axis === "y") wall = transforms.rotateX(-Math.PI / 2, wall);

  return transforms.translate(position, wall);
};

export const createScrewHole = ({
  radius,
  smallRadius,
  totalHeight,
  smallHeight,
  position = [0, 0, 0],
  axis = "z",
  direction = 1,
  segments = 32,
}) => {
  smallHeight = smallHeight === undefined ? totalHeight * 0.33 : smallHeight;
  smallRadius = smallRadius === undefined ? radius * 0.5 : smallRadius;
  if (radius <= 0) throw new Error("radius must be > 0");
  if (smallRadius <= 0) throw new Error("smallRadius must be > 0");
  if (totalHeight <= 0) throw new Error("totalHeight must be > 0");
  if (smallHeight <= 0 || smallHeight > totalHeight) {
    throw new Error("smallHeight must be > 0 and <= totalHeight");
  }

  const largeHeight = totalHeight - smallHeight;

  // Create cylinders
  const largeCylinder = primitives.cylinder({
    height: largeHeight,
    radius: radius,
    center: [0, 0, largeHeight / 2],
    segments: segments,
  });

  const smallCylinder = primitives.cylinder({
    height: smallHeight,
    radius: smallRadius,
    center: [0, 0, smallHeight / 2],
    segments: segments,
  });

  // Position small cylinder on top of large cylinder
  const smallCylinderTranslated = transforms.translate([0, 0, largeHeight], smallCylinder);

  // Union the cylinders
  const hole = booleans.union(largeCylinder, smallCylinderTranslated);

  // Apply axis rotation to orient the cylinders
  let rotated = hole;
  if (axis === "x") {
    rotated = transforms.rotateY(Math.PI / 2, hole);
  } else if (axis === "y") {
    rotated = transforms.rotateX(Math.PI / 2, hole);
  }
  // axis === 'z' - no rotation needed

  // Apply direction (flip if negative)
  if (direction < 0) {
    if (axis === "x") {
      rotated = transforms.rotateY(Math.PI, rotated);
      rotated = transforms.translate([totalHeight, 0, 0], rotated);
    } else if (axis === "y") {
      rotated = transforms.rotateX(Math.PI, rotated);
      rotated = transforms.translate([0, totalHeight, 0], rotated);
    } else {
      rotated = transforms.rotateX(Math.PI, rotated);
      rotated = transforms.translate([0, 0, totalHeight], rotated);
    }
  }

  // Apply position
  return transforms.translate(position, rotated);
};
