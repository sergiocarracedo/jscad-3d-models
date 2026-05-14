import './styles.css'
import {
  prepareRender,
  drawCommands,
  cameras,
  controls,
  entitiesFromSolids,
} from '@jscad/regl-renderer'
import { main as initialMain } from '../xps-support.js'

const viewerElement = document.querySelector('#viewer')
const statusElement = document.querySelector('#status')

const perspectiveCamera = cameras.perspective
const orbitControls = controls.orbit

const state = {
  camera: { ...perspectiveCamera.defaults },
  controls: { ...orbitControls.defaults },
}

const renderer = prepareRender({
  glOptions: { container: viewerElement },
})

const grid = {
  visuals: { drawCmd: 'drawGrid', show: true },
  size: [200, 200],
  ticks: [20, 5],
}

const axis = {
  visuals: { drawCmd: 'drawAxis', show: true },
  size: 60,
}

const renderOptions = {
  camera: state.camera,
  drawCommands: {
    drawAxis: drawCommands.drawAxis,
    drawGrid: drawCommands.drawGrid,
    drawLines: drawCommands.drawLines,
    drawMesh: drawCommands.drawMesh,
  },
  entities: [grid, axis],
}

let currentMain = initialMain
let needsRender = true
let rotateDelta = [0, 0]
let panDelta = [0, 0]
let zoomDelta = 0
let pointerDown = false
let lastPointer = [0, 0]

const resizeCamera = () => {
  const width = Math.max(viewerElement.clientWidth, 1)
  const height = Math.max(viewerElement.clientHeight, 1)

  perspectiveCamera.setProjection(state.camera, state.camera, { width, height })
  perspectiveCamera.update(state.camera)
  needsRender = true
}

const getSolids = (result) => {
  if (Array.isArray(result)) return result
  if (result == null) return []
  return [result]
}

const renderModel = () => {
  try {
    const solids = getSolids(currentMain())
    const solidEntities = entitiesFromSolids({}, solids)
    renderOptions.entities = [grid, axis, ...solidEntities]

    const fitted = orbitControls.zoomToFit({
      controls: state.controls,
      camera: state.camera,
      entities: solidEntities,
    })

    state.controls = { ...state.controls, ...fitted.controls }
    state.camera = { ...state.camera, ...fitted.camera }
    renderOptions.camera = state.camera

    statusElement.textContent = `Rendered ${solids.length} solid${solids.length === 1 ? '' : 's'}`
    needsRender = true
  } catch (error) {
    statusElement.textContent = error instanceof Error ? error.stack ?? error.message : String(error)
  }
}

const rotateSpeed = 0.01
const panSpeed = 1
const zoomSpeed = 0.08

const updateControls = () => {
  if (rotateDelta[0] || rotateDelta[1]) {
    const updated = orbitControls.rotate(
      { controls: state.controls, camera: state.camera, speed: rotateSpeed },
      rotateDelta,
    )

    state.controls = { ...state.controls, ...updated.controls }
    rotateDelta = [0, 0]
    needsRender = true
  }

  if (panDelta[0] || panDelta[1]) {
    const updated = orbitControls.pan(
      { controls: state.controls, camera: state.camera, speed: panSpeed },
      panDelta,
    )

    state.controls = { ...state.controls, ...updated.controls }
    state.camera.position = updated.camera.position
    state.camera.target = updated.camera.target
    panDelta = [0, 0]
    needsRender = true
  }

  if (zoomDelta) {
    const updated = orbitControls.zoom(
      { controls: state.controls, camera: state.camera, speed: zoomSpeed },
      zoomDelta,
    )

    state.controls = { ...state.controls, ...updated.controls }
    zoomDelta = 0
    needsRender = true
  }

  if (needsRender) {
    const updated = orbitControls.update({ controls: state.controls, camera: state.camera })
    state.controls = { ...state.controls, ...updated.controls }
    state.camera.position = updated.camera.position
    state.camera.view = updated.camera.view
    perspectiveCamera.update(state.camera)
    renderer(renderOptions)
    needsRender = state.controls.changed
  }

  window.requestAnimationFrame(updateControls)
}

viewerElement.addEventListener('pointerdown', (event) => {
  pointerDown = true
  lastPointer = [event.clientX, event.clientY]
  viewerElement.setPointerCapture(event.pointerId)
})

viewerElement.addEventListener('pointermove', (event) => {
  if (!pointerDown) return

  const dx = lastPointer[0] - event.clientX
  const dy = event.clientY - lastPointer[1]
  if (event.shiftKey) {
    panDelta[0] += dx
    panDelta[1] += dy
  } else {
    rotateDelta[0] -= dx
    rotateDelta[1] -= dy
  }

  lastPointer = [event.clientX, event.clientY]
})

const releasePointer = (event) => {
  pointerDown = false
  if (viewerElement.hasPointerCapture(event.pointerId)) {
    viewerElement.releasePointerCapture(event.pointerId)
  }
}

viewerElement.addEventListener('pointerup', releasePointer)
viewerElement.addEventListener('pointercancel', releasePointer)
viewerElement.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault()
    zoomDelta += Math.sign(event.deltaY)
  },
  { passive: false },
)

window.addEventListener('resize', resizeCamera)

resizeCamera()
renderModel()
window.requestAnimationFrame(updateControls)

if (import.meta.hot) {
  import.meta.hot.accept('../xps-support.js', (module) => {
    if (!module?.main) return
    currentMain = module.main
    renderModel()
  })
}
