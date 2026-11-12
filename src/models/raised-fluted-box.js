import modeling from "@jscad/modeling";

const { booleans, extrusions, primitives, transforms } = modeling;

export const id = "raised-fluted-box";
export const title = "Raised Fluted Box";
export const exportFileName = "raised-fluted-box.stl";

// External dimensions in millimetres.
export const dimensions = {
  width: 130,
  depth: 32,
  height: 70,
  raisedWallHeight: 20,
  wallThickness: 1.8,
  floorThickness: 1.8,
  cornerRadius: 6,
  bottomFilletRadius: 6,
  backHoleWidth: 100,
  backHoleHeight: 50,
  backHoleCornerRadius: 6,
  backHoleVerticalOffset: -10,
  flutePitch: 4,
  fluteDepth: 0.55,
  fluteEndMargin: 3,
};

const createGrooves = ({ runLength, cornerRadius, pitch, depth, startZ, height, center }) => {
  const radius = pitch / 2;
  const first = cornerRadius + radius;
  const last = runLength - cornerRadius - radius;
  const count = Math.max(0, Math.floor((last - first) / pitch) + 1);

  return Array.from({ length: count }, (_, index) => {
    const position = first + index * pitch;
    const [x, y] = center(position, depth - radius);
    return primitives.cylinder({
      center: [x, y, startZ + height / 2],
      radius,
      height: height + 0.02,
      segments: 12,
    });
  });
};

const createUndersideGrooves = ({ width, depth, cornerRadius, pitch, fluteDepth }) => {
  const radius = pitch / 2;
  const first = cornerRadius + radius;
  const last = width - cornerRadius - radius;
  const count = Math.max(0, Math.floor((last - first) / pitch) + 1);
  const length = depth - cornerRadius * 2;

  return Array.from({ length: count }, (_, index) =>
    transforms.translate(
      [first + index * pitch, depth / 2, fluteDepth - radius],
      transforms.rotateX(
        Math.PI / 2,
        primitives.cylinder({ radius, height: length + 0.02, segments: 12 }),
      ),
    ),
  );
};

