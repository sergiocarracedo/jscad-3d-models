import modeling from '@jscad/modeling'
import coasterSvgRaw from '../../losmasguarros-coaster/coasters.svg?raw'

const { booleans, colors, extrusions, primitives, transforms } = modeling

// SVG dimensions from viewBox="0 0 575 575"
const svgWidth = 575
const svgHeight = 575

// Blue layer should be thicker than black details.
const baseThickness = 4.0
const detailThickness = 1.4

// Scale from SVG units to printable millimeters.
const mmPerSvgUnit = 0.18

const svgToModel = (x, y) => [
  (x - svgWidth / 2) * mmPerSvgUnit,
  (svgHeight / 2 - y) * mmPerSvgUnit,
]

const unionAll = (shapes) => {
  const filtered = shapes.filter(Boolean)
  if (filtered.length === 0) return null
  if (filtered.length === 1) return filtered[0]
  return booleans.union(...filtered)
}

const extractLayer2PathData = () => {
  const parser = new DOMParser()
  const svgDoc = parser.parseFromString(coasterSvgRaw, 'image/svg+xml')
  const pathElements = Array.from(svgDoc.querySelectorAll('g#layer2 path'))
  return pathElements
    .map((pathElement) => pathElement.getAttribute('d'))
    .filter((d) => typeof d === 'string' && d.length > 0)
}

const rasterRunsToRectangles = ({ runsByRow, cellSize }) => {
  const active = new Map()
  const rects = []

  const finalizeRow = (nextActive, yRow) => {
    for (const [key, state] of active.entries()) {
      if (!nextActive.has(key)) {
        rects.push({ x1: state.x1, x2: state.x2, y1: state.yStart, y2: yRow })
      }
    }
    active.clear()
    for (const [key, state] of nextActive.entries()) active.set(key, state)
  }

  for (let y = 0; y < runsByRow.length; y += 1) {
    const rowRuns = runsByRow[y]
    const nextActive = new Map()

    for (const run of rowRuns) {
      const key = `${run.x1}:${run.x2}`
      const prev = active.get(key)
      if (prev) {
        nextActive.set(key, { ...prev })
      } else {
        nextActive.set(key, { x1: run.x1, x2: run.x2, yStart: y })
      }
    }

    finalizeRow(nextActive, y)
  }

  for (const state of active.values()) {
    rects.push({ x1: state.x1, x2: state.x2, y1: state.yStart, y2: runsByRow.length })
  }

  return rects
    .map(({ x1, x2, y1, y2 }) => {
      const svgX1 = x1 * cellSize
      const svgX2 = x2 * cellSize
      const svgY1 = y1 * cellSize
      const svgY2 = y2 * cellSize
      const svgCenterX = (svgX1 + svgX2) / 2
      const svgCenterY = (svgY1 + svgY2) / 2

      const [mx, my] = svgToModel(svgCenterX, svgCenterY)
      const width = (svgX2 - svgX1) * mmPerSvgUnit
      const height = (svgY2 - svgY1) * mmPerSvgUnit

      if (width <= 0 || height <= 0) return null
      return transforms.translate([mx, my], primitives.rectangle({ size: [width, height], center: [0, 0] }))
    })
    .filter(Boolean)
}

const createSvgDrivenDetailLayer = () => {
  if (typeof document === 'undefined' || typeof Path2D === 'undefined') return null

  const pathData = extractLayer2PathData()
  if (pathData.length === 0) return null

  const canvas = document.createElement('canvas')
  canvas.width = svgWidth
  canvas.height = svgHeight

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  ctx.clearRect(0, 0, svgWidth, svgHeight)
  ctx.fillStyle = '#000'

  for (const d of pathData) {
    try {
      ctx.fill(new Path2D(d), 'nonzero')
    } catch {
      // Ignore malformed individual paths and continue.
    }
  }

  const pixels = ctx.getImageData(0, 0, svgWidth, svgHeight).data
  const cellSize = 1
  const gridW = Math.ceil(svgWidth / cellSize)
  const gridH = Math.ceil(svgHeight / cellSize)
  const runsByRow = []

  const isFilledCell = (gx, gy) => {
    const px = Math.min(svgWidth - 1, gx * cellSize + Math.floor(cellSize / 2))
    const py = Math.min(svgHeight - 1, gy * cellSize + Math.floor(cellSize / 2))
    const idx = (py * svgWidth + px) * 4
    const alpha = pixels[idx + 3]
    return alpha > 170
  }

  for (let gy = 0; gy < gridH; gy += 1) {
    const runs = []
    let gx = 0
    while (gx < gridW) {
      while (gx < gridW && !isFilledCell(gx, gy)) gx += 1
      if (gx >= gridW) break
      const start = gx
      while (gx < gridW && isFilledCell(gx, gy)) gx += 1
      runs.push({ x1: start, x2: gx })
    }
    runsByRow.push(runs)
  }

  const rects2d = rasterRunsToRectangles({ runsByRow, cellSize })
  const detail2d = unionAll(rects2d)
  if (!detail2d) return null

  const detail3d = extrusions.extrudeLinear({ height: detailThickness }, detail2d)
  return transforms.translate([0, 0, baseThickness], colors.colorize([0.08, 0.08, 0.08, 1], detail3d))
}

const circleAt = (x, y, radius, segments = 120) =>
  transforms.translate([x, y], primitives.circle({ radius, segments }))

const ring2d = (x, y, outerR, innerR, segments = 140) => {
  const outer = circleAt(x, y, outerR, segments)
  const inner = circleAt(x, y, innerR, segments)
  return booleans.subtract(outer, inner)
}

const createBaseLayer = () => {
  const [cx, cy] = svgToModel(287.19812, 288.39883)
  const rx = 262.8519 * mmPerSvgUnit
  const ry = 264.55136 * mmPerSvgUnit

  const base2d = transforms.translate(
    [cx, cy],
    transforms.scale([rx, ry], primitives.circle({ radius: 1, segments: 160 })),
  )

  const base = extrusions.extrudeLinear({ height: baseThickness }, base2d)
  return colors.colorize([0.55, 0.82, 0.94, 1], base)
}

export const main = () => {
  const base = createBaseLayer()
  const svgDetail = createSvgDrivenDetailLayer()

  if (!svgDetail) {
    return [base]
  }

  return [base, svgDetail]
}
