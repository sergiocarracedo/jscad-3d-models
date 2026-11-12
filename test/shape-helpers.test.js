import assert from "node:assert/strict";
import test from "node:test";
import modeling from "@jscad/modeling";
import { createArcWall, createWedge } from "../src/utils/shape-helpers.js";

const bounds = (solid) => modeling.measurements.measureBoundingBox(solid);

test("creates an arc wall with the requested inner radius, wall width, and height", () => {
  const solid = createArcWall({
    radius: 10,
    wallWidth: 2,
    height: 5,
    startAngle: 0,
    endAngle: 90,
  });
  const [minimum, maximum] = bounds(solid);

  assert.ok(Math.abs(minimum[0] - 0) < 0.01);
  assert.ok(Math.abs(maximum[0] - 12) < 0.01);
  assert.ok(Math.abs(minimum[1] - 0) < 0.01);
  assert.ok(Math.abs(maximum[1] - 12) < 0.01);
  assert.equal(maximum[2] - minimum[2], 5);
});

test("orients the extrusion height along the selected axis", () => {
  const solid = createArcWall({ radius: 10, wallWidth: 2, height: 7, axis: "y" });
  const [minimum, maximum] = bounds(solid);

  assert.equal(maximum[1] - minimum[1], 7);
});

test("defaults to a full 360-degree ring when angles are omitted", () => {
  const solid = createArcWall({ radius: 10, wallWidth: 2, height: 5 });
  const [minimum, maximum] = bounds(solid);

  assert.ok(Math.abs(minimum[0] + 12) < 0.01);
  assert.ok(Math.abs(maximum[0] - 12) < 0.01);
  assert.ok(Math.abs(minimum[1] + 12) < 0.01);
  assert.ok(Math.abs(maximum[1] - 12) < 0.01);
});

test("cuts arc ends with planes parallel to YZ when requested", () => {
  const solid = createArcWall({
    radius: 10,
    wallWidth: 2,
    height: 5,
    startAngle: 240,
    endAngle: 300,
    startCutPlane: "yz",
    endCutPlane: "yz",
  });
  const [minimum, maximum] = bounds(solid);

  assert.ok(Math.abs(minimum[0] + 5) < 0.01);
  assert.ok(Math.abs(maximum[0] - 5) < 0.01);
});

test("rejects invalid dimensions and axes", () => {
  assert.throws(() => createArcWall({ radius: 0, wallWidth: 2, height: 5 }), /radius/);
  assert.throws(() => createArcWall({ radius: 10, wallWidth: 0, height: 5 }), /wallWidth/);
  assert.throws(() => createArcWall({ radius: 10, wallWidth: 2, height: 5, axis: "a" }), /axis/);
});

test("creates a wedge with a selectable profile plane and expected volume", () => {
  for (const plane of ["xy", "xz", "yz"]) {
    const wedge = createWedge({
      width: 10,
      height: 4,
      depth: 3,
      plane,
      start: [1, 2, 3],
    });
    const [minimum, maximum] = bounds(wedge);

    assert.ok(Math.abs(modeling.measurements.measureVolume(wedge) - 60) < 0.001);
    assert.deepEqual(minimum, [1, 2, 3]);
    const expectedMaximum = {
      xy: [11, 6, 6],
      xz: [11, 5, 7],
      yz: [4, 12, 7],
    }[plane];
    assert.deepEqual(maximum, expectedMaximum);
  }
});

test("orients mirrored wedges from the lower vertex of their vertical side", () => {
  const options = { width: 10, height: 4, depth: 3, plane: "xz", start: [1, 2, 3] };
  const positive = createWedge({
    ...options,
    widthDirection: "positive",
    slopePosition: "bottom",
  });
  const negative = createWedge({
    ...options,
    widthDirection: "negative",
    slopePosition: "bottom",
  });
  const positivePoints = modeling.geometries.geom3.toPoints(positive).flat();
  const negativePoints = modeling.geometries.geom3.toPoints(negative).flat();
  const hasPoint = (points, expected) =>
    points.some((point) => point.every((coordinate, index) => coordinate === expected[index]));

  assert.ok(hasPoint(positivePoints, [1, 2, 3]), "positive wedge keeps the requested start vertex");
  assert.ok(hasPoint(negativePoints, [1, 2, 3]), "negative wedge keeps the requested start vertex");
  assert.ok(hasPoint(positivePoints, [1, 2, 7]), "both orientations share the tall-side vertex");
  assert.ok(hasPoint(negativePoints, [1, 2, 7]));
  assert.ok(hasPoint(positivePoints, [11, 2, 7]));
  assert.ok(hasPoint(negativePoints, [-9, 2, 7]));
  assert.equal(modeling.measurements.measureVolume(positive), 60);
  assert.equal(modeling.measurements.measureVolume(negative), 60);
  assert.throws(() => createWedge({ ...options, widthDirection: "sideways" }), /widthDirection/);
});
