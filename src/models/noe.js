import modeling from "@jscad/modeling";
import { hexToRgb } from "@jscad/modeling/src/colors";
import { createArcWall, createWedge, startCuboid } from "../utils/shape-helpers.js";

export const id = "noe-ballpen-clip";
export const title = "Noe's whiteboard ballpen clip";
export const exportFileName = "noe-ballpen-clip.stl";

const { booleans, primitives, colors, hulls, transforms } = modeling;

const dim = {
  segments: 64,
  topTip: {
    wall: 0.9,
    innerRadius: 26.5 / 2,
    height: 3.5,
    cord: 10,
  },
  topTip2: {
    height: 2.2,
  },
  cover: {
    thick: 2,
    centerCut: {
      w: 11.2,
      h: 24,
    },
  },
  topCuboid: {
    hole: 4,
    wall: 1.6,
    wall2: 1.3,
    xSize: 0, //To be calculated
    ySize: 7,
    zSize: 9.5 + 6.5,
  },
  bottomBelt: {
    z: 23,
    zSize: 4,
    wall: 2,
    innerRadius1: 32.7,
    innerRadius2: 27.2,
  },
  bottomFlap: {
    zSize: 32,
    width: 7,
    wall: 1.7,
    slope: 15,
    angle: 5,
  },
};

