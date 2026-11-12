import modeling from "@jscad/modeling";
import { startCuboid } from "../utils/shape-helpers";

const { booleans, primitives } = modeling;

export const teaBoxHolderDimensions = {
  length: 165,
  lowerFlangeWidth: 8,
  upperFlangeWidth: 12,
  stemWidth: 5,
  lowerFlangeThickness: 2,
  upperFlangeThickness: 3,
  stemHeight: 10,
  pinSize: 2,
  pinTolerance: 0.2,
  pinLength: 5,
  holeOffsetFromEnd: 25,
  screwShaftRadius: 1.6,
  screwHeadRadius: 3,
  counterboreDepth: 2,
};

export const teaBoxHolderOptions = {
  startSlot: true,
  endPin: true,
  narrowTop: false,
};

const totalHeight =
  teaBoxHolderDimensions.lowerFlangeThickness +
  teaBoxHolderDimensions.stemHeight +
  teaBoxHolderDimensions.upperFlangeThickness;

const createScrewHole = (xPosition) => {
  const { counterboreDepth, screwHeadRadius, screwShaftRadius, upperFlangeWidth } =
    teaBoxHolderDimensions;
  const shaftHole = primitives.cylinder({
    radius: screwShaftRadius,
    height: totalHeight,
    center: [xPosition, upperFlangeWidth / 2, totalHeight / 2],
    segments: 32,
  });
  const counterbore = primitives.cylinder({
    radius: screwHeadRadius,
    height: counterboreDepth,
    center: [xPosition, upperFlangeWidth / 2, totalHeight - counterboreDepth / 2],
    segments: 32,
  });

  return booleans.union(shaftHole, counterbore);
};

const createRailBody = ({ length, narrowTop }) => {
  const {
    lowerFlangeThickness,
    lowerFlangeWidth,
    stemHeight,
    stemWidth,
    upperFlangeThickness,
    upperFlangeWidth,
  } = teaBoxHolderDimensions;
  const topWidth = narrowTop ? lowerFlangeWidth : upperFlangeWidth;

  return booleans.union(
    startCuboid({
      start: [0, (upperFlangeWidth - lowerFlangeWidth) / 2, 0],
      size: [length, lowerFlangeWidth, lowerFlangeThickness],
    }),
    startCuboid({
      start: [0, (upperFlangeWidth - stemWidth) / 2, lowerFlangeThickness],
      size: [length, stemWidth, stemHeight],
    }),
    startCuboid({
      start: [0, (upperFlangeWidth - topWidth) / 2, lowerFlangeThickness + stemHeight],
      size: [length, topWidth, upperFlangeThickness],
    }),
  );
};

export const createTeaBoxHolder = ({
  length = teaBoxHolderDimensions.length,
  startSlot = teaBoxHolderOptions.startSlot,
  endPin = teaBoxHolderOptions.endPin,
  narrowTop = teaBoxHolderOptions.narrowTop,
  screwHoles = true,
} = {}) => {
  const { holeOffsetFromEnd, pinLength, pinSize, pinTolerance, upperFlangeWidth } =
    teaBoxHolderDimensions;
  const pinCrossSection = pinSize - 2 * pinTolerance;
  const additions = [createRailBody({ length, narrowTop })];
  const cuts = [];

  if (endPin) {
    additions.push(
      startCuboid({
        start: [length, upperFlangeWidth / 2 - pinCrossSection / 2, 0],
        size: [pinLength, pinCrossSection, totalHeight],
      }),
    );
  }

  if (startSlot) {
    cuts.push(
      startCuboid({
        start: [0, upperFlangeWidth / 2 - pinSize / 2, 0],
        size: [pinLength, pinSize, totalHeight],
      }),
    );
  }

  if (screwHoles) {
    cuts.push(createScrewHole(holeOffsetFromEnd), createScrewHole(length - holeOffsetFromEnd));
  }

  return cuts.length === 0
    ? booleans.union(...additions)
    : booleans.subtract(booleans.union(...additions), ...cuts);
};

export { totalHeight as teaBoxHolderTotalHeight };
