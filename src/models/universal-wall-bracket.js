import modeling from "@jscad/modeling";
import { deserialize } from "@jscad/stl-deserializer";
import ManifoldModule from "manifold-3d";

const { geometries } = modeling;
const { geom3, poly3 } = geometries;

export const id = "universal-wall-bracket";
export const title = "Universal Wall Bracket";
export const exportFileName = "universal-wall-bracket.stl";

// Parametric dimensions — edit these and export the result as STL from the viewer.
export const bracketHeightMm = 95.7;
export const mountingHoleSpacingMm = 55.7;
export const topHoleEdgeDistanceMm = 25;
export const bottomHoleEdgeDistanceMm = 15;
export const adhesiveRecessDepthMm = 2.5;
// 4 mm is the smallest reliable rim without cutting into the original's corner radii.
export const adhesiveRecessRimMm = 4;
export const railLengthMm = 55.5;

const originalHeightMm = 60.87753296;
const originalHoleSpacingMm = 30.87753296;
const lowerHoleZMm = 15;
// Original holes are 5 mm; this produces 6 mm through-holes for extra clearance.
const holeRadiusMm = 3;
const plateBackY = 84.60379791;
const plateFrontY = 89.60379791;
const middleStartZMm = 24;
const middleEndZMm = 36;
const sourceUrl = new URL("./assets/universal-wall-bracket-original.stl", import.meta.url);
let originalPromise;
let manifoldPromise;

const loadOriginal = () =>
  (originalPromise ??= fetch(sourceUrl)
    .then((response) => {
      if (!response.ok) throw new Error(`Could not load original bracket (${response.status}).`);
      return response.arrayBuffer();
    })
    .then((data) => deserialize({ output: "geometry", filename: "universal-wall-bracket-original.stl" }, data)[0]));

const loadManifold = () =>
  (manifoldPromise ??= ManifoldModule().then((wasm) => {
    wasm.setup();
    return wasm;
  }));

const clipAtZ = (vertices, z, keepAbove) => {
  const clipped = [];
  for (let index = 0; index < vertices.length; index += 1) {
    const a = vertices[index];
    const b = vertices[(index + 1) % vertices.length];
    const aInside = keepAbove ? a[2] >= z : a[2] <= z;
    const bInside = keepAbove ? b[2] >= z : b[2] <= z;
    if (aInside) clipped.push(a);
    if (aInside !== bInside) {
      const fraction = (z - a[2]) / (b[2] - a[2]);
      clipped.push([a[0] + fraction * (b[0] - a[0]), a[1] + fraction * (b[1] - a[1]), z]);
    }
  }
  return clipped;
};

const createSolid = (triangles) =>
  geom3.create(triangles.map((triangle) => poly3.fromPoints(triangle)));

const resizeHeight = (original, heightMm) => {
  const addedHeight = heightMm - originalHeightMm;
  if (Math.abs(addedHeight) < 0.00001) return original;

  const triangles = [];
  for (const { vertices } of geom3.toPolygons(original)) {
    const regions = [
      clipAtZ(vertices, middleStartZMm, false),
      clipAtZ(clipAtZ(vertices, middleStartZMm, true), middleEndZMm, false),
      clipAtZ(vertices, middleEndZMm, true),
    ];
    regions.forEach((region, index) => {
      if (region.length < 3) return;
      const moved = region.map(([x, y, z]) => [
        x,
        y,
        z + (index === 0 ? 0 : index === 2 ? addedHeight : ((z - middleStartZMm) / 12) * addedHeight),
      ]);
      for (let vertex = 1; vertex < moved.length - 1; vertex += 1) {
        triangles.push([moved[0], moved[vertex], moved[vertex + 1]]);
      }
    });
  }
  return createSolid(triangles);
};

