import {
  cameras,
  controls,
  drawCommands,
  entitiesFromSolids,
  prepareRender,
} from '@jscad/regl-renderer'
import {
  serialize as serializeStl,
  mimeType as stlMimeType,
} from '@jscad/stl-serializer'
import {
  getDefaultModelId,
  getModelById,
  getModelList,
} from './models/index.js'
import './styles.css'

const viewerElement = document.querySelector('#viewer')
const statusElement = document.querySelector('#status')
const exportButton = document.querySelector('#export-stl')
const modelTitleElement = document.querySelector('#model-title')
const modelDescriptionElement = document.querySelector('#model-description')
const modelSelectElement = document.querySelector('#model-select')
const modelListElement = document.querySelector('#model-list')

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

const MODEL_QUERY_PARAM = 'model'

let currentModel = null
let currentMain = null
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

const downloadBlob = ({ blob, fileName }) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = fileName
  link.click()

  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

const executeCurrentMain = ({ includeGuides }) => {
  if (!currentMain || !currentModel) return []
  if (currentModel.supportsIncludeGuides) {
    return currentMain({ includeGuides })
  }
  return currentMain()
}

const exportCurrentModelAsStl = async () => {
  if (!exportButton || !currentModel) return

  exportButton.disabled = true
  exportButton.textContent = 'Exporting...'

  try {
    const solids = getSolids(executeCurrentMain({ includeGuides: false }))

    if (solids.length === 0) {
      statusElement.textContent = 'Nothing to export.'
      return
    }

    const stlChunks = serializeStl({ binary: true }, ...solids)
    const blob = new Blob(stlChunks, { type: stlMimeType })

    downloadBlob({ blob, fileName: currentModel.exportFileName })
    statusElement.textContent = `Exported ${solids.length} solid${solids.length === 1 ? '' : 's'} to STL`
  } catch (error) {
    statusElement.textContent =
      error instanceof Error ? (error.stack ?? error.message) : String(error)
  } finally {
    exportButton.disabled = false
    exportButton.textContent = 'Export STL'
  }
}

const renderModel = () => {
  try {
    const solids = getSolids(executeCurrentMain({ includeGuides: true }))
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
    statusElement.textContent =
      error instanceof Error ? (error.stack ?? error.message) : String(error)
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
    const updated = orbitControls.update({
      controls: state.controls,
      camera: state.camera,
    })
    state.controls = { ...state.controls, ...updated.controls }
    state.camera.position = updated.camera.position
    state.camera.view = updated.camera.view
    perspectiveCamera.update(state.camera)
    renderer(renderOptions)
    needsRender = state.controls.changed
  }

  window.requestAnimationFrame(updateControls)
}

const getModelIdFromUrl = () => {
  const params = new URLSearchParams(window.location.search)
  return params.get(MODEL_QUERY_PARAM)
}

const setModelIdInUrl = ({ modelId, replaceHistory = false }) => {
  const url = new URL(window.location.href)
  url.searchParams.set(MODEL_QUERY_PARAM, modelId)

  if (replaceHistory) {
    window.history.replaceState({ modelId }, '', url)
    return
  }

  window.history.pushState({ modelId }, '', url)
}

const updateModelChooserUi = ({ activeModelId }) => {
  const models = getModelList()

  if (modelSelectElement) {
    modelSelectElement.innerHTML = models
      .map((model) => {
        const selected = model.id === activeModelId ? ' selected' : ''
        return `<option value="${model.id}"${selected}>${model.title}</option>`
      })
      .join('')
  }

  if (modelListElement) {
    modelListElement.innerHTML = models
      .map((model) => {
        const activeClass = model.id === activeModelId ? ' is-active' : ''
        return `<button type="button" class="model-link${activeClass}" data-model-id="${model.id}">${model.title}</button>`
      })
      .join('')
  }
}

const updateModelCopy = ({ model }) => {
  if (modelTitleElement) modelTitleElement.textContent = model.title

  if (modelDescriptionElement) {
    modelDescriptionElement.innerHTML = `Edit <code>src/models/${model.id}.js</code> and the viewer updates in real time.`
  }
}

const switchToModel = ({
  requestedModelId,
  replaceHistory = false,
  skipUrlUpdate = false,
}) => {
  const fallbackId = getDefaultModelId()
  const nextModel = getModelById(requestedModelId) ?? getModelById(fallbackId)

  if (!nextModel) {
    statusElement.textContent = 'No models found in src/models.'
    return
  }

  currentModel = nextModel
  currentMain = nextModel.main

  updateModelChooserUi({ activeModelId: nextModel.id })
  updateModelCopy({ model: nextModel })

  if (!skipUrlUpdate) {
    setModelIdInUrl({ modelId: nextModel.id, replaceHistory })
  }

  renderModel()
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

modelSelectElement?.addEventListener('change', (event) => {
  const modelId = event.target.value
  switchToModel({ requestedModelId: modelId })
})

modelListElement?.addEventListener('click', (event) => {
  const target = event.target
  if (!(target instanceof HTMLButtonElement)) return

  const modelId = target.dataset.modelId
  if (!modelId) return

  switchToModel({ requestedModelId: modelId })
})

window.addEventListener('popstate', () => {
  switchToModel({
    requestedModelId: getModelIdFromUrl(),
    skipUrlUpdate: true,
  })
})

resizeCamera()
switchToModel({
  requestedModelId: getModelIdFromUrl(),
  replaceHistory: true,
})
window.requestAnimationFrame(updateControls)

exportButton?.addEventListener('click', () => {
  void exportCurrentModelAsStl()
})
