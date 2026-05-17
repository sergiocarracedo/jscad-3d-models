import modeling from '@jscad/modeling'
import { selectiveRoundedRectanglePoints } from './rounded-corners'
const { booleans, colors, extrusions, primitives, transforms } = modeling

export const startRoundedSlab = (params) => {
  const { start, size, roundedCorners = 'all', borderRadius = 4 } = params
  const [width, depth, height] = size
  const roundRadius = Math.min(borderRadius, width / 2, depth / 2)
  const profile = primitives.polygon({
    points: selectiveRoundedRectanglePoints({
      width,
      depth,
      radius: roundRadius,
      roundedCorners,
    }),
  })
  const slab = extrusions.extrudeLinear({ height }, profile)

  return transforms.translate(start, slab)
}

export const startCuboid = (params) => {
  const { start, size } = params
  // Calculamos el centro basado en el inicio y el tamaño
  const center = [
    start[0] + size[0] / 2,
    start[1] + size[1] / 2,
    start[2] + size[2] / 2,
  ]
  return primitives.cuboid({ ...params, size, center })
}
