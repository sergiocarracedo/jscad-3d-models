import modeling from "@jscad/modeling";
import { startRoundedSlab } from "../utils/shape-helpers";

const { booleans, extrusions, primitives, transforms } = modeling;

export const id = "bar-bin";
export const title = "Bar Bin";
export const exportFileName = "bar-bin.stl";

// Interior dimensions (mm)
const innerWidth = 95;
const innerDepth = 50;
const innerHeight = 80;

const wallThickness = 2;
const floorThickness = 3;

// 45deg chamfer legs at the floor/wall interior junction
const reinforceSize = 2;

// Clip: J-hook hanging from the top of the front wall, flush with the wall top.
// 4 hooks with gaps, spanning the full front width.
const clipCount = 7;
const clipWidth = 12;
const barDiameter = 2;
const clipClearance = 1.5;
const lipDrop = 20;
const lipThickness = 2.5;
const hookBackHeight = 0;

const outerWidth = innerWidth + wallThickness * 2;
const outerDepth = innerDepth + wallThickness * 2;
const boxTopZ = floorThickness + innerHeight;

const polygonSignedArea = (points) => {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[(index + 1) % points.length];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
};

const ensureCcw = (points) => (polygonSignedArea(points) < 0 ? points.slice().reverse() : points);

// Triangular prism running along an axis, used for the 45deg corner chamfers.
const startEdgeChamfer = ({ start, length, axis, profile }) => {
  const polygonProfile = primitives.polygon({
    points: ensureCcw(profile),
  });
  const prism = extrusions.extrudeLinear({ height: length }, polygonProfile);
  // rotateX(90): profile (x,z) -> world (x,z), extrusion z -> world y
  // rotateY(90): profile (u,v)=(-z,y) -> world (y,z), extrusion z -> world x
  const rotated =
    axis === "x" ? transforms.rotateY(Math.PI / 2, prism) : transforms.rotateX(Math.PI / 2, prism);
  return transforms.translate(start, rotated);
};

// J-hook: vertical back leg embedded in the front wall, horizontal finger over
// the bar, lip at the front so the bar cannot slide off. The hook top is flush
// with the top of the wall (nothing sticks up). Profile in (y,z), extruded
// along X. y=0 is the outer face of the front wall; negative y is into the wall.
const clip = ({ clipStartX, clipWidth }) => {
  const barGap = barDiameter + clipClearance;
  const hookFrontY = barGap + lipThickness;

  // (y, z) outline, CCW
  const outline = [
    [-wallThickness, boxTopZ - hookBackHeight],
    [-wallThickness, boxTopZ],
    [0, boxTopZ],
    [hookFrontY, boxTopZ],
    [hookFrontY, boxTopZ - barGap],
    [hookFrontY, boxTopZ - barGap - lipDrop],
    [hookFrontY - lipThickness, boxTopZ - barGap - lipDrop],
    [hookFrontY - lipThickness, boxTopZ - barGap],
    [0, boxTopZ - barGap],
  ];

  // rotateY(90) maps profile (u,v) -> world (y,z) when u=-z, v=y
  const profile = outline.map(([y, z]) => [-z, y]);

  return startEdgeChamfer({
    start: [clipStartX, outerDepth, 0],
    length: clipWidth,
    axis: "x",
    profile,
  });
};

export const main = ({ includeGuides = true } = {}) => {
  // Floor
  const floor = startRoundedSlab({
    start: [0, 0, 0],
    size: [outerWidth, outerDepth, floorThickness],
    roundedCorners: [],
    borderRadius: 0,
  });

  // Walls sit on top of the floor
  const walls = [
    startRoundedSlab({
      start: [0, 0, floorThickness],
      size: [outerWidth, wallThickness, innerHeight],
      roundedCorners: [],
      borderRadius: 0,
    }),
    startRoundedSlab({
      start: [0, outerDepth - wallThickness, floorThickness],
      size: [outerWidth, wallThickness, innerHeight],
      roundedCorners: [],
      borderRadius: 0,
    }),
    startRoundedSlab({
      start: [0, 0, floorThickness],
      size: [wallThickness, outerDepth, innerHeight],
      roundedCorners: [],
      borderRadius: 0,
    }),
    startRoundedSlab({
      start: [outerWidth - wallThickness, 0, floorThickness],
      size: [wallThickness, outerDepth, innerHeight],
      roundedCorners: [],
      borderRadius: 0,
    }),
  ];

  // 45deg chamfers along the four interior floor/wall edges
  const chamfers = [
    // Back-bottom (runs along X)
    startEdgeChamfer({
      start: [wallThickness, 0, 0],
      length: innerWidth,
      axis: "x",
      profile: [
        [-floorThickness, wallThickness],
        [-floorThickness, wallThickness + reinforceSize],
        [-floorThickness - reinforceSize, wallThickness],
      ],
    }),
    // Front-bottom (runs along X, mirrored)
    startEdgeChamfer({
      start: [wallThickness, 0, 0],
      length: innerWidth,
      axis: "x",
      profile: [
        [-floorThickness, outerDepth - wallThickness],
        [-floorThickness - reinforceSize, outerDepth - wallThickness],
        [-floorThickness, outerDepth - wallThickness - reinforceSize],
      ],
    }),
    // Left-bottom (runs along Y)
    startEdgeChamfer({
      start: [0, wallThickness + innerDepth, 0],
      length: innerDepth,
      axis: "y",
      profile: [
        [wallThickness, floorThickness],
        [wallThickness + reinforceSize, floorThickness],
        [wallThickness, floorThickness + reinforceSize],
      ],
    }),
    // Right-bottom (runs along Y, mirrored)
    startEdgeChamfer({
      start: [0, wallThickness + innerDepth, 0],
      length: innerDepth,
      axis: "y",
      profile: [
        [outerWidth - wallThickness, floorThickness],
        [outerWidth - wallThickness, floorThickness + reinforceSize],
        [outerWidth - wallThickness - reinforceSize, floorThickness],
      ],
    }),
  ];

  // Four clips, evenly spaced with gaps, spanning the full front width
  const gapWidth = (outerWidth - clipCount * clipWidth) / (clipCount - 1);
  const clips = [];
  for (let index = 0; index < clipCount; index += 1) {
    clips.push(
      clip({
        clipStartX: index * (clipWidth + gapWidth),
        clipWidth,
      }),
    );
  }

  return [booleans.union(floor, ...walls, ...chamfers, ...clips)];
};
