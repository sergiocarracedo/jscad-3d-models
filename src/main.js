import {
  cameras,
  controls,
  drawCommands,
  entitiesFromSolids,
  prepareRender,
} from "@jscad/regl-renderer";
import { serialize as serializeStl, mimeType as stlMimeType } from "@jscad/stl-serializer";
import { serialize as serialize3mf, mimeType as threeMfMimeType } from "@jscad/3mf-serializer";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { SideMenu } from "./SideMenu.jsx";
import { getDefaultModelId, getModelById, getModelList } from "./models/index.js";
import "./styles.css";

const viewerElement = document.querySelector("#viewer");
const sideMenuRoot = createRoot(document.querySelector("#side-menu"));

const perspectiveCamera = cameras.perspective;
const orbitControls = controls.orbit;

const state = {
  camera: { ...perspectiveCamera.defaults },
  controls: { ...orbitControls.defaults },
};

const renderer = prepareRender({
  glOptions: { container: viewerElement },
});

const grid = {
  visuals: { drawCmd: "drawGrid", show: true },
  size: [200, 200],
  ticks: [20, 5],
};

const axis = {
  visuals: { drawCmd: "drawAxis", show: true },
  size: 60,
};

const renderOptions = {
  camera: state.camera,
  drawCommands: {
    drawAxis: drawCommands.drawAxis,
    drawGrid: drawCommands.drawGrid,
    drawLines: drawCommands.drawLines,
    drawMesh: drawCommands.drawMesh,
  },
  entities: [grid, axis],
};

const MODEL_QUERY_PARAM = "model";
const CAMERA_STORAGE_PREFIX = "jscad-viewer-camera:";

let currentModel = null;
let currentMain = null;
let currentParameters = {};
let needsRender = true;
let rotateDelta = [0, 0];
let panDelta = [0, 0];
let zoomDelta = 0;
let pointerDown = false;
let pointerPans = false;
let lastPointer = [0, 0];
let lastCameraSaveAt = 0;
let statusMessage = "Rendering model...";

const renderSideMenu = () => {
  sideMenuRoot.render(
    createElement(SideMenu, {
      model: currentModel,
      models: getModelList(),
      status: statusMessage,
      onExport3mf: export3mf,
      onExportStl: exportStl,
      onResetCamera: resetCamera,
      onSelect: (modelId) => switchToModel({ requestedModelId: modelId }),
      onParameterChange: setParameter,
      parameters: currentParameters,
    }),
  );
};

const setStatus = (message) => {
  statusMessage = message;
  renderSideMenu();
};

const getCameraStorageKey = (modelId) => `${CAMERA_STORAGE_PREFIX}${modelId}`;

const clearModelCameraState = ({ modelId }) => {
  if (!modelId) return;

  try {
    window.localStorage.removeItem(getCameraStorageKey(modelId));
  } catch {
    // Ignore storage errors.
  }
};

const saveModelCameraState = ({ modelId }) => {
  if (!modelId) return;

  const payload = {
    camera: {
      position: [...state.camera.position],
      target: [...state.camera.target],
    },
  };

  try {
    window.localStorage.setItem(getCameraStorageKey(modelId), JSON.stringify(payload));
  } catch {
    // Ignore storage errors (private mode, quota exceeded, etc.).
  }
};

const loadModelCameraState = ({ modelId }) => {
  if (!modelId) return null;

  try {
    const raw = window.localStorage.getItem(getCameraStorageKey(modelId));
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed?.camera || !Array.isArray(parsed.camera.target)) return null;

    return parsed;
  } catch {
    return null;
  }
};

