import modeling from "@jscad/modeling";
import { createScrewHole, startCuboid, startRoundedSlab } from "../utils/shape-helpers";

const { primitives, booleans, extrusions, transforms } = modeling;

export const id = "hyperx-under-desktop";
export const title = "HyperX-Under-Desktop";
export const exportFileName = "hyperx-under-desktop.stl";

const card = {
  width: 68.2,
  height: 30.2,
};
const cardHeight = 30.3;
const baseThickness = 5;
const wallThickness = 1;
const wallHeight = 10.2;
const connectorHoleRadius = 9 / 2;
const backCableWidth = 7;
const screwHoleRadius = 4;
const screwHoleSmallRadius = 2;
const screwHoleSmallHeight = 2;
const screwHoleDistanceFromFrontBack = 12;
const screwHoleTotalHeight = baseThickness;
const screwHoleStartZ = 0;

const lidThickness = 1;
const lidClearance = 0.3;
const lidFrameWidthX = 2;
const lidFrameWidthY = 6;
const lidClipThickness = 1;
const lidClipWidth = 8;
const lidClipDrop = wallHeight - 1;
const lidClipHookDepth = 0.8;
const lidClipHookHeight = 1.2;
const lidOffsetForPreview = 15;
const topPlateSize = 10;
const topPlateThinkness = 2;
const flutePitch = 4;
const fluteDepth = 0.35;
const fluteEndMargin = 3;
const outerWallCornerRadius = 2;

const lid = ({ baseDimensions }) => {
  const outerStart = [-lidClearance, -lidClearance, baseThickness + wallHeight];
  const outerSize = [
    baseDimensions[0] + lidClearance * 2,
    baseDimensions[1] + lidClearance * 2,
    lidThickness,
  ];

  const innerStart = [
    outerStart[0] + lidFrameWidthX,
    outerStart[1] + lidFrameWidthY,
    outerStart[2] - 0.5,
  ];
  const innerSize = [
    outerSize[0] - lidFrameWidthX * 2,
    outerSize[1] - lidFrameWidthY * 2,
    lidThickness + 1,
  ];

  const outerSlab = startRoundedSlab({
    start: outerStart,
    size: outerSize,
    roundedCorners: [],
    borderRadius: 0,
  });
  const innerSlab = startRoundedSlab({
    start: innerStart,
    size: innerSize,
    roundedCorners: [],
    borderRadius: 0,
  });
  const frame = booleans.subtract(outerSlab, innerSlab);

  const clipCenterY = baseDimensions[1] / 2;
  const clipStartY = clipCenterY - lidClipWidth / 2;
  const clipStartZ = baseThickness + wallHeight - lidClipDrop;

  const leftClipX = outerStart[0] + 0.2;
  const rightClipX = outerStart[0] + outerSize[0] - lidClipThickness - 0.2;

  const leftClip = startCuboid({
    start: [leftClipX, clipStartY, clipStartZ],
    size: [lidClipThickness, lidClipWidth, lidClipDrop],
  });
  const rightClip = startCuboid({
    start: [rightClipX, clipStartY, clipStartZ],
    size: [lidClipThickness, lidClipWidth, lidClipDrop],
  });

  const hookStartZ = clipStartZ + 0.4;
  const leftHook = startCuboid({
    start: [leftClipX + lidClipThickness, clipStartY, hookStartZ],
    size: [lidClipHookDepth, lidClipWidth, lidClipHookHeight],
  });
  const rightHook = startCuboid({
    start: [rightClipX - lidClipHookDepth, clipStartY, hookStartZ],
    size: [lidClipHookDepth, lidClipWidth, lidClipHookHeight],
  });

  return booleans.union(frame, leftClip, rightClip, leftHook, rightHook);
};

