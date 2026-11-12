import modeling from "@jscad/modeling";

const { booleans, extrusions, primitives, transforms } = modeling;

export const id = "plug-cover";
export const title = "Plug Cover";
export const exportFileName = "plug-cover.stl";

// Internal dimensions in millimetres.
export const dimensions = {
  innerWidth: 200,
  innerDepth: 87,
  innerHeight: 27,
  wallThickness: 1.8,
  floorThickness: 1.8,
  cornerRadius: 4,
  cornerPadSize: 7,
  cornerPadHeight: 3.5,
  cornerPadRecessDiameter: 5,
  cornerPadRecessDepth: 1,
  topWallOpeningSizeX: 13,
  topWallOpeningSizeY: 10,
};

export const main = (options = {}) => {
  const {
    innerWidth,
    innerDepth,
    innerHeight,
    wallThickness,
    floorThickness,
    cornerRadius,
    cornerPadSize,
    cornerPadHeight,
    cornerPadRecessDiameter,
    cornerPadRecessDepth,
    topWallOpeningSizeX,
    topWallOpeningSizeY
  } = { ...dimensions, ...options };
  const width = Number(innerWidth);
  const depth = Number(innerDepth);
  const height = Number(innerHeight);
  const wall = Number(wallThickness);
  const floor = Number(floorThickness);
  const radius = Number(cornerRadius);
  const padSize = Number(cornerPadSize);
  const padHeight = Number(cornerPadHeight);
  const recessDiameter = Number(cornerPadRecessDiameter);
  const recessDepth = Number(cornerPadRecessDepth);
  const openingSizeY = Number(topWallOpeningSizeY);
  const openingSizeX = Number(topWallOpeningSizeX);

  if (
    [
      width,
      depth,
      height,
      wall,
      floor,
      radius,
      padSize,
      padHeight,
      recessDiameter,
      recessDepth,
      openingSizeX,
      openingSizeY,
    ].some((value) => !Number.isFinite(value) || value <= 0)
  ) {
    throw new Error("Plug cover dimensions and thicknesses must be positive finite numbers.");
  }

  const outerWidth = width + wall * 2;
  const outerDepth = depth + wall * 2;
  const outerHeight = height + floor;
  if (radius > Math.min(outerWidth, outerDepth, outerHeight) / 2 || radius <= wall) {
    throw new Error("Corner radius must fit the shell and be larger than the wall thickness.");
  }
  if (padSize > Math.min(width, depth) || recessDiameter > padSize || recessDepth > padHeight) {
    throw new Error("Corner-pad dimensions must fit the internal opening and pad height.");
  }
  if (openingSizeX > Math.min(width, height)) {
    throw new Error("Top-wall opening must fit the cover width and internal height.");
  }

  const innerRadius = radius - wall;
  const lowerCavityHeight = radius * 2 + 0.1;
  const bottomFillet = primitives.roundedCuboid({
    center: [outerWidth / 2, outerDepth / 2, lowerCavityHeight / 2],
    size: [outerWidth, outerDepth, lowerCavityHeight],
    roundRadius: radius,
    segments: 32,
  });
  const upperBody = transforms.translate(
    [0, 0, radius],
    extrusions.extrudeLinear(
      { height: outerHeight - radius },
      primitives.roundedRectangle({
        center: [outerWidth / 2, outerDepth / 2],
        size: [outerWidth, outerDepth],
        roundRadius: radius,
        segments: 32,
      }),
    ),
  );
  // This lower cavity mirrors the external fillet with a constant 1.8 mm offset.
  const lowerCavity = primitives.roundedCuboid({
    center: [outerWidth / 2, outerDepth / 2, floor + lowerCavityHeight / 2],
    size: [width, depth, lowerCavityHeight],
    roundRadius: innerRadius,
    segments: 32,
  });
  const upperCavity = transforms.translate(
    [0, 0, radius],
    extrusions.extrudeLinear(
      { height: outerHeight - radius + 0.1 },
      primitives.roundedRectangle({
        center: [outerWidth / 2, outerDepth / 2],
        size: [width, depth],
        roundRadius: innerRadius,
        segments: 32,
      }),
    ),
  );
  const padOffsets = [
    [wall, wall],
    [outerWidth - wall - padSize, wall],
    [wall, outerDepth - wall - padSize],
    [outerWidth - wall - padSize, outerDepth - wall - padSize],
  ];
  const cornerPads = padOffsets.map(([x, y]) =>
    primitives.cuboid({
      center: [x + padSize / 2, y + padSize / 2, outerHeight - padHeight / 2],
      size: [padSize, padSize, padHeight],
    }),
  );
  const cornerPadRecesses = padOffsets.map(([x, y]) =>
    primitives.cylinder({
      center: [x + padSize / 2, y + padSize / 2, outerHeight - recessDepth / 2],
      height: recessDepth + 0.1,
      radius: recessDiameter / 2,
      segments: 32,
    }),
  );
  const topWallOpening = primitives.cuboid({
    center: [
      outerWidth - wall - padSize/4 - openingSizeX / 2,
      outerDepth,
      outerHeight - openingSizeY / 2,
    ],
    size: [openingSizeX, wall*2 + 0.2, openingSizeY + 0.1],
  });

  const shell = booleans.subtract(
    booleans.union(bottomFillet, upperBody),
    booleans.union(lowerCavity, upperCavity, topWallOpening),
  );

  return [booleans.subtract(booleans.union(shell, ...cornerPads), ...cornerPadRecesses)];
};