const restoreModelCameraState = ({ modelId }) => {
  const savedState = loadModelCameraState({ modelId });
  if (!savedState) return false;

  const isCameraVector = (value) =>
    Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);

  if (!isCameraVector(savedState.camera.target)) return false;
  state.camera.target = [...savedState.camera.target];

  if (isCameraVector(savedState.camera.position)) {
    state.camera.position = [...savedState.camera.position];
    // Position and target encode direction and zoom. Clear inertia/scale so the
    // orbit update preserves that exact view rather than applying it twice.
    state.controls.thetaDelta = 0;
    state.controls.phiDelta = 0;
    state.controls.scale = 1;
  } else {
    // Compatibility with older saved entries that stored orbit parameters.
    if (Array.isArray(savedState.controls?.angles)) {
      state.controls.angles = savedState.controls.angles;
    }
    if (Number.isFinite(savedState.controls?.distance)) {
      state.controls.distance = savedState.controls.distance;
    }
  }

  // Rebuild view from the restored position and target, then force a render.
  const updated = orbitControls.update({
    controls: state.controls,
    camera: state.camera,
  });
  state.camera.position = updated.camera.position;
  state.camera.view = updated.camera.view;
  state.controls = { ...state.controls, ...updated.controls };

  renderOptions.camera = state.camera;
  perspectiveCamera.update(state.camera);
  needsRender = true;
  return true;
};

const resizeCamera = () => {
  const width = Math.max(viewerElement.clientWidth, 1);
  const height = Math.max(viewerElement.clientHeight, 1);

  perspectiveCamera.setProjection(state.camera, state.camera, { width, height });
  perspectiveCamera.update(state.camera);
  needsRender = true;
};

const getSolids = (result) => {
  if (Array.isArray(result)) return result;
  if (result == null) return [];
  return [result];
};

const downloadBlob = ({ blob, fileName }) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.click();

  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

const xmlEscape = (value) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[char],
  );

