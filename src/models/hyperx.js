import modeling from "@jscad/modeling";
import { startCuboid, startRib, startRoundedSlab } from "../utils/shape-helpers";

const { primitives, colors } = modeling;

export const id = "hyperx";
export const title = "HyperX";
export const exportFileName = "hyperx.stl";

const cardWidth = 68.2;
const cardHeight = 30.2;
const baseThickness = 5;
const lipWidthX = 5;
const lipWidthZ = 3;
const backCableWidth = 14;
const clipPivotWidth = 14;
const clipPivotHeight = 14;
const clipHolesGap = 12;
const clipClampWidth = 15;
const clipClampHeight = 8.4;
const deckLipHeight = 17.9;
const deckLipThickness = 1.3;
const topSlabWidth = 30;
const topSlabThickness = 5;
const topSlabRibSizeX = deckLipHeight;
const topSlabRibSizeZ = deckLipHeight;
const topSlabRibThickness = 3;

const supportHolesDim = 6.45;
const supportHolesDimInternal = 4;
const supportHolesGap = 6.45;
const supportHolesBoxColumnsStartOn = 0;
const supportHolesBoxColumnsStep = 2;

export const main = ({ includeGuides = true } = {}) => {
  const baseDimensions = [
    baseThickness,
    Math.max(cardWidth + lipWidthX, 71),
    cardHeight + lipWidthZ,
  ];
  // base
  const cube = startRoundedSlab({
    start: [0, 0, 0],
    size: [baseDimensions[0], baseDimensions[1], baseDimensions[2]],
    roundedCorners: [],
    borderRadius: 0,
  });

  const pilotHoleTotalWidth = clipPivotWidth + lipWidthZ;
  const pilotHoleStartY = baseDimensions[1] - clipPivotWidth - lipWidthZ;
  const clipPivotHole = startCuboid({
    start: [0, pilotHoleStartY, lipWidthZ + (cardHeight - clipPivotHeight) / 2],
    size: [baseDimensions[0] + 1, pilotHoleTotalWidth, clipPivotHeight],
  });

  const clipClampHole = startCuboid({
    start: [
      0,
      pilotHoleStartY - clipHolesGap - clipClampWidth,
      lipWidthZ + (cardHeight - clipClampHeight) / 2,
    ],
    size: [baseDimensions[0] + 1, clipClampWidth, clipClampHeight],
  });

  const cubeWithHoles = modeling.booleans.subtract(cube, clipPivotHole, clipClampHole);

  // lips
  const bottomLip = startRoundedSlab({
    start: [baseThickness, 0, 0],
    size: [lipWidthX, baseDimensions[1], lipWidthZ],
    roundedCorners: ["front-left", "front-right", "back-left", "back-right"],
    borderRadius: 0,
  });

  const verticalLipsHeight = (cardHeight - backCableWidth) / 2;

  const frontLipY = baseDimensions[1] - lipWidthZ;
  const frontLipBottom = startRoundedSlab({
    start: [baseThickness, frontLipY, lipWidthZ],
    size: [lipWidthX, lipWidthZ, verticalLipsHeight],
    roundedCorners: ["front-left", "front-right", "back-left", "back-right"],
    borderRadius: 0,
  });

  const frontLipTop = startRoundedSlab({
    start: [baseThickness, frontLipY, verticalLipsHeight + backCableWidth + lipWidthZ],
    size: [lipWidthX, lipWidthZ, verticalLipsHeight],
    roundedCorners: ["front-left", "front-right", "back-left", "back-right"],
    borderRadius: 0,
  });

  const deckLipXSize = baseThickness - deckLipThickness;
  const deckLip = startRoundedSlab({
    start: [0, 0, baseDimensions[2]],
    size: [deckLipXSize, baseDimensions[1], deckLipHeight - deckLipThickness],
    roundedCorners: ["front-left", "front-right", "back-left", "back-right"],
    borderRadius: 0,
  });

  const topSlap = startRoundedSlab({
    start: [
      baseThickness - deckLipThickness - topSlabWidth,
      0,
      baseDimensions[2] + deckLipHeight - deckLipThickness - topSlabThickness,
    ],
    size: [topSlabWidth - deckLipXSize, baseDimensions[1], topSlabThickness],
    roundedCorners: ["front-left", "front-right", "back-left", "back-right"],
    borderRadius: 0,
  });

  const distributeSupportHoles = ({
    origin,
    holeDim,
    reservedDim,
    rows,
    cols,
    colsStartOn = 0,
    colsStep = 1,
    rowsStartOn = 0,
    rowsStep = 1,
    rowGap,
    colGap,
  }) => {
    const res = [];
    for (let row = rowsStartOn; row < rows; row += rowsStep) {
      for (let col = colsStartOn; col < cols; col += colsStep) {
        const originX = origin.x - baseThickness + deckLipThickness;
        const centerX = originX - col * (reservedDim + colGap) + reservedDim / 2;
        const centerY = origin.y + row * (reservedDim + rowGap) + reservedDim / 2;

        res.push({ centerX, centerY, radius: holeDim / 2 });
      }
    }
    return res;
  };

  const topSlapStart = [
    baseThickness - deckLipThickness - topSlabWidth,
    0,
    baseDimensions[2] + deckLipHeight - deckLipThickness - topSlabThickness,
  ];
  const topSlapSize = [topSlabWidth - deckLipXSize, baseDimensions[1], topSlabThickness];

  const supportHolesPitch = supportHolesDim + supportHolesGap;
  const supportHolesBoxColumns = 1;
  const supportHolesBoxRows = 6;

  const supportHolesGridOrigin = {
    x: -13.7 + baseThickness - deckLipThickness,
    y:
      (baseDimensions[1] -
        ((supportHolesBoxRows - 1) * supportHolesDim +
          (supportHolesBoxRows - 2) * supportHolesGap)) /
      2,
  };

  const supportHoles = distributeSupportHoles({
    origin: supportHolesGridOrigin,
    holeDim: supportHolesDimInternal,
    reservedDim: supportHolesDim,
    rowGap: supportHolesGap,
    rows: supportHolesBoxRows,
    cols: supportHolesBoxColumns,
    rowsStep: 2,
    rowGap: supportHolesGap,
    colGap: supportHolesGap,
  });

  const topSlapHoles = supportHoles.map(({ centerX, centerY, radius }) =>
    primitives.cylinder({
      center: [centerX, centerY, topSlapStart[2] + topSlapSize[2] / 2],
      radius,
      height: topSlapSize[2] + 0.1,
      segments: 24,
    }),
  );

  const topSlapWithHoles =
    topSlapHoles.length > 0 ? modeling.booleans.subtract(topSlap, ...topSlapHoles) : topSlap;

  const topSlapBottomZ = baseDimensions[2] + deckLipHeight - deckLipThickness - topSlabThickness;

  const distributeRibsAlongY = (ribThickness, count, startY, endY) => {
    const availableSpace = endY - startY - ribThickness * count;
    const gap = availableSpace / (count - 1);
    const positions = [];

    for (let i = 0; i < count; i += 1) {
      const positionY = startY + ribThickness * i + gap * i;
      positions.push({
        y: positionY,
        thickness: ribThickness,
      });
    }

    return positions;
  };

  const ribs = distributeRibsAlongY(topSlabRibThickness, 4, 0, baseDimensions[1]).map((rib) => {
    return startRib({
      start: [0, rib.y, topSlapBottomZ],
      sizeX: topSlabRibSizeX,
      sizeZ: topSlabRibSizeZ,
      length: rib.thickness,
      ribProfile: "flat",
      curvePosition: "bottom-left",
    });
  });

  return [
    modeling.booleans.union(
      cubeWithHoles,
      bottomLip,
      ...ribs,
      frontLipBottom,
      frontLipTop,
      deckLip,
      topSlapWithHoles,
    ),
    // ...(includeGuides
    //   ? topSlapHoles.map((hole) => colors.colorize([1, 0, 0, 1], hole))
    //   : []),
  ];
};
