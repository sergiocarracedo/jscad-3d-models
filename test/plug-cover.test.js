import assert from "node:assert/strict";
import test from "node:test";
import modeling from "@jscad/modeling";
import { dimensions, main } from "../src/models/plug-cover.js";

test("creates a rounded open-top cover around the requested internal dimensions", () => {
  const [cover] = main();
  const [minimum, maximum] = modeling.measurements.measureBoundingBox(cover);

  assert.ok(minimum.every((coordinate) => Math.abs(coordinate) < 0.001));
  assert.ok(Math.abs(maximum[0] - (dimensions.innerWidth + dimensions.wallThickness * 2)) < 0.001);
  assert.ok(Math.abs(maximum[1] - (dimensions.innerDepth + dimensions.wallThickness * 2)) < 0.001);
  assert.ok(Math.abs(maximum[2] - (dimensions.innerHeight + dimensions.floorThickness)) < 0.001);
});

test("adds recessed pads at each internal corner", () => {
  const [cover] = main();
  const [shorterPads] = main({ cornerPadHeight: 2.5 });

  assert.ok(
    modeling.measurements.measureVolume(cover) > modeling.measurements.measureVolume(shorterPads),
  );
});

test("cuts a 10 mm top notch in the +Y wall", () => {
  const [cover] = main();
  const [smallerOpening] = main({ topWallOpeningSize: 7 });

  assert.ok(
    modeling.measurements.measureVolume(cover) <
      modeling.measurements.measureVolume(smallerOpening),
  );
});