const serializeColored3mf = (solids, modelName) => {
  const [archive] = serialize3mf({}, ...solids);
  const files = unzipSync(new Uint8Array(archive));
  const modelPath = "3D/3dmodel.model";
  const coreNamespace = "http://schemas.microsoft.com/3dmanufacturing/core/2015/02";
  const productionNamespace = "http://schemas.microsoft.com/3dmanufacturing/production/2015/06";
  const bambuNamespace = "http://schemas.bambulab.com/package/2021";
  const xmlNamespace = "http://www.w3.org/2000/xmlns/";
  // Inject namespaces in the raw XML *before* parsing so every element is
  // properly namespace-aware (setAttribute("xmlns") after parsing does NOT
  // re-namespace existing nodes and breaks serialization).
  const document = new DOMParser().parseFromString(
    strFromU8(files[modelPath]).replace("<model ", `<model xmlns="${coreNamespace}" `),
    "application/xml",
  );
  if (document.querySelector("parsererror")) {
    throw new Error("Could not create 3MF");
  }

  const modelElement = document.getElementsByTagName("model")[0];
  modelElement.setAttributeNS(xmlNamespace, "xmlns:p", productionNamespace);
  modelElement.setAttributeNS(xmlNamespace, "xmlns:BambuStudio", bambuNamespace);
  modelElement.setAttribute("requiredextensions", "p");
  const versionMetadata = document.createElementNS(coreNamespace, "metadata");
  versionMetadata.setAttribute("name", "BambuStudio:3mfVersion");
  versionMetadata.textContent = "1";
  modelElement.insertBefore(versionMetadata, modelElement.firstChild);
  for (const metadata of document.getElementsByTagName("metadata")) {
    if (metadata.getAttribute("name") === "Application") {
      metadata.textContent = "OrcaSlicer-2.4.2";
    }
  }
  const resources = document.getElementsByTagName("resources")[0];

  const meshObjects = Array.from(resources.getElementsByTagName("object")).filter(
    (object) => object.getElementsByTagName("mesh").length > 0,
  );
  for (const basematerials of [...resources.getElementsByTagName("basematerials")]) {
    basematerials.remove();
  }

  const colorGroups = new Map();
  const extruderFor = (solid) => {
    const color = solid?.color ?? [1, 0.625, 0, 1];
    const hex = `#${color
      .slice(0, 3)
      .map((channel) =>
        Math.round(channel * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")}`;
    if (!colorGroups.has(hex)) colorGroups.set(hex, colorGroups.size + 1);
    return colorGroups.get(hex);
  };

  // Match Orca/Bambu's Production-extension layout: child meshes live in an
  // external model part and the main model contains only their assembly.
  const parts = meshObjects.map((object, index) => {
    const id = String(index + 1);
    object.setAttribute("id", id);
    object.removeAttribute("pid");
    object.removeAttribute("pindex");
    return {
      id,
      name: object.getAttribute("name") ?? `Part ${index + 1}`,
      extruder: extruderFor(solids[index]),
    };
  });

  // JSCAD models are commonly centered around the origin. Since these
  // components use identity transforms, move the complete assembly into the
  // positive 3MF coordinate octant.
  const vertices = meshObjects.flatMap((object) =>
    Array.from(object.getElementsByTagName("vertex")),
  );
  if (vertices.length === 0) throw new Error("Could not create 3MF without vertices");
  const minimum = ["x", "y", "z"].map((axis) =>
    Math.min(...vertices.map((vertex) => Number(vertex.getAttribute(axis)))),
  );

  const externalDocument = new DOMParser().parseFromString(
    `<?xml version="1.0" encoding="UTF-8"?>\n<model xmlns="${coreNamespace}" xmlns:p="${productionNamespace}" xmlns:BambuStudio="${bambuNamespace}" unit="millimeter" xml:lang="en-US" requiredextensions="p"><metadata name="BambuStudio:3mfVersion">1</metadata><resources/><build/></model>`,
    "application/xml",
  );
  const externalModel = externalDocument.getElementsByTagName("model")[0];
  const externalResources = externalDocument.getElementsByTagName("resources")[0];
  const setProductionAttribute = (element, name, value) =>
    element.setAttributeNS(productionNamespace, `p:${name}`, value);

  vertices.forEach((vertex) => {
    ["x", "y", "z"].forEach((axis, index) => {
      vertex.setAttribute(axis, String(Number(vertex.getAttribute(axis)) - minimum[index]));
    });
  });

  meshObjects.forEach((object) => {
    setProductionAttribute(object, "UUID", crypto.randomUUID());
    externalResources.append(externalDocument.importNode(object, true));
    object.remove();
  });

  const buildObjectId = String(parts.length + 1);
  const assembly = document.createElementNS(coreNamespace, "object");
  const components = document.createElementNS(coreNamespace, "components");
  assembly.setAttribute("id", buildObjectId);
  assembly.setAttribute("type", "model");
  assembly.setAttribute("name", modelName);
  setProductionAttribute(assembly, "UUID", crypto.randomUUID());
  for (const part of parts) {
    const component = document.createElementNS(coreNamespace, "component");
    component.setAttribute("objectid", part.id);
    component.setAttribute("transform", "1 0 0 0 1 0 0 0 1 0 0 0");
    setProductionAttribute(component, "path", "/3D/Objects/object_1.model");
    setProductionAttribute(component, "UUID", crypto.randomUUID());
    components.append(component);
  }
  assembly.append(components);
  resources.append(assembly);

  const build = document.getElementsByTagName("build")[0];
  const item = document.createElementNS(coreNamespace, "item");
  item.setAttribute("objectid", buildObjectId);
  item.setAttribute("printable", "1");
  setProductionAttribute(item, "UUID", crypto.randomUUID());
  build.replaceChildren(item);

  const modelConfig = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<config>",
    `  <object id="${buildObjectId}">`,
    `    <metadata key="name" value="${xmlEscape(modelName)}"/>`,
    `    <metadata key="extruder" value="1"/>`,
    ...parts.map((part, index) =>
      [
        `    <part id="${part.id}" subtype="normal_part">`,
        `      <metadata key="name" value="${xmlEscape(part.name)}"/>`,
        `      <metadata key="source_object_id" value="${index}"/>`,
        `      <metadata key="source_volume_id" value="0"/>`,
        `      <metadata key="extruder" value="${part.extruder}"/>`,
        `    </part>`,
      ].join("\n"),
    ),
    "  </object>",
    "</config>",
  ].join("\n");
  const projectConfig = JSON.stringify({
    filament_colour: [...colorGroups.entries()].map(([hex]) => hex),
  });

  files["3D/Objects/object_1.model"] = strToU8(
    new XMLSerializer().serializeToString(externalModel),
  );
  files["3D/_rels/3dmodel.model.rels"] = strToU8(
    `<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/Objects/object_1.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`,
  );
  files["Metadata/model_settings.config"] = strToU8(modelConfig);
  files["Metadata/project_settings.config"] = strToU8(projectConfig);

  files[modelPath] = strToU8(new XMLSerializer().serializeToString(document));
  return [zipSync(files)];
};

