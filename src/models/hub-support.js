import modeling from "@jscad/modeling";
import { startRoundedSlab } from "../utils/shape-helpers";

const { booleans, primitives, colors } = modeling;

export const id = "hub-support";
export const title = "Hub Support";
export const exportFileName = "hub-support.stl";

const hub = {
  width: 45,
  deep: 120,
  height: 18,
};

const baseThickness = 3;
const wallThickness = 3;

const baseLightenHoleHorizontalGap = 12;
const baseLightenHoleMaxMin = [16, 28];
const baseLightenHoleSidePadding = 14;
const baseLightenHoleDepthInset = 5;
const baseLightenHoleRadius = 2;
const rooftopLightenHoleHorizontalGap = 12;
const rooftopLightenHoleMaxMin = [16, 28];
const rooftopLightenHoleSidePadding = 14;
const rooftopLightenHoleDepthInset = 6;
const rooftopLightenHoleRadius = 2;

const topHoleDim = 4;
const topHoleHorizontalGap = 6.45;
const topHoleReserveDim = 6.45;
const topHoleSidePadding = 14;
const topHoleDepthInset = 0.75;

const topWidth = 18;
const topThinkness = 3;
const rooftopThinkness = 3;

const calculateLightenHoles = ({ spanWidth, sidePadding, gap, sizeRange, roundRadius }) => {
  const [minWidth, maxWidth] = sizeRange;
  const effectiveSidePadding = Math.max(0, sidePadding - roundRadius);
  const effectiveGap = Math.max(0, gap - roundRadius * 2);
  const usableWidth = spanWidth - effectiveSidePadding * 2;

  if (usableWidth < minWidth) return [];

  const minimumHoleCount = Math.max(
    1,
    Math.ceil((usableWidth + effectiveGap) / (maxWidth + effectiveGap)),
  );
  const maximumHoleCount = Math.max(
    1,
    Math.floor((usableWidth + effectiveGap) / (minWidth + effectiveGap)),
  );

  if (minimumHoleCount > maximumHoleCount) return [];

  const holeCount = maximumHoleCount;
  const holeWidth = (usableWidth - effectiveGap * (holeCount - 1)) / holeCount;

  return Array.from({ length: holeCount }, (_, index) => ({
    startX: effectiveSidePadding + index * (holeWidth + effectiveGap),
    width: holeWidth,
  }));
};

const distributeCylinderHoles = ({
  origin,
  holeDim,
  reservedDim,
  rows,
  rowsSkip,
  cols,
  colsStartOn,
  colsSkip,
  rowGap,
  colGap,
}) => {
  const holes = [];

  for (let row = 0; row < rows; row += 1) {
    if (rowsSkip && rowsSkip.includes(row)) continue;
    for (let col = colsStartOn; col < cols; col += 1) {
      if (colsSkip && colsSkip.includes(col)) continue;
      const centerX = origin.x + col * (reservedDim + colGap) + reservedDim / 2;
      const centerY = origin.y + row * (reservedDim + rowGap) + reservedDim / 2;
      holes.push({ centerX, centerY, radius: holeDim / 2 });
    }
  }

  return holes;
};

const createCylinderHoleSolids = ({ holes, start, height }) =>
  holes.map(({ centerX, centerY, radius }) =>
    primitives.cylinder({
      center: [start[0] + centerX, start[1] + centerY, start[2] + height / 2],
      radius,
      height: height + 0.1,
      segments: 24,
    }),
  );

