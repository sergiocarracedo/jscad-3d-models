import assert from "node:assert/strict";
import test from "node:test";
import modeling from "@jscad/modeling";
import { dimensions, main } from "../src/models/raised-fluted-box.js";

test("creates a 130 × 32 box with a 90 mm raised back wall", () => {
  const [box] = main();
  const [minimum, maximum] = modeling.measurements.measureBoundingBox(box);

  assert.ok(minimum.every((coordinate) => Math.abs(coordinate) < 0.001));
  assert.ok(Math.abs(maximum[0] - dimensions.width) < 0.001);
  assert.ok(Math.abs(maximum[1] - dimensions.depth) < 0.001);
  assert.ok(Math.abs(maximum[2] - dimensions.height - dimensions.raisedWallHeight) < 0.001);
});

test("rejects flute cuts that would pass through the wall", () => {
  assert.throws(() => main({ fluteDepth: dimensions.wallThickness }), /Flute depth/);
});

test("allows a 1.8 mm floor by offsetting the inner bottom fillet", () => {
  assert.doesNotThrow(() => main({ floorThickness: 1.8 }));
});