const executeCurrentMain = async ({ includeGuides }) => {
  if (!currentMain || !currentModel) return [];
  const options = { ...currentParameters };
  if (currentModel.supportsIncludeGuides) options.includeGuides = includeGuides;
  return Object.keys(options).length === 0 ? await currentMain() : await currentMain(options);
};

const exportCurrentModel = async ({ format, fileName, mimeType, serialize }) => {
  if (!currentModel) return;

  try {
    const solids = getSolids(await executeCurrentMain({ includeGuides: false }));

    if (solids.length === 0) {
      setStatus("Nothing to export.");
      return;
    }

    const blob = new Blob(serialize(solids), { type: mimeType });

    downloadBlob({ blob, fileName });
    setStatus(`Exported ${solids.length} part${solids.length === 1 ? "" : "s"} to ${format}`);
  } catch (error) {
    setStatus(error instanceof Error ? (error.stack ?? error.message) : String(error));
  }
};

const renderModel = async () => {
  try {
    const modelBeingRendered = currentModel;
    const solids = getSolids(await executeCurrentMain({ includeGuides: true }));
    if (currentModel !== modelBeingRendered) return;
    const solidEntities = entitiesFromSolids({}, solids);
    renderOptions.entities = [grid, axis, ...solidEntities];

    const fitted = orbitControls.zoomToFit({
      controls: state.controls,
      camera: state.camera,
      entities: solidEntities,
    });

    state.controls = { ...state.controls, ...fitted.controls };
    state.camera = { ...state.camera, ...fitted.camera };
    renderOptions.camera = state.camera;

    setStatus(`Rendered ${solids.length} solid${solids.length === 1 ? "" : "s"}`);
    needsRender = true;
  } catch (error) {
    setStatus(error instanceof Error ? (error.stack ?? error.message) : String(error));
  }
};

const rotateSpeed = 0.01;
const panSpeed = 1;
const zoomSpeed = 0.08;

const updateControls = () => {
  if (rotateDelta[0] || rotateDelta[1]) {
    const updated = orbitControls.rotate(
      { controls: state.controls, camera: state.camera, speed: rotateSpeed },
      rotateDelta,
    );

    state.controls = { ...state.controls, ...updated.controls };
    rotateDelta = [0, 0];
    needsRender = true;
  }

  if (panDelta[0] || panDelta[1]) {
    const updated = orbitControls.pan(
      { controls: state.controls, camera: state.camera, speed: panSpeed },
      panDelta,
    );

    state.controls = { ...state.controls, ...updated.controls };
    state.camera.position = updated.camera.position;
    state.camera.target = updated.camera.target;
    panDelta = [0, 0];
    needsRender = true;
  }

  if (zoomDelta) {
    const updated = orbitControls.zoom(
      { controls: state.controls, camera: state.camera, speed: zoomSpeed },
      zoomDelta,
    );

    state.controls = { ...state.controls, ...updated.controls };
    zoomDelta = 0;
    needsRender = true;
  }

  if (needsRender) {
    const updated = orbitControls.update({
      controls: state.controls,
      camera: state.camera,
    });
    state.controls = { ...state.controls, ...updated.controls };
    state.camera.position = updated.camera.position;
    state.camera.view = updated.camera.view;
    perspectiveCamera.update(state.camera);
    renderer(renderOptions);
    needsRender = state.controls.changed;

    if (currentModel && state.controls.changed) {
      const now = Date.now();
      if (now - lastCameraSaveAt >= 250) {
        saveModelCameraState({ modelId: currentModel.id });
        lastCameraSaveAt = now;
      }
    }
  }

  window.requestAnimationFrame(updateControls);
};

const getModelIdFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get(MODEL_QUERY_PARAM);
};

const getParametersFromUrl = (model) => {
  if (!model?.parameters) return {};

  const url = new URL(window.location.href);
  return Object.fromEntries(
    Object.entries(model.parameters).map(([key, definition]) => [
      key,
      url.searchParams.get(key) === null
        ? definition.defaultValue
        : url.searchParams.get(key) === "true",
    ]),
  );
};

