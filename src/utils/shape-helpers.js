import modeling from '@jscad/modeling'
import { selectiveRoundedRectanglePoints } from './rounded-corners'
const { booleans, colors, extrusions, primitives, transforms } = modeling

const ribCurveDirectionByPosition = {
  'bottom-left': { x: -1, z: -1 },
  'bottom-right': { x: 1, z: -1 },
  'top-left': { x: -1, z: 1 },
  'top-right': { x: 1, z: 1 },
}

const resolveRibDimensions = ({ size, sizeX, sizeZ }) => {
  const resolvedSizeX = sizeX ?? size
  const resolvedSizeZ = sizeZ ?? size

  if (!resolvedSizeX || resolvedSizeX <= 0) {
    throw new Error('Rib sizeX must be > 0')
  }
  if (!resolvedSizeZ || resolvedSizeZ <= 0) {
    throw new Error('Rib sizeZ must be > 0')
  }

  return {
    sizeX: resolvedSizeX,
    sizeZ: resolvedSizeZ,
  }
}

const polygonSignedArea = (points) => {
  let area = 0

  for (let index = 0; index < points.length; index += 1) {
    const [x1, y1] = points[index]
    const [x2, y2] = points[(index + 1) % points.length]
    area += x1 * y2 - x2 * y1
  }

  return area / 2
}

const ribProfilePoints = ({
  start,
  sizeX,
  sizeZ,
  curvePosition,
  profile = 'curved',
  segments = 16,
}) => {
  const direction = ribCurveDirectionByPosition[curvePosition]
  if (!direction) {
    throw new Error(`Invalid curvePosition: ${curvePosition}`)
  }

  const [startX, , startZ] = start
  const centerX = startX + direction.x * sizeX
  const centerZ = startZ + direction.z * sizeZ

  const points = [
    [startX, startZ],
    [startX, centerZ],
  ]

  if (profile === 'flat') {
    points.push([centerX, startZ])

    if (polygonSignedArea(points) < 0) {
      points.reverse()
    }

    return points
  }

  if (profile !== 'curved') {
    throw new Error(`Invalid rib profile: ${profile}`)
  }

  for (let index = 0; index <= segments; index += 1) {
    const ratio = index / segments
    const angle = (Math.PI / 2) * ratio
    const arcX = centerX - direction.x * sizeX * Math.cos(angle)
    const arcZ = centerZ - direction.z * sizeZ * Math.sin(angle)

    points.push([arcX, arcZ])
  }

  // Keep polygon winding consistent so all curve positions extrude as positive solids.
  if (polygonSignedArea(points) < 0) {
    points.reverse()
  }

  return points
}

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

export const startRib = (params) => {
  const {
    start,
    length,
    size,
    sizeX,
    sizeZ,
    curvePosition = 'bottom-right',
    ribProfile = 'curved',
    segments = 16,
  } = params

  if (length <= 0) throw new Error('Rib length must be > 0')
  const ribDimensions = resolveRibDimensions({ size, sizeX, sizeZ })

  const polygonProfile = primitives.polygon({
    points: ribProfilePoints({
      start,
      sizeX: ribDimensions.sizeX,
      sizeZ: ribDimensions.sizeZ,
      curvePosition,
      profile: ribProfile,
      segments,
    }),
  })
  const rib = extrusions.extrudeLinear({ height: length }, polygonProfile)

  return transforms.translate(
    [0, start[1] + length, 0],
    transforms.rotateX(Math.PI / 2, rib),
  )
}

export const createScrewHole = ({
  radius,
  smallRadius,
  totalHeight,
  smallHeight,
  position = [0, 0, 0],
  axis = 'z',
  direction = 1,
  segments = 32,
}) => {
  smallHeight = smallHeight === undefined ? totalHeight * 0.33 : smallHeight
  smallRadius = smallRadius === undefined ? radius * 0.5 : smallRadius
  if (radius <= 0) throw new Error('radius must be > 0')
  if (smallRadius <= 0) throw new Error('smallRadius must be > 0')
  if (totalHeight <= 0) throw new Error('totalHeight must be > 0')
  if (smallHeight <= 0 || smallHeight > totalHeight) {
    throw new Error('smallHeight must be > 0 and <= totalHeight')
  }

  const largeHeight = totalHeight - smallHeight

  // Create cylinders
  const largeCylinder = primitives.cylinder({
    height: largeHeight,
    radius: radius,
    center: [0, 0, largeHeight / 2],
    segments: segments,
  })

  const smallCylinder = primitives.cylinder({
    height: smallHeight,
    radius: smallRadius,
    center: [0, 0, smallHeight / 2],
    segments: segments,
  })

  // Position small cylinder on top of large cylinder
  const smallCylinderTranslated = transforms.translate(
    [0, 0, largeHeight],
    smallCylinder,
  )

  // Union the cylinders
  const hole = booleans.union(largeCylinder, smallCylinderTranslated)

  // Apply axis rotation to orient the cylinders
  let rotated = hole
  if (axis === 'x') {
    rotated = transforms.rotateY(Math.PI / 2, hole)
  } else if (axis === 'y') {
    rotated = transforms.rotateX(Math.PI / 2, hole)
  }
  // axis === 'z' - no rotation needed

  // Apply direction (flip if negative)
  if (direction < 0) {
    if (axis === 'x') {
      rotated = transforms.rotateY(Math.PI, rotated)
      rotated = transforms.translate([totalHeight, 0, 0], rotated)
    } else if (axis === 'y') {
      rotated = transforms.rotateX(Math.PI, rotated)
      rotated = transforms.translate([0, totalHeight, 0], rotated)
    } else {
      rotated = transforms.rotateX(Math.PI, rotated)
      rotated = transforms.translate([0, 0, totalHeight], rotated)
    }
  }

  // Apply position
  return transforms.translate(position, rotated)
}
