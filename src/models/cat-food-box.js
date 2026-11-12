import modeling from "@jscad/modeling";

const { booleans, extrusions, primitives, transforms } = modeling;

const ensureCounterclockwise = (points) => {
  const area = points.reduce((sum, [x1, y1], index) => {
    const [x2, y2] = points[(index + 1) % points.length];
    return sum + x1 * y2 - x2 * y1;
  }, 0);
  return area < 0 ? points.slice().reverse() : points;
};

export const id = "cat-food-box";
export const title = "Cat Food Box";
export const exportFileName = "cat-food-box.stl";

export const dimensions = {
  width: 147,
  length: 210,
  height: 54,
  wallThickness: 1.8,
  floorThickness: 1.8,
  chamferSize: 1.8,
  cornerRadius: 10,
  flutePitch: 4,
  fluteDepth: 0.55,
  fluteEndMargin: 3,
};

const prismAlongX = ({ x, length, profile }) => {
  const polygon = primitives.polygon({
    points: ensureCounterclockwise(profile.map(([y, z]) => [-z, y])),
  });
  const prism = extrusions.extrudeLinear({ height: length }, polygon);
  return transforms.translate([x, 0, 0], transforms.rotateY(Math.PI / 2, prism));
};

const prismAlongY = ({ y, length, profile }) => {
  const polygon = primitives.polygon({
    points: ensureCounterclockwise(profile.map(([x, z]) => [x, -z])),
  });
  const prism = extrusions.extrudeLinear({ height: length }, polygon);
  return transforms.translate([0, y, 0], transforms.rotateX(-Math.PI / 2, prism));
};

export const main = (options = {}) => {
  const {
    width,
    length,
    height,
    wallThickness,
    floorThickness,
    chamferSize,
    cornerRadius,
    flutePitch,
    fluteDepth,
    fluteEndMargin,
  } = { ...dimensions, ...options };
  const outerWidth = Number(width);
  const outerLength = Number(length);
  const outerHeight = Number(height);
  const wall = Number(wallThickness);
  const floor = Number(floorThickness);
  const chamfer = Math.min(Number(chamferSize), wall, outerHeight - floor);
  const outerCornerRadius = Number(cornerRadius);
  const wavePitch = Number(flutePitch);
  const waveDepth = Number(fluteDepth);
  const endMargin = Number(fluteEndMargin);

  if (
    [
      outerWidth,
      outerLength,
      outerHeight,
      wall,
      floor,
      chamfer,
      outerCornerRadius,
      wavePitch,
      waveDepth,
      endMargin,
    ].some((value) => !Number.isFinite(value) || value <= 0)
  ) {
    throw new Error("Box dimensions and thicknesses must be positive finite numbers.");
  }
  if (wall * 2 >= outerWidth || wall * 2 >= outerLength || floor >= outerHeight) {
    throw new Error("Wall and floor thicknesses must be smaller than the box dimensions.");
  }
  if (outerCornerRadius > Math.min(outerWidth, outerLength) / 2) {
    throw new Error("Corner radius must not exceed half the smaller external dimension.");
  }
  if (waveDepth >= wall) {
    throw new Error("Wave depth must be smaller than the wall thickness.");
  }
  if (outerHeight - floor - endMargin * 2 <= 0) {
    throw new Error("Top and bottom wave margins leave no room for the wall pattern.");
  }

  const innerWidth = outerWidth - wall * 2;
  const innerLength = outerLength - wall * 2;
  const wallHeight = outerHeight - floor;
  const innerCornerRadius = Math.max(0, outerCornerRadius - wall);
  const outerBody = extrusions.extrudeLinear(
    { height: outerHeight },
    primitives.roundedRectangle({
      center: [outerWidth / 2, outerLength / 2],
      size: [outerWidth, outerLength],
      roundRadius: outerCornerRadius,
      segments: 32,
    }),
  );
  const cavity = transforms.translate(
    [0, 0, floor],
    extrusions.extrudeLinear(
      { height: wallHeight + 0.1 },
      primitives.roundedRectangle({
        center: [outerWidth / 2, outerLength / 2],
        size: [innerWidth, innerLength],
        roundRadius: innerCornerRadius,
        segments: 32,
      }),
    ),
  );
  const chamfers = [
    prismAlongX({
      x: wall + innerCornerRadius,
      length: innerWidth - innerCornerRadius * 2,
      profile: [
        [wall, floor],
        [wall + chamfer, floor],
        [wall, floor + chamfer],
      ],
    }),
    prismAlongX({
      x: wall + innerCornerRadius,
      length: innerWidth - innerCornerRadius * 2,
      profile: [
        [outerLength - wall, floor],
        [outerLength - wall, floor + chamfer],
        [outerLength - wall - chamfer, floor],
      ],
    }),
    prismAlongY({
      y: wall + innerCornerRadius,
      length: innerLength - innerCornerRadius * 2,
      profile: [
        [wall, floor],
        [wall + chamfer, floor],
        [wall, floor + chamfer],
      ],
    }),
    prismAlongY({
      y: wall + innerCornerRadius,
      length: innerLength - innerCornerRadius * 2,
      profile: [
        [outerWidth - wall, floor],
        [outerWidth - wall, floor + chamfer],
        [outerWidth - wall - chamfer, floor],
      ],
    }),
  ];

  const fluteRadius = wavePitch / 2;
  const grooveStartZ = floor + endMargin;
  const grooveHeight = outerHeight - endMargin - grooveStartZ;
  const createGrooves = ({ runLength, center }) => {
    const first = outerCornerRadius + fluteRadius;
    const last = runLength - outerCornerRadius - fluteRadius;
    const count = Math.max(0, Math.floor((last - first) / wavePitch) + 1);
    return Array.from({ length: count }, (_, index) => {
      const position = first + index * wavePitch;
      const [x, y] = center(position, waveDepth - fluteRadius);
      return primitives.cylinder({
        center: [x, y, grooveStartZ + grooveHeight / 2],
        radius: fluteRadius,
        height: grooveHeight + 0.02,
        segments: 12,
      });
    });
  };
  const grooves = [
    ...createGrooves({
      runLength: outerWidth,
      center: (x, offset) => [x, offset],
    }),
    ...createGrooves({
      runLength: outerWidth,
      center: (x, offset) => [x, outerLength - offset],
    }),
    ...createGrooves({
      runLength: outerLength,
      center: (y, offset) => [offset, y],
    }),
    ...createGrooves({
      runLength: outerLength,
      center: (y, offset) => [outerWidth - offset, y],
    }),
  ];
  const shell = booleans.subtract(booleans.subtract(outerBody, cavity), ...grooves);

  return [booleans.union(shell, ...chamfers)];
};