const toManifold = (solid, { Manifold, Mesh }) => {
  const vertices = [];
  const triangleVertices = [];
  const vertexIndexes = new Map();
  for (const { vertices: polygonVertices } of geom3.toPolygons(solid)) {
    for (const point of polygonVertices) {
      const key = point.map((coordinate) => coordinate.toFixed(6)).join(",");
      let index = vertexIndexes.get(key);
      if (index === undefined) {
        index = vertices.length / 3;
        vertexIndexes.set(key, index);
        vertices.push(...point);
      }
      triangleVertices.push(index);
    }
  }
  return new Manifold(new Mesh({
    numProp: 3,
    vertProperties: new Float32Array(vertices),
    triVerts: new Uint32Array(triangleVertices),
  }));
};

const fromManifold = (solid) => {
  const { vertProperties, triVerts } = solid.getMesh();
  const triangles = [];
  for (let index = 0; index < triVerts.length; index += 3) {
    triangles.push([0, 1, 2].map((offset) => {
      const vertex = triVerts[index + offset] * 3;
      return [vertProperties[vertex], vertProperties[vertex + 1], vertProperties[vertex + 2]];
    }));
  }
  return createSolid(triangles);
};

const repositionMountingHoles = (bracket, heightMm, holeSpacingMm, { Manifold }) => {
  const xCenter = 91.69746;
  const yCenter = (plateBackY + plateFrontY) / 2;
  const sourceCenters = [
    lowerHoleZMm,
    lowerHoleZMm + originalHoleSpacingMm + heightMm - originalHeightMm,
  ];
  const topCenter = heightMm - topHoleEdgeDistanceMm;
  const targetCenters = [topCenter - holeSpacingMm, topCenter];
  const bore = (radiusMm, zMm, lengthMm) =>
    Manifold.cylinder(lengthMm, radiusMm, radiusMm, 96, true)
      .rotate([90, 0, 0])
      .translate([xCenter, yCenter, zMm]);

  // An overlap avoids coincident surfaces, which are the usual source of
  // non-manifold meshes when an imported STL is modified.
  const filled = Manifold.union([
    bracket,
    ...sourceCenters.map((zMm) => bore(holeRadiusMm + 0.5, zMm, 4.9)),
  ]);
  return filled.subtract(Manifold.union(targetCenters.map((zMm) => bore(holeRadiusMm, zMm, 6))));
};

const shortenForwardRails = (bracket, heightMm, { Manifold }) => {
  const railBottomZ = heightMm - railLengthMm;
  const frontMaterial = Manifold.cube([60, 20, railBottomZ + 0.01], true).translate([
    91.69746,
    plateFrontY + 10,
    railBottomZ / 2,
  ]);
  return bracket.subtract(frontMaterial);
};

const cutBackRecess = (bracket, heightMm, { Manifold }) => {
  if (adhesiveRecessDepthMm <= 0) return bracket;
  const recess = Manifold.cube([
    50 - adhesiveRecessRimMm * 2,
    adhesiveRecessDepthMm + 0.1,
    heightMm - adhesiveRecessRimMm * 2,
  ], true).translate([
    91.69746,
    plateBackY + adhesiveRecessDepthMm / 2,
    heightMm / 2,
  ]);
  return bracket.subtract(recess);
};

export const main = async () => {
  if (bracketHeightMm < 50 || mountingHoleSpacingMm < 7 ||
      Math.abs(bracketHeightMm - (topHoleEdgeDistanceMm + mountingHoleSpacingMm + bottomHoleEdgeDistanceMm)) > 0.001) {
    throw new RangeError("Bracket height or mounting-hole spacing is outside the printable range.");
  }
  const resizedBracket = resizeHeight(await loadOriginal(), bracketHeightMm);
  const wasm = await loadManifold();
  const bracket = repositionMountingHoles(
    toManifold(resizedBracket, wasm),
    bracketHeightMm,
    mountingHoleSpacingMm,
    wasm,
  );
  return fromManifold(cutBackRecess(shortenForwardRails(bracket, bracketHeightMm, wasm), bracketHeightMm, wasm));
};
