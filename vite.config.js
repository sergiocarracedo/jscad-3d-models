import { readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const modelDirectory = fileURLToPath(new URL("./src/models/", import.meta.url));
const modelUpdatedAtId = "virtual:model-updated-at";
const resolvedModelUpdatedAtId = `\0${modelUpdatedAtId}`;

const modelUpdatedAt = () => ({
  name: "model-updated-at",
  resolveId(id) {
    return id === modelUpdatedAtId ? resolvedModelUpdatedAtId : null;
  },
  load(id) {
    if (id !== resolvedModelUpdatedAtId) return null;

    const timestamps = Object.fromEntries(
      readdirSync(modelDirectory)
        .filter((fileName) => fileName.endsWith(".js") && fileName !== "index.js")
        .map((fileName) => [`./${fileName}`, statSync(`${modelDirectory}${fileName}`).mtimeMs]),
    );

    return `export default ${JSON.stringify(timestamps)};`;
  },
  handleHotUpdate({ file, server }) {
    if (!file.startsWith(modelDirectory) || !file.endsWith(".js")) return;

    const module = server.moduleGraph.getModuleById(resolvedModelUpdatedAtId);
    if (module) server.moduleGraph.invalidateModule(module);
  },
});

export default defineConfig({
  plugins: [tailwindcss(), modelUpdatedAt()],
  server: {
    open: "/?model=xps-support",
  },
});
