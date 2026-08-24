# jscad-3d-models

Parametric 3D models defined with [OpenJSCAD](https://openjscad.xyz/), served via a
small Vite-powered viewer with one-click STL export.

The viewer is a single-page app: pick a model from the dropdown, orbit/pan/zoom the
preview, and export the result to STL for slicing. Each model is a self-contained
`.js` file under `src/models/` — drop a new one in, and it shows up automatically.

## Quick start

```bash
pnpm install
pnpm dev
```

Vite starts on `http://localhost:5173/`. The default model is `xps-support`; pick
another one from the dropdown. The current selection is reflected in the URL
(`?model=<id>`) and the camera state is persisted per model in `localStorage`.

### Other scripts

| Command          | What it does                       |
| ---------------- | ---------------------------------- |
| `pnpm dev`       | Start the viewer (HMR).            |
| `pnpm build`     | Build the production bundle.       |
| `pnpm preview`   | Preview the built bundle.          |
| `pnpm format`    | Run `oxfmt` over the sources.      |

## Available models

| ID                      | Title                  | Description |
| ----------------------- | ---------------------- | ----------- |
| `coasters`              | Coasters               | SVG-engraved round coasters (4-up tiles driven by `coaster-assets/coasters.svg`). |
| `xps-support`           | XPS Support            | Bracket for XPS foam panels with lightening cutouts and screw guides. |
| `hyperx`                | HyperX                 | Desk-clamp holder for a HyperX capture card. |
| `hyperx-under-desktop`  | HyperX-Under-Desktop   | Same card holder, mounted under the desk with through-bolts. |
| `hub-support`           | Hub Support            | Pedestal-style dock for a USB hub, with ventilation holes. |
| `bar-bin`               | Bar Bin                | Pegboard-mounted bar/shelf with J-hook clips on the front lip. |
| `bedroom`               | Bedroom                | Stylized room shell — walls, floor and furniture blocks for layout previews. |
| `tea-box-holder`        | Tea Box Holder         | Counter-mount pin rail designed to keep a tea box from sliding off the edge. |
| `tea-box-holder-end`    | Tea Box Holder End     | End cap that pairs with `tea-box-holder` to close the rail. |

## Add a new model

1. Create `src/models/<id>.js` — the filename (minus the `.js` extension) becomes
   the default model ID.
2. Export the following from that file:

   ```js
   export const id = '<id>'                   // optional — defaults to the filename
   export const title = '<Human readable>'    // optional — defaults to a title-cased filename
   export const exportFileName = '<id>.stl'   // optional — defaults to "<id>.stl"

   // Optional — when true, the viewer passes { includeGuides: true } while
   // previewing and { includeGuides: false } while exporting to STL. Use this
   // for print guides (screw holes, registration marks, etc.) you only want to
   // see in the viewer.
   export const supportsIncludeGuides = true

   // Required. Return one geometry, an array of geometries, or an empty array.
   // Each geometry must be a value from `@jscad/modeling` (`primitives`, `booleans`, etc.).
   export const main = ({ includeGuides = true } = {}) => {
     // ...
     return geometry
   }
   ```

3. Save — the viewer hot-reloads and the new model appears in the dropdown.

### Conventions

- All dimensions are in **millimeters**.
- Define your tuning knobs as `const` values at the top of the file so a print
  re-run is a one-line edit (see `src/models/xps-support.js` for a worked
  example).
- Reuse `startCuboid`, `startRoundedSlab` and `startRib` from
  `src/utils/shape-helpers.js` instead of reaching into `@jscad/modeling`
  directly — it keeps corner rounding, ribs and registration marks consistent
  across models.

### Embed an SVG

Anything that needs to read an SVG does it via Vite's `?raw` import:

```js
import svgRaw from '../../<folder>/<file>.svg?raw'
```

`s/`src/models/coasters.js` shows the full pipeline (parse → 2D shapes →
engrave onto an extruded base).

## Export to STL

Use the **Export STL** button in the sidebar. The STL is generated client-side
via `@jscad/stl-serializer` in binary format and triggers a normal browser
download. If your model declares `supportsIncludeGuides = true`, guides are
stripped from the export.

## Project structure

```
.
├── index.html              # Vite entry point, hosts <div id="viewer">
├── vite.config.js          # Vite config (opens with ?model=xps-support)
├── package.json
├── src/
│   ├── main.js             # Viewer + camera controls + STL export
│   ├── styles.css
│   ├── models/
│   │   ├── index.js        # Auto-discovers every .js file in this folder
│   │   ├── xps-support.js
│   │   ├── hyperx.js
│   │   └── …
│   └── utils/
│       ├── shape-helpers.js
│       └── rounded-corners.js
└── coaster-assets/
    └── coasters.svg        # SVG source consumed by the `coasters` model
```

## License

ISC. See [`LICENSE`](./LICENSE) if present, otherwise the `license` field in
`package.json` applies.

## Credits

- [OpenJSCAD](https://openjscad.xyz/) (`@jscad/modeling`, `@jscad/regl-renderer`,
  `@jscad/stl-serializer`) — geometry kernel, WebGL renderer, STL encoder.
- [Vite](https://vitejs.dev/) — dev server / bundler.