export const main = ({ includeGuides = true } = {}) => {
  // Derivated dimensions
  dim.topTip.outerRadius = dim.topTip.innerRadius + dim.topTip.wall;
  dim.topCuboid.xSize = dim.topTip.cord + dim.topCuboid.wall * 2;

  // Top tip
  // Set the arc's endpoint chord to 10 mm (rather than its curved arc length).
  const halfArcAngle = Math.asin(dim.topTip.cord / (2 * dim.topTip.innerRadius));
  const topTip = createArcWall({
    radius: dim.topTip.innerRadius,
    wallWidth: dim.topTip.wall,
    height: dim.topTip.height,
    axis: "z",
    startAngle: 270 - (halfArcAngle * 180) / Math.PI,
    endAngle: 270 + (halfArcAngle * 180) / Math.PI,
    position: [0, 0, 0],
    segments: dim.segments,
  });

  // Top circle
  const circleLower = createArcWall({
    radius: dim.topTip.innerRadius,
    wallWidth: dim.topTip.wall,
    height: dim.topTip2.height,
    axis: "z",
    position: [0, 0, dim.topTip.height - dim.topTip2.height],
    segments: dim.segments,
  });

  //Top cover
  const topCoverCylinder = primitives.cylinder({
    height: dim.cover.thick,
    radius: dim.topTip.outerRadius,
    segments: dim.segments,
    center: [0, 0, dim.topTip.height],
  });

  const coverZ = dim.topTip.height;
  const topCoverRect = booleans.intersect([
    primitives.cuboid({
      size: [dim.cover.centerCut.w, dim.topTip.outerRadius * 2, coverZ + dim.cover.thick + 1],
      center: [0, 0, -coverZ / 2 + dim.topTip.height],
    }),
    primitives.cylinder({
      height: coverZ + dim.cover.thick,
      radius: dim.topTip.innerRadius,
      segments: dim.segments,
      center: [0, 0, -coverZ / 2 + dim.topTip.height],
    }),
  ]);
  let topCover = booleans.subtract([topCoverCylinder, topCoverRect]);

  const halfArcAngle2 = Math.asin(
    (dim.topTip.cord + dim.topCuboid.wall * 2) / (2 * dim.topTip.outerRadius),
  );

  // Extend the circular cover tangentially to the clip's outer outline.
  // The two flaps occupy the cover's XY plane, not the clip's vertical walls.
  const flapEnd = createArcWall({
    radius: dim.topTip.outerRadius + 0.01,
    wallWidth: dim.topCuboid.hole + dim.topCuboid.wall2,
    height: dim.cover.thick,
    startAngle: 270 - (halfArcAngle2 * 180) / Math.PI,
    endAngle: 270 + (halfArcAngle2 * 180) / Math.PI,
    startCutPlane: "yz",
    endCutPlane: "yz",
    position: [0, 0, dim.topTip.height - dim.cover.thick / 2],
    segments: dim.segments,
  });
  const flapOpening = primitives.cuboid({
    size: [
      dim.topTip.cord,
      (dim.topTip.outerRadius + dim.topCuboid.hole + dim.topCuboid.wall2) * 2,
      dim.cover.thick + 2,
    ],
    center: [0, 0, dim.topTip.height],
  });
  const flaps = booleans.subtract(
    hulls.hull(topCoverCylinder, flapEnd),
    topCoverCylinder,
    flapOpening,
  );
  topCover = booleans.union(topCover, flaps);

  const topCuboid = booleans.subtract([
    createArcWall({
      radius: dim.topTip.outerRadius + 0.01,
      wallWidth: dim.topCuboid.hole + dim.topCuboid.wall2,
      height: dim.topCuboid.zSize,
      axis: "z",
      startAngle: 270 - (halfArcAngle2 * 180) / Math.PI,
      endAngle: 270 + (halfArcAngle2 * 180) / Math.PI,
      position: [0, 0, -dim.topCuboid.zSize + dim.topTip.height + dim.cover.thick / 2],
      segments: dim.segments,
      startCutPlane: "yz",
      endCutPlane: "yz",
    }),
    createArcWall({
      radius: dim.topTip.outerRadius,
      wallWidth: dim.topCuboid.hole,
      height: 200,
      axis: "z",
      startAngle: 270 - (halfArcAngle * 180) / Math.PI,
      endAngle: 270 + (halfArcAngle * 180) / Math.PI,
      startCutPlane: "yz",
      endCutPlane: "yz",
      position: [0, 0, -100],
      segments: dim.segments,
    }),
  ]);

  const tipDim = {
    xSize: 1,
    ySize: dim.topCuboid.hole - 1,
    zSize: 5,
    slopePosition: "bottom",
  };

  const tipsY =
    dim.topTip.outerRadius + (dim.topCuboid.hole - tipDim.ySize) / 2 + tipDim.ySize / 2 + 0.3;

  const tipsZ = 0 - tipDim.zSize - 3.7 - 2.2;

  const tip1 = createWedge({
    width: tipDim.xSize,
    height: tipDim.zSize,
    depth: tipDim.ySize,
    plane: "xz",
    widthDirection: "negative",
    slopePosition: tipDim.slopePosition,
    start: [dim.topTip.cord / 2 + tipDim.xSize / 3, -tipsY, tipsZ],
  });
  const tip2 = createWedge({
    width: tipDim.xSize,
    height: tipDim.zSize,
    depth: tipDim.ySize,
    plane: "xz",
    widthDirection: "positive",
    slopePosition: tipDim.slopePosition,
    start: [-dim.topTip.cord / 2 - tipDim.xSize / 3, -tipsY, tipsZ],
  });

  const cutterDim = {
    xSize: 3,
  };

  const cutter = colors.colorize(
    hexToRgb("#00ffff"),
    startCuboid({
      start: [-100, -(dim.topTip.innerRadius + dim.topCuboid.hole) - cutterDim.xSize, -10],
      size: [200, cutterDim.xSize, 10],
    }),
  );

  // Bottom
  const bottomFlapTopZ = dim.topTip.height + dim.topTip2.height / 2;
  const backTip = colors.colorize(
    hexToRgb("#00ff00"),
    createWedge({
      width: 8,
      height: 1.3,
      depth: dim.bottomFlap.width,
      plane: "yz",
      widthDirection: "negative",
      slopePosition: "top",
      start: [
        -dim.bottomFlap.width / 2,
        dim.topTip.innerRadius + 4.5,
        -dim.bottomFlap.zSize + bottomFlapTopZ,
      ],
    }),
  );

  // const bottomFlap = startCuboid({
  //   start: [
  //     -dim.bottomFlap.width / 2,
  //     dim.topTip.innerRadius,
  //     -dim.bottomFlap.zSize + bottomFlapTopZ,
  //   ],
  //   size: [dim.bottomFlap.width, dim.bottomFlap.wall, dim.bottomFlap.zSize],
  // })
  // // Hinge the flap on its upper, inner X-parallel edge at the top body.
  // // A positive X rotation moves the free end outward (toward +Y).
  // const bottomFlapHinge = [0, dim.topTip.outerRadius, bottomFlapTopZ]
  // const rotatedBottomFlap = transforms.translate(
  //   bottomFlapHinge,
  //   transforms.rotateX(
  //     (dim.bottomFlap.angle * Math.PI) / 180,
  //     transforms.translate(
  //       bottomFlapHinge.map((coordinate) => -coordinate),
  //       bottomFlap,
  //     ),
  //   ),
  // )

  const radius = 40;

  const bottomFlap = createArcWall({
    radius,
    wallWidth: dim.bottomFlap.wall,
    height: dim.bottomFlap.width,
    axis: "x",
    position: [
      -dim.bottomFlap.width / 2,
      -radius + dim.topTip.innerRadius + 4.5,
      dim.topTip.height - dim.topTip2.height - 17,
    ],
    startCutPlane: "xy",
    endCutPlane: "xy",
    startAngle: 231 / Math.PI,
    endAngle: 378 / Math.PI,
    segments: dim.segments,
  });

  return [
    topTip,
    circleLower,
    topCover,
    booleans.subtract([booleans.union([topCuboid, tip1, tip2, cutter]), cutter]),
    backTip,
    bottomFlap,
    //rotatedBottomFlap,
  ];
};
