import modeling from "@jscad/modeling";

const { booleans, extrusions, primitives, transforms } = modeling;

export const id = "patio-support";
export const title = "Patio Support";
export const exportFileName = "patio-support.stl";

// Profile dimensions in millimeters.
const leftRun = 8;
const rightRun = 16;
const sideHeight = 5;
const peakRise = 4;
const extrusionLength = 70;
const cornerRadius = 4;
const tipRadius = 1;

export const main = () => {
  const width = leftRun + rightRun;
  const peakHeight = sideHeight + peakRise;
  const leftLength = Math.hypot(leftRun, peakRise);
  const rightLength = Math.hypot(rightRun, peakRise);
  const leftDirection = [-leftRun / leftLength, -peakRise / leftLength];
  const rightDirection = [rightRun / rightLength, -peakRise / rightLength];
  const tipAngle = Math.acos(
    leftDirection[0] * rightDirection[0] + leftDirection[1] * rightDirection[1],
  );
  const tangentDistance = tipRadius / Math.tan(tipAngle / 2);
  const bisector = [leftDirection[0] + rightDirection[0], leftDirection[1] + rightDirection[1]];
  const bisectorLength = Math.hypot(...bisector);
  const centerDistance = tipRadius / Math.sin(tipAngle / 2);
  const tipCenter = [
    leftRun + (bisector[0] / bisectorLength) * centerDistance,
    peakHeight + (bisector[1] / bisectorLength) * centerDistance,
  ];
  const leftTangent = [
    leftRun + leftDirection[0] * tangentDistance,
    peakHeight + leftDirection[1] * tangentDistance,
  ];
  const rightTangent = [
    leftRun + rightDirection[0] * tangentDistance,
    peakHeight + rightDirection[1] * tangentDistance,
  ];
  const profile = booleans.union(
    primitives.polygon({
      points: [[0, 0], [width, 0], [width, sideHeight], rightTangent, leftTangent, [0, sideHeight]],
    }),
    primitives.circle({ center: tipCenter, radius: tipRadius, segments: 32 }),
  );

  const support = extrusions.extrudeLinear({ height: extrusionLength }, profile);
  const footprint = primitives.roundedRectangle({
    center: [width / 2, extrusionLength / 2],
    size: [width, extrusionLength],
    roundRadius: cornerRadius,
    segments: 16,
  });
  const footprintMask = transforms.translate(
    [0, peakHeight + 0.1, 0],
    transforms.rotateX(
      Math.PI / 2,
      extrusions.extrudeLinear({ height: peakHeight + 0.2 }, footprint),
    ),
  );

  return booleans.intersect(support, footprintMask);
};