const setModelIdInUrl = ({ modelId, replaceHistory = false }) => {
  const url = new URL(window.location.href);
  url.searchParams.set(MODEL_QUERY_PARAM, modelId);
  for (const key of Object.keys(currentModel?.parameters ?? {})) {
    url.searchParams.set(key, String(currentParameters[key]));
  }

  if (replaceHistory) {
    window.history.replaceState({ modelId }, "", url);
    return;
  }

  window.history.pushState({ modelId }, "", url);
};

const switchToModel = ({ requestedModelId, replaceHistory = false, skipUrlUpdate = false }) => {
  const fallbackId = getDefaultModelId();
  const nextModel = getModelById(requestedModelId) ?? getModelById(fallbackId);

  if (!nextModel) {
    setStatus("No models found in src/models.");
    return;
  }

  if (currentModel?.id) {
    saveModelCameraState({ modelId: currentModel.id });
  }

  currentModel = nextModel;
  currentMain = nextModel.main;
  currentParameters = getParametersFromUrl(nextModel);

  renderSideMenu();

  if (!skipUrlUpdate) {
    setModelIdInUrl({ modelId: nextModel.id, replaceHistory });
  }

  renderModel().then(() => {
    // Rendering fits the model to the camera. Restore persisted state afterward
    // so that the fit operation cannot overwrite the saved view.
    if (currentModel === nextModel) {
      restoreModelCameraState({ modelId: nextModel.id });
    }
  });
};

function setParameter(key, value) {
  if (!currentModel?.parameters?.[key]) return;

  currentParameters = { ...currentParameters, [key]: value };
  setModelIdInUrl({ modelId: currentModel.id });
  renderSideMenu();
  renderModel();
}

viewerElement.addEventListener("pointerdown", (event) => {
  pointerDown = true;
  pointerPans = event.button === 1 || event.shiftKey;
  lastPointer = [event.clientX, event.clientY];
  event.preventDefault();
  viewerElement.setPointerCapture(event.pointerId);
});

viewerElement.addEventListener("pointermove", (event) => {
  if (!pointerDown) return;

  const dx = lastPointer[0] - event.clientX;
  const dy = event.clientY - lastPointer[1];
  if (pointerPans || event.shiftKey) {
    panDelta[0] += dx;
    panDelta[1] += dy;
  } else {
    rotateDelta[0] -= dx;
    rotateDelta[1] -= dy;
  }

  lastPointer = [event.clientX, event.clientY];
});

const releasePointer = (event) => {
  pointerDown = false;
  pointerPans = false;
  if (viewerElement.hasPointerCapture(event.pointerId)) {
    viewerElement.releasePointerCapture(event.pointerId);
  }
};

viewerElement.addEventListener("pointerup", releasePointer);
viewerElement.addEventListener("pointercancel", releasePointer);
viewerElement.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    zoomDelta += Math.sign(event.deltaY);
  },
  { passive: false },
);

window.addEventListener("resize", resizeCamera);

window.addEventListener("popstate", () => {
  switchToModel({
    requestedModelId: getModelIdFromUrl(),
    skipUrlUpdate: true,
  });
});

resizeCamera();
switchToModel({
  requestedModelId: getModelIdFromUrl(),
  replaceHistory: true,
});
window.requestAnimationFrame(updateControls);

function export3mf() {
  exportCurrentModel({
    format: "3MF",
    fileName: `${currentModel.id}.3mf`,
    mimeType: threeMfMimeType,
    serialize: (solids) => serializeColored3mf(solids, currentModel.title),
  });
}

function exportStl() {
  exportCurrentModel({
    format: "STL",
    fileName: currentModel.exportFileName,
    mimeType: stlMimeType,
    serialize: (solids) => serializeStl({ binary: true }, ...solids),
  });
}

function resetCamera() {
  if (!currentModel?.id) return;

  clearModelCameraState({ modelId: currentModel.id });
  state.camera = { ...perspectiveCamera.defaults };
  state.controls = { ...orbitControls.defaults };
  renderOptions.camera = state.camera;
  const modelId = currentModel.id;
  renderModel().then(() => {
    if (currentModel?.id === modelId) saveModelCameraState({ modelId });
  });
  setStatus(`Camera reset for ${currentModel.title}`);
}

window.addEventListener("beforeunload", () => {
  if (!currentModel?.id) return;
  saveModelCameraState({ modelId: currentModel.id });
});
