import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import modeling from "@jscad/modeling";
import opentype from "opentype.js";
import { createTextSolid, textContours } from "../src/utils/text-geometry.js";

const fontData = await readFile(new URL("../src/models/assets/Lato-Regular.ttf", import.meta.url));
const font = opentype.parse(
  fontData.buffer.slice(fontData.byteOffset, fontData.byteOffset + fontData.byteLength),
);

test("creates filled, smooth TrueType text with counters", () => {
  const [outer, counter] = textContours(font, "D", 42);
  const solid = createTextSolid({ font, value: "Dario", extrusionHeightMm: 2 });
  const [minimum, maximum] = modeling.measurements.measureBoundingBox(solid);

  assert.ok(outer.length > 32, "curves should be tessellated smoothly");
  assert.ok(counter.length > 16, "glyph counters should retain their curved outlines");
  assert.ok(maximum[0] - minimum[0] > 20, "the full word should use the font's real proportions");
  assert.equal(maximum[2] - minimum[2], 2, "text should have the configured extrusion height");
});

test("fits text to a requested width without changing its proportions", () => {
  const natural = createTextSolid({ font, value: "Dario" });
  const fitted = createTextSolid({ font, value: "Dario", widthMm: 60 });
  const [naturalMinimum, naturalMaximum] = modeling.measurements.measureBoundingBox(natural);
  const [fittedMinimum, fittedMaximum] = modeling.measurements.measureBoundingBox(fitted);

  const naturalRatio =
    (naturalMaximum[0] - naturalMinimum[0]) / (naturalMaximum[1] - naturalMinimum[1]);
  const fittedRatio = (fittedMaximum[0] - fittedMinimum[0]) / (fittedMaximum[1] - fittedMinimum[1]);
  assert.equal(fittedMaximum[0] - fittedMinimum[0], 60);
  assert.ok(Math.abs(fittedRatio - naturalRatio) < 0.0001);
});

test("does not allow contradictory width and height fitting", () => {
  assert.throws(() => createTextSolid({ font, value: "Dario", widthMm: 60, heightMm: 20 }));
});