export const main = (options = {}) => {
  const {
    width,
    depth,
    height,
    raisedWallHeight,
    wallThickness,
    floorThickness,
    cornerRadius,
    bottomFilletRadius,
    backHoleWidth,
    backHoleHeight,
    backHoleCornerRadius,
    backHoleVerticalOffset,
    flutePitch,
    fluteDepth,
    fluteEndMargin,
  } = { ...dimensions, ...options };

  const outerWidth = Number(width);
  const outerDepth = Number(depth);
  const rimHeight = Number(height);
  const raisedHeight = Number(raisedWallHeight);
  const wall = Number(wallThickness);
  const floor = Number(floorThickness);
  const radius = Number(cornerRadius);
  const bottomRadius = Number(bottomFilletRadius);
  const holeWidth = Number(backHoleWidth);
  const holeHeight = Number(backHoleHeight);
  const holeRadius = Number(backHoleCornerRadius);
  const holeVerticalOffset = Number(backHoleVerticalOffset);
  const pitch = Number(flutePitch);
  const depthOfFlute = Number(fluteDepth);
  const endMargin = Number(fluteEndMargin);

  if (
    [
      outerWidth,
      outerDepth,
      rimHeight,
      raisedHeight,
      wall,
      floor,
      radius,
      bottomRadius,
      holeWidth,
      holeHeight,
      holeRadius,
      pitch,
      depthOfFlute,
      endMargin,
    ].some((value) => !Number.isFinite(value) || value <= 0)
  ) {
    throw new Error("Box dimensions and thicknesses must be positive finite numbers.");
  }
  if (wall * 2 >= outerWidth || wall * 2 >= outerDepth || floor >= rimHeight) {
    throw new Error("Wall and floor thicknesses must be smaller than the box dimensions.");
  }
  if (radius > Math.min(outerWidth, outerDepth) / 2) {
    throw new Error("Corner radius must not exceed half the smaller external dimension.");
  }
  if (radius > raisedHeight / 2) {
    throw new Error("Corner radius must fit within the raised wall height.");
  }
  if (bottomRadius > Math.min(outerWidth, outerDepth, rimHeight) / 2) {
    throw new Error("Bottom fillet radius must fit within the box dimensions.");
  }
  if (bottomRadius <= wall) {
    throw new Error("Bottom fillet radius must be larger than the wall thickness.");
  }
  if (
    !Number.isFinite(holeVerticalOffset) ||
    holeWidth + radius * 2 > outerWidth ||
    (rimHeight + raisedHeight) / 2 + holeVerticalOffset - holeHeight / 2 < 0 ||
    (rimHeight + raisedHeight) / 2 + holeVerticalOffset + holeHeight / 2 >
      rimHeight + raisedHeight ||
    holeRadius > Math.min(holeWidth, holeHeight) / 2
  ) {
    throw new Error("Back-wall hole must fit inside the wall with valid corner radii.");
  }
  if (depthOfFlute >= wall) {
    throw new Error("Flute depth must be smaller than the wall thickness.");
  }

  const innerWidth = outerWidth - wall * 2;
  const innerDepth = outerDepth - wall * 2;
  const innerRadius = Math.max(0, radius - wall);
  // A rounded cuboid supplies 6 mm exterior fillets along both bottom perimeter
  // edges, with spherical blends at the corners. Above the fillet, the normal
  // rounded wall continues from the same X/Y profile.
  const bottomFilletHeight = bottomRadius * 2 + 0.1;
  const bottomFillet = primitives.roundedCuboid({
    center: [outerWidth / 2, outerDepth / 2, bottomFilletHeight / 2],
    size: [outerWidth, outerDepth, bottomFilletHeight],
    roundRadius: bottomRadius,
    segments: 32,
  });
  const upperBody = transforms.translate(
    [0, 0, bottomRadius],
    extrusions.extrudeLinear(
      { height: rimHeight - bottomRadius },
      primitives.roundedRectangle({
        center: [outerWidth / 2, outerDepth / 2],
        size: [outerWidth, outerDepth],
        roundRadius: radius,
        segments: 32,
      }),
    ),
  );
  const innerBottomRadius = bottomRadius - wall;
  const innerBottomFillet = primitives.roundedCuboid({
    center: [outerWidth / 2, outerDepth / 2, floor + bottomFilletHeight / 2],
    size: [innerWidth, innerDepth, bottomFilletHeight],
    roundRadius: innerBottomRadius,
    segments: 32,
  });
  const upperCavity = transforms.translate(
    [0, 0, bottomRadius],
    extrusions.extrudeLinear(
      { height: rimHeight - bottomRadius + 0.1 },
      primitives.roundedRectangle({
        center: [outerWidth / 2, outerDepth / 2],
        size: [innerWidth, innerDepth],
        roundRadius: innerRadius,
        segments: 32,
      }),
    ),
  );
  const cavity = booleans.union(innerBottomFillet, upperCavity);

  // The back (y = 0) wall begins and ends at the rounded-corner tangent points.
  // The square lower section conceals the rounded profile's lower corners, leaving
  // only the two exposed top corners rounded.
  const raisedWallWidth = outerWidth - radius * 2;
  const raisedWallLower = primitives.cuboid({
    center: [outerWidth / 2, wall / 2, rimHeight + (raisedHeight - radius) / 2],
    size: [raisedWallWidth, wall, raisedHeight - radius],
  });
  const raisedWallTopHeight = radius * 2 + 0.1;
  const raisedWallTop = transforms.rotateX(
    -Math.PI / 2,
    extrusions.extrudeLinear(
      { height: wall },
      primitives.roundedRectangle({
        center: [outerWidth / 2, -(rimHeight + raisedHeight - raisedWallTopHeight / 2)],
        size: [raisedWallWidth, raisedWallTopHeight],
        roundRadius: radius,
        segments: 32,
      }),
    ),
  );
  const raisedBackWall = booleans.union(raisedWallLower, raisedWallTop);
  const backHole = transforms.translate(
    [0, -0.1, 0],
    transforms.rotateX(
      -Math.PI / 2,
      extrusions.extrudeLinear(
        { height: wall + 0.2 },
        primitives.roundedRectangle({
          center: [outerWidth / 2, -((rimHeight + raisedHeight) / 2 + holeVerticalOffset)],
          size: [holeWidth, holeHeight],
          roundRadius: holeRadius,
          segments: 32,
        }),
      ),
    ),
  );

  const regularGrooveHeight = rimHeight - floor - endMargin * 2;
  if (regularGrooveHeight <= 0) {
    throw new Error("Top and bottom flute margins leave no room for the wall pattern.");
  }
  const regularGrooves = [
    ...createGrooves({
      runLength: outerWidth,
      cornerRadius: radius,
      pitch,
      depth: depthOfFlute,
      startZ: floor + endMargin,
      height: regularGrooveHeight,
      center: (x, offset) => [x, outerDepth - offset],
    }),
    ...createGrooves({
      runLength: outerDepth,
      cornerRadius: radius,
      pitch,
      depth: depthOfFlute,
      startZ: floor + endMargin,
      height: regularGrooveHeight,
      center: (y, offset) => [offset, y],
    }),
    ...createGrooves({
      runLength: outerDepth,
      cornerRadius: radius,
      pitch,
      depth: depthOfFlute,
      startZ: floor + endMargin,
      height: regularGrooveHeight,
      center: (y, offset) => [outerWidth - offset, y],
    }),
  ];
  // Front-to-back grooves preserve the rounded perimeter and corner blends.
  const undersideGrooves = createUndersideGrooves({
    width: outerWidth,
    depth: outerDepth,
    cornerRadius: bottomRadius,
    pitch,
    fluteDepth: depthOfFlute,
  });

  return [
    booleans.subtract(
      booleans.union(
        booleans.subtract(booleans.union(bottomFillet, upperBody), cavity),
        raisedBackWall,
      ),
      ...regularGrooves,
      ...undersideGrooves,
      backHole,
    ),
  ];
};