export const main = ({ includeGuides = true } = {}) => {
  const baseDimensions = [
    hub.deep + wallThickness * 2,
    hub.width + wallThickness * 2,
    baseThickness,
  ];

  const base = startRoundedSlab({
    start: [0, 0, 0],
    size: [baseDimensions[0], baseDimensions[1], baseDimensions[2]],
    roundedCorners: ["front-left", "front-right", "back-left", "back-right"],
    borderRadius: baseLightenHoleRadius,
  });

  const baseLightenHoleDepth =
    baseDimensions[1] - wallThickness * 2 - baseLightenHoleDepthInset * 2;
  const baseHoles =
    baseLightenHoleDepth > 0
      ? calculateLightenHoles({
          spanWidth: baseDimensions[0],
          sidePadding: baseLightenHoleSidePadding,
          gap: baseLightenHoleHorizontalGap,
          sizeRange: baseLightenHoleMaxMin,
          roundRadius: baseLightenHoleRadius,
        }).map(({ startX, width }) =>
          startRoundedSlab({
            start: [startX, wallThickness + baseLightenHoleDepthInset, -0.05],
            size: [width, baseLightenHoleDepth, baseThickness + 0.1],
            roundedCorners: ["front-left", "front-right", "back-left", "back-right"],
            borderRadius: baseLightenHoleRadius,
          }),
        )
      : [];

  const baseWithHoles = baseHoles.length > 0 ? booleans.subtract(base, ...baseHoles) : base;

  const wallLightenHole = {
    deep: baseDimensions[0] - wallThickness - 15 - 10,
    height: hub.height - topThinkness,
  };
  const backHoleWidth = 13;
  const backHalfWallWidth = wallThickness / 2 + (hub.width - backHoleWidth) / 2;

  const walls = [
    booleans.subtract(
      startRoundedSlab({
        start: [0, 0, baseThickness],
        size: [baseDimensions[0], wallThickness, hub.height],
        borderRadius: baseLightenHoleRadius,
      }),
      startRoundedSlab({
        start: [15 + wallThickness, 0, baseThickness],
        size: [wallLightenHole.deep, baseDimensions[1] + 1, wallLightenHole.height],
        borderRadius: 0,
      }),
    ),
    booleans.subtract(
      startRoundedSlab({
        start: [0, hub.width + wallThickness, baseThickness],
        size: [baseDimensions[0], wallThickness, hub.height],
        borderRadius: baseLightenHoleRadius,
      }),
      startRoundedSlab({
        start: [15 + wallThickness, baseDimensions[1] - wallThickness, baseThickness],
        size: [wallLightenHole.deep, baseDimensions[1] + 1, wallLightenHole.height],
        borderRadius: 0,
      }),
    ),
    startRoundedSlab({
      start: [0, wallThickness / 2, baseThickness],
      size: [wallThickness, backHalfWallWidth, hub.height],
      roundedCorners: ["back-right", "back-left"],
      borderRadius: baseLightenHoleRadius,
    }),
    startRoundedSlab({
      start: [0, baseDimensions[1] - wallThickness / 2 - backHalfWallWidth, baseThickness],
      size: [wallThickness, backHalfWallWidth, hub.height],
      roundedCorners: ["front-right", "front-left"],
      borderRadius: baseLightenHoleRadius,
    }),
  ];

  const topLeftStart = [0, -topWidth + wallThickness, baseThickness + hub.height - topThinkness];
  const topRightStart = [0, wallThickness + hub.width, baseThickness + hub.height - topThinkness];
  const rooftopStart = [0, wallThickness / 2, baseThickness + hub.height - rooftopThinkness];

  const topLeft = booleans.subtract(
    startRoundedSlab({
      start: topLeftStart,
      size: [baseDimensions[0], topWidth, topThinkness],
      roundedCorners: ["front-left", "front-right", "back-left", "back-right"],
      borderRadius: baseLightenHoleRadius,
    }),
  );

  const topRight = booleans.subtract(
    startRoundedSlab({
      start: topRightStart,
      size: [baseDimensions[0], topWidth, topThinkness],
      roundedCorners: ["front-left", "front-right", "back-left", "back-right"],
      borderRadius: baseLightenHoleRadius,
    }),
  );

  const rooftop = booleans.subtract(
    startRoundedSlab({
      start: rooftopStart,
      size: [baseDimensions[0], hub.width + wallThickness, rooftopThinkness],
      borderRadius: 0,
    }),
  );

  const rooftopLightenHoleDepth = hub.width + wallThickness - rooftopLightenHoleDepthInset * 2;
  const rooftopLightenHoles =
    rooftopLightenHoleDepth > 0
      ? calculateLightenHoles({
          spanWidth: baseDimensions[0],
          sidePadding: rooftopLightenHoleSidePadding,
          gap: rooftopLightenHoleHorizontalGap,
          sizeRange: rooftopLightenHoleMaxMin,
          roundRadius: rooftopLightenHoleRadius,
        }).map(({ startX, width }) =>
          startRoundedSlab({
            start: [
              startX,
              wallThickness / 2 + rooftopLightenHoleDepthInset,
              baseThickness + hub.height - rooftopThinkness - 0.05,
            ],
            size: [width, rooftopLightenHoleDepth, rooftopThinkness + 0.1],
            roundedCorners: ["front-left", "front-right", "back-left", "back-right"],
            borderRadius: rooftopLightenHoleRadius,
          }),
        )
      : [];

  const rooftopWithLightenHoles =
    rooftopLightenHoles.length > 0 ? booleans.subtract(rooftop, ...rooftopLightenHoles) : rooftop;

  const topHoleGrid = distributeCylinderHoles({
    origin: {
      x: 10,
      y: 5,
    },
    holeDim: topHoleDim,
    reservedDim: topHoleReserveDim,
    rows: 6,
    rowsSkip: [1, 2, 3, 4],
    cols: 9,
    colsStartOn: 0,
    rowsStartOn: 0,
    rowGap: topHoleHorizontalGap,
    colGap: topHoleHorizontalGap,
  });

  const topHoles = createCylinderHoleSolids({
    holes: topHoleGrid,
    start: [0, -15, baseThickness + hub.height - topThinkness],
    height: topThinkness,
  }).map((hole) => colors.colorize([1, 0, 0], hole));

  const top = booleans.subtract(
    booleans.union(topLeft, topRight, rooftopWithLightenHoles),
    ...topHoles,
  );

  return [booleans.union(baseWithHoles, ...walls, top)];
};
