import modeling from "@jscad/modeling";
import opentype from "opentype.js";
import { createTextSolid } from "../utils/text-geometry.js";

export { createTextSolid, textContours } from "../utils/text-geometry.js";

export const id = "text";
export const title = "Custom Text";
export const exportFileName = "custom-text.stl";

// Edit these values, then save to update the preview.
const text = "DARIO";
const fontSizeMm = 10;
const heightMm = 2;
const fontUrl = new URL("./assets/Lato-Regular.ttf", import.meta.url);
let fontPromise;

const loadFont = () => {
  fontPromise ??= fetch(fontUrl)
    .then((response) => {
      if (!response.ok)
        throw new Error(`Could not load the bundled Lato font (${response.status}).`);
      return response.arrayBuffer();
    })
    .then((fontData) => opentype.parse(fontData));
  return fontPromise;
};

export const main = async () => {
  const solid = createTextSolid({
    font: await loadFont(),
    value: text,
    fontSizeMm,
    extrusionHeightMm: heightMm,
  });
  return solid ? [modeling.colors.colorize([0.12, 0.36, 0.9, 1], solid)] : [];
};
