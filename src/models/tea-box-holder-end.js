import { createTeaBoxHolder } from "./tea-box-holder-shape.js";

export const id = "tea-box-holder-end";
export const title = "Tea Box Holder End";
export const exportFileName = "tea-box-holder-end.stl";

const endLength = 1;

export const main = () => [
  createTeaBoxHolder({
    length: endLength,
    startSlot: false,
    endPin: true,
    screwHoles: false,
  }),
];
