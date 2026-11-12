import modeling from "@jscad/modeling";
import { deserialize } from "@jscad/stl-deserializer";

export const id = "dario";
export const title = "Dario";
export const exportFileName = "dario.stl";

export const parameters = {
  pocketWidthMm: 46,
  pocketHeightMm: 25.5517,
  pocketDepthMm: 30,
  baseThicknessMm: 1,
  baseClearanceMm: 1,
  pinDiameterMm: 3,
  pinLengthMm: 3,
  pinSpacingMm: 24,
  pinClearanceMm: 0.3,
  pocketCenter: [97.85004, 63.20775, 34.64],
  backWallTangentAngle: Math.atan2(0.9, -0.5),
};

const { booleans, extrusions, primitives, transforms } = modeling;
const blueOvalUrl = new URL("./assets/SubaruLogo-blue-oval.STL", import.meta.url);
const whiteReliefUrl = new URL("./assets/SubaruLogo-white-relief.STL", import.meta.url);
let blueOvalPromise;
let whiteReliefPromise;

const loadStl = (url, filename) =>
  fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`Could not load ${filename} (${response.status}).`);
      return response.arrayBuffer();
    })
    .then((data) => {
      const [geometry] = deserialize({ output: "geometry", filename }, data);
      if (!geometry) throw new Error(`${filename} did not contain any geometry.`);
      return geometry;
    });

const loadBlueOval = () => (blueOvalPromise ??= loadStl(blueOvalUrl, "SubaruLogo-blue-oval.STL"));
const loadWhiteRelief = () =>
  (whiteReliefPromise ??= loadStl(whiteReliefUrl, "SubaruLogo-white-relief.STL"));

const ellipseInBackWall = (widthMm, heightMm, depthMm, tangentAngle) =>
  transforms.rotateZ(
    tangentAngle,
    transforms.rotateX(
      Math.PI / 2,
      extrusions.extrudeLinear(
        { height: depthMm },
        primitives.ellipse({
          center: [0, 0],
          radius: [widthMm / 2, heightMm / 2],
          segments: 96,
        }),
      ),
    ),
  );

const createCutterAndBase = (options) => {
  const { pocketCenter: center, backWallTangentAngle: angle } = options;
  const interiorNormal = [-Math.cos(angle - Math.PI / 2), -Math.sin(angle - Math.PI / 2)];
  const cutter = transforms.translate(
    center,
    ellipseInBackWall(options.pocketHeightMm, options.pocketWidthMm, options.pocketDepthMm, angle),
  );
  const pinCutouts = [-options.pinSpacingMm / 2, options.pinSpacingMm / 2].map((offset) =>
    transforms.translate(
      [
        center[0] + interiorNormal[0] * (options.pocketDepthMm + options.pinLengthMm / 2 - 0.01),
        center[1] + interiorNormal[1] * (options.pocketDepthMm + options.pinLengthMm / 2 - 0.01),
        center[2] + offset,
      ],
      transforms.rotateZ(
        angle,
        transforms.rotateX(
          Math.PI / 2,
          primitives.cylinder({
            height: options.pinLengthMm + 0.02,
            radius: options.pinDiameterMm / 2 + options.pinClearanceMm,
            segments: 32,
          }),
        ),
      ),
    ),
  );
  const base = transforms.translate(
    center.map(
      (coordinate, index) => coordinate + (interiorNormal[index] ?? 0) * options.pocketDepthMm,
    ),
    ellipseInBackWall(
      options.pocketHeightMm - options.baseClearanceMm,
      options.pocketWidthMm - options.baseClearanceMm,
      options.baseThicknessMm,
      angle,
    ),
  );
  return { cutter: booleans.union(cutter, ...pinCutouts), base };
};

const colorizeNamed = (name, color, geometry) => {
  const colored = modeling.colors.colorize(color, geometry);
  colored.name = name;
  return colored;
};

export const main = async (overrides = {}) => {
  const options = { ...parameters, ...overrides };
  const [blueOval, whiteRelief] = await Promise.all([loadBlueOval(), loadWhiteRelief()]);
  const { cutter, base } = createCutterAndBase(options);

  return [
    colorizeNamed("Parametric oval negative-volume cutter", [0.9, 0.2, 0.1, 1], cutter),
    colorizeNamed("Parametric 1 mm flat oval base", [0.05, 0.2, 0.7, 1], base),
    colorizeNamed("Blue Subaru oval with alignment pegs", [0.05, 0.2, 0.7, 1], blueOval),
    colorizeNamed("White Subaru stars and border", [1, 1, 1, 1], whiteRelief),
  ];
};
