import { createTeaBoxHolder, teaBoxHolderOptions } from "./tea-box-holder-shape.js";

export const id = "tea-box-holder";
export const title = "Tea Box Holder";
export const exportFileName = "tea-box-holder.stl";

export const parameters = {
  startSlot: { label: "Start connector", defaultValue: teaBoxHolderOptions.startSlot },
  endPin: { label: "End connector", defaultValue: teaBoxHolderOptions.endPin },
  narrowTop: { label: "Narrow top flange", defaultValue: teaBoxHolderOptions.narrowTop },
};

export const main = (options = {}) => [createTeaBoxHolder(options)];