export const main = ({ includeGuides = true } = {}) => {
  const baseDimensions = [
    card.height + wallThickness * 2,
    card.width + wallThickness * 2,
    baseThickness,
  ];
  // base
  const cube = startRoundedSlab({
    start: [0, 0, 0],
    size: [baseDimensions[0], baseDimensions[1], baseDimensions[2]],
    roundedCorners: "all",
    borderRadius: outerWallCornerRadius,
  });

  // Screw holes in the base
  const screwHoles = [
    createScrewHole({
      radius: screwHoleRadius,
      smallRadius: screwHoleSmallRadius,
      totalHeight: baseThickness,
      smallHeight: screwHoleSmallHeight,
      position: [baseDimensions[0] / 2, screwHoleDistanceFromFrontBack, screwHoleStartZ],
      axis: "z",
      direction: -1,
    }),
    createScrewHole({
      radius: screwHoleRadius,
      smallRadius: screwHoleSmallRadius,
      totalHeight: baseThickness,
      smallHeight: screwHoleSmallHeight,
      position: [
        baseDimensions[0] / 2,
        baseDimensions[1] - screwHoleDistanceFromFrontBack,
        screwHoleStartZ,
      ],
      axis: "z",
      direction: -1,
    }),
  ];

  const baseWithScrewHoles = booleans.subtract(cube, ...screwHoles);

  const clipCenterY = baseDimensions[1] / 2;
  const clipStartY = clipCenterY - lidClipWidth / 2;
  const hookStartZ = baseThickness + wallHeight - lidClipDrop + 0.4;
  const clipHoleTolerance = 0.3;

  const leftClipFixationHole = startCuboid({
    start: [-1, clipStartY - clipHoleTolerance, hookStartZ - clipHoleTolerance / 2],
    size: [
      wallThickness + 2,
      lidClipWidth + clipHoleTolerance * 2,
      lidClipHookHeight + clipHoleTolerance,
    ],
  });

  const rightClipFixationHole = startCuboid({
    start: [
      baseDimensions[0] - wallThickness - 1,
      clipStartY - clipHoleTolerance,
      hookStartZ - clipHoleTolerance / 2,
    ],
    size: [
      wallThickness + 2,
      lidClipWidth + clipHoleTolerance * 2,
      lidClipHookHeight + clipHoleTolerance,
    ],
  });

  // Walls
  const finalWallHeight = wallHeight + topPlateThinkness;
  const fluteRadius = flutePitch / 2;
  // Preserve 3 mm of solid material at the bottom and top of the combined shell.
  const fluteStartZ = fluteEndMargin;
  const fluteHeight = baseThickness + finalWallHeight - fluteEndMargin * 2;
  const createWallFlutes = ({ length, position, centered = false }) => {
    const first = fluteEndMargin + fluteRadius;
    const last = length - fluteEndMargin - fluteRadius;
    const count = Math.max(0, Math.floor((last - first) / flutePitch) + 1);
    const start = centered ? (length - (count - 1) * flutePitch) / 2 : first;
    return Array.from({ length: count }, (_, index) => {
      const [x, y] = position(start + index * flutePitch, fluteDepth - fluteRadius);
      return primitives.cylinder({
        center: [x, y, fluteStartZ + fluteHeight / 2],
        radius: fluteRadius,
        height: fluteHeight + 0.02,
        segments: 12,
      });
    });
  };
  const backFlutes = createWallFlutes({
    length: baseDimensions[0],
    position: (x, offset) => [x, offset],
    centered: true,
  });
  const frontFlutes = createWallFlutes({
    length: baseDimensions[0],
    position: (x, offset) => [x, baseDimensions[1] - offset],
    centered: true,
  });
  const leftFlutes = createWallFlutes({
    length: baseDimensions[1],
    position: (y, offset) => [offset, y],
  });
  const rightFlutes = createWallFlutes({
    length: baseDimensions[1],
    position: (y, offset) => [baseDimensions[0] - offset, y],
  });
  // NOTE hole is centered relative to wallHeight, not finalWallHeight
  const frontHole = transforms.translate(
    [baseDimensions[0] / 2, baseDimensions[1] - wallThickness / 2, baseThickness + wallHeight / 2],
    transforms.rotateX(
      Math.PI / 2,
      primitives.cylinder({
        height: wallThickness + 2,
        radius: connectorHoleRadius,
        segments: 32,
      }),
    ),
  );
  const muteHoleWidth = 12.5;
  const muteHoleHeight = 6;
  const muteHoleDistanceFromFront = 8;
  const muteHole = startCuboid({
    start: [
      -wallThickness,
      baseDimensions[1] - muteHoleDistanceFromFront - muteHoleWidth,
      baseThickness + (wallHeight - muteHoleHeight) / 2,
    ],
    size: [wallThickness + 2, muteHoleWidth, muteHoleHeight],
  });
  const lowerOuterWall = transforms.translate(
    [0, 0, baseThickness],
    extrusions.extrudeLinear(
      { height: finalWallHeight - outerWallCornerRadius },
      primitives.roundedRectangle({
        center: [baseDimensions[0] / 2, baseDimensions[1] / 2],
        size: [baseDimensions[0], baseDimensions[1]],
        roundRadius: outerWallCornerRadius,
        segments: 16,
      }),
    ),
  );
  // Overlap the cap with the lower wall so only the exposed upper edge is rounded.
  const topCapHeight = outerWallCornerRadius * 2 + 0.1;
  const topEdgeCap = primitives.roundedCuboid({
    center: [
      baseDimensions[0] / 2,
      baseDimensions[1] / 2,
      baseThickness + finalWallHeight - topCapHeight / 2,
    ],
    size: [baseDimensions[0], baseDimensions[1], topCapHeight],
    roundRadius: outerWallCornerRadius,
    segments: 16,
  });
  const outerWall = booleans.union(lowerOuterWall, topEdgeCap);
  // The interior is intentionally square so all internal wall joints remain 90°.
  const innerCavity = startCuboid({
    start: [wallThickness, wallThickness, baseThickness - 0.1],
    size: [
      baseDimensions[0] - wallThickness * 2,
      baseDimensions[1] - wallThickness * 2,
      finalWallHeight + 0.2,
    ],
  });
  const backCableHole = startCuboid({
    start: [baseDimensions[0] / 2 - backCableWidth / 2, -1, baseThickness],
    size: [backCableWidth, wallThickness + 2, wallHeight + 2],
  });
  const wallShell = booleans.subtract(
    outerWall,
    innerCavity,
    backCableHole,
    frontHole,
    muteHole,
    // Keep the currently disabled lid-clip fixation openings disabled.
  );

  const body = booleans.subtract(
    booleans.union(baseWithScrewHoles, wallShell),
    ...backFlutes,
    ...frontFlutes,
    ...leftFlutes,
    ...rightFlutes,
  );
  const lidShape = lid({ baseDimensions });
  const translatedLid = transforms.translate(
    [baseDimensions[0] + lidOffsetForPreview, 0, 0],
    lidShape,
  );

  // Top plate

  const topPlateStart = [
    0,
    topPlateThinkness * Math.sin((10 * Math.PI) / 180),
    baseDimensions[2] + wallHeight - (topPlateThinkness * Math.sin((10 * Math.PI) / 180)) / 2,
  ];
  const topPlate = transforms.translate(
    topPlateStart,
    transforms.rotateX(
      (10 * Math.PI) / 180,
      booleans.subtract(
        startRoundedSlab({
          start: [0, 0, 0],
          size: [baseDimensions[0], topPlateSize, topPlateThinkness],
          roundedCorners: "all",
          borderRadius: outerWallCornerRadius,
        }),
        startCuboid({
          start: [(baseDimensions[0] - backCableWidth) / 2, 0, 0],
          size: [backCableWidth, topPlateSize, topPlateThinkness],
        }),
      ),
    ),
  );

  return [body, topPlate]; //, translatedLid]
};
