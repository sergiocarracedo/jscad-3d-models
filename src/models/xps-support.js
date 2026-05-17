import modeling from '@jscad/modeling'
import { startCuboid, startRoundedSlab } from '../utils/shape-helpers'

const { booleans, colors, extrusions, primitives, transforms } = modeling

const id = 'xps-support'
const title = 'XPS Support'
const exportFileName = 'xps-support.stl'
const supportsIncludeGuides = true

const wallThickness = 3
const floorThickness = 3
const ceilThickness = 5
const ribRadiusTop = 4
const ribRadiusBottom = 4
const ribSegments = 16
const cornerRadius = 4

// Internal space dimensions, in millimeters
const internalWidth = 185
const internalHeight = 18 + 18 - ribRadiusTop
const internalDeep = 30

const cutoutHeight = 23
const cutoutWidth = 23

const borderRadius = 4

const supportHolesDim = 6.45
const supportHolesDimInternal = 4
const supportHolesGap = 6.45
const supportHolesGuideHeight = 0.5
const supportHolesGuideLift = 0.35

const supportHolesGridOrigin = {
  x: 0,
  z: 3,
}
const supportHolesBoxColumnsStartOn = 1
const supportHolesBoxColumns = 10
const supportHolesBoxRows = 2

const wallLightenCutoutHorizontalGap = 15
const wallLightenCutoutVerticalGap = 0
const wallLightenCutoutMaxMin = [20, 200]
const wallLightenCutoutRadius = 4

const floorLightenCutoutHorizontalGap = 15
const floorLightenCutoutDeepGap = 7
const floorLightenCutoutMaxMin = [20, 50]

const floorRoundedCorners = ['back-left', 'back-right']
const ceilRoundedCorners = ['back-left', 'back-right']

const quarterCircleProfilePoints = ({ radius, horizontalDirection }) => {
  const points = [
    [0, 0],
    [horizontalDirection * radius, 0],
  ]
  const centerX = horizontalDirection * radius
  const startAngle = -Math.PI / 2
  const endAngle = horizontalDirection < 0 ? 0 : -Math.PI

  for (let index = 0; index <= ribSegments; index += 1) {
    const ratio = index / ribSegments
    const angle = startAngle + (endAngle - startAngle) * ratio

    points.push([
      centerX + radius * Math.cos(angle),
      radius + radius * Math.sin(angle),
    ])
  }

  return horizontalDirection < 0 ? points.reverse() : points
}

const startQuarterCircleRib = ({
  start,
  length,
  horizontalDirection,
  radius,
}) => {
  const profile = primitives.polygon({
    points: quarterCircleProfilePoints({ radius, horizontalDirection }),
  })
  const rib = extrusions.extrudeLinear({ height: length }, profile)

  return transforms.translate(start, transforms.rotateY(Math.PI / 2, rib))
}

const startQuarterCircleCutoutRound = ({
  start,
  length,
  horizontalDirection,
}) => {
  const profile = primitives.polygon({
    points: quarterCircleProfilePoints({
      radius: cornerRadius,
      horizontalDirection,
    }),
  })
  const round = extrusions.extrudeLinear({ height: length }, profile)

  return transforms.translate(start, transforms.rotateX(Math.PI / 2, round))
}

const startQuarterCircleWallEdgeCut = ({
  start,
  length,
  horizontalDirection,
}) => {
  const profile = primitives.polygon({
    points: quarterCircleProfilePoints({
      radius: cornerRadius,
      horizontalDirection,
    })
      .map(([x, z]) => [x, -z])
      .reverse(),
  })
  const cut = extrusions.extrudeLinear({ height: length }, profile)

  return transforms.translate(start, transforms.rotateX(Math.PI / 2, cut))
}

const calculateLightenHoles = ({
  spanWidth,
  sidePadding,
  gap,
  sizeRange,
  roundRadius,
}) => {
  const [minWidth, maxWidth] = sizeRange
  const effectiveSidePadding = Math.max(0, sidePadding - roundRadius)
  const effectiveGap = Math.max(0, gap - roundRadius * 2)
  const usableWidth = spanWidth - effectiveSidePadding * 2

  if (usableWidth < minWidth) return []
  const minimumHoleCount = Math.max(
    1,
    Math.ceil((usableWidth + effectiveGap) / (maxWidth + effectiveGap)),
  )
  const maximumHoleCount = Math.max(
    1,
    Math.floor((usableWidth + effectiveGap) / (minWidth + effectiveGap)),
  )

  if (minimumHoleCount > maximumHoleCount) return []

  const holeCount = maximumHoleCount
  const holeWidth = (usableWidth - effectiveGap * (holeCount - 1)) / holeCount

  return Array.from({ length: holeCount }, (_, index) => ({
    startX: effectiveSidePadding + index * (holeWidth + effectiveGap),
    width: holeWidth,
  }))
}

const startRoundedRectangleWallHole = ({ start, size, length }) => {
  const [width, height] = size
  const maxRoundRadius = Math.max(0, Math.min(width, height) / 2 - 0.01)
  const roundRadius = Math.min(wallLightenCutoutRadius, maxRoundRadius)
  const profile = primitives.roundedRectangle({
    center: [width / 2, height / 2],
    size: [width, height],
    roundRadius,
    segments: ribSegments,
  })
  const hole = extrusions.extrudeLinear({ height: length }, profile)

  return transforms.translate(start, transforms.rotateX(Math.PI / 2, hole))
}

const startRoundedRectangleFloorHole = ({ start, size, length }) => {
  const [width, depth] = size
  const maxRoundRadius = Math.max(0, Math.min(width, depth) / 2 - 0.01)
  const roundRadius = Math.min(ribRadiusBottom, maxRoundRadius)
  const profile = primitives.roundedRectangle({
    center: [width / 2, depth / 2],
    size: [width, depth],
    roundRadius,
    segments: ribSegments,
  })
  const hole = extrusions.extrudeLinear({ height: length }, profile)

  return transforms.translate(start, hole)
}

const startCeilingCylinderHole = ({ center, radius, height }) =>
  primitives.cylinder({
    center,
    radius,
    height,
    segments: Math.max(ribSegments * 2, 32),
  })

const main = ({ includeGuides = true } = {}) => {
  // Floor
  const floor = startRoundedSlab({
    start: [0, wallThickness, 0],
    size: [internalWidth, internalDeep - wallThickness, floorThickness],
    roundedCorners: floorRoundedCorners,
  })

  const floorUsableDepth = internalDeep - wallThickness - ribRadiusBottom

  const floorLightenHoleDepth = floorUsableDepth - floorLightenCutoutDeepGap
  const floorLightenHoleRoundRadius = Math.min(
    ribRadiusBottom,
    Math.max(0, floorLightenHoleDepth / 3),
    floorLightenCutoutMaxMin[0] / 2,
  )
  const floorLightenHoles =
    floorLightenHoleDepth > 0
      ? calculateLightenHoles({
          spanWidth: internalWidth,
          sidePadding: floorLightenCutoutHorizontalGap,
          gap: floorLightenCutoutHorizontalGap,
          sizeRange: floorLightenCutoutMaxMin,
          roundRadius: floorLightenHoleRoundRadius,
        }).map(({ startX, width }) =>
          startRoundedRectangleFloorHole({
            start: [startX, wallThickness + ribRadiusBottom, 0],
            size: [width, floorLightenHoleDepth - ribRadiusBottom / 2],
            length: floorThickness,
          }),
        )
      : []

  const floorWithLightenHoles = booleans.subtract(floor, ...floorLightenHoles)

  // Vertical Wall
  const wallHeight = internalHeight + floorThickness + ceilThickness
  const wall = colors.colorize(
    colors.colorNameToRgb('red'),
    startCuboid({
      start: [0, 0, 0],
      size: [internalWidth, wallThickness, wallHeight],
    }),
  )

  // Cutouts in the wall
  const leftCutout = startCuboid({
    start: [0, 0, wallHeight - cutoutHeight],
    size: [cutoutWidth, wallThickness, cutoutHeight],
  })

  const rightCutout = transforms.translate(
    [internalWidth - cutoutWidth, 0, 0],
    leftCutout,
  )

  const leftCutoutRound = startQuarterCircleCutoutRound({
    start: [cutoutWidth, wallThickness, wallHeight - cutoutHeight],
    length: wallThickness,
    horizontalDirection: -1,
  })

  const rightCutoutRound = startQuarterCircleCutoutRound({
    start: [
      internalWidth - cutoutWidth,
      wallThickness,
      wallHeight - cutoutHeight,
    ],
    length: wallThickness,
    horizontalDirection: 1,
  })

  const leftWallBottomRoundCut = startQuarterCircleWallEdgeCut({
    start: [0, wallThickness, wallHeight - cutoutHeight],
    length: wallThickness,
    horizontalDirection: 1,
  })

  const rightWallBottomRoundCut = startQuarterCircleWallEdgeCut({
    start: [internalWidth, wallThickness, wallHeight - cutoutHeight],
    length: wallThickness,
    horizontalDirection: -1,
  })

  // Lighten holes in the wall
  const centerWallWidth = internalWidth - cutoutWidth * 2
  const centerWallHeight = internalHeight
  const wallLightenHoleHeight =
    internalHeight -
    wallLightenCutoutVerticalGap * 2 -
    ribRadiusBottom -
    ribRadiusTop
  const wallLightenHoleRoundRadius = wallLightenCutoutRadius
  const wallLightenHoles = calculateLightenHoles({
    spanWidth: centerWallWidth,
    sidePadding: wallLightenCutoutHorizontalGap,
    gap: wallLightenCutoutHorizontalGap,
    sizeRange: wallLightenCutoutMaxMin,
    roundRadius: wallLightenHoleRoundRadius,
  }).map(({ startX, width }) =>
    startRoundedRectangleWallHole({
      start: [
        cutoutWidth + startX,
        wallThickness,
        wallLightenCutoutVerticalGap + floorThickness + wallLightenCutoutRadius,
      ],
      size: [width, wallLightenHoleHeight],
      length: wallThickness,
    }),
  )

  const wallWithCutouts = booleans.subtract(
    booleans.union(
      booleans.subtract(wall, leftCutout, rightCutout),
      leftCutoutRound,
      rightCutoutRound,
    ),
    leftWallBottomRoundCut,
    rightWallBottomRoundCut,
    ...wallLightenHoles,
  )

  const floorRib = colors.colorize(
    colors.colorNameToRgb('yellow'),
    startQuarterCircleRib({
      start: [0, wallThickness, floorThickness],
      length: internalWidth,
      horizontalDirection: -1,
      radius: ribRadiusBottom,
    }),
  )

  /**
   * Ceiling slab with holes for supports. The holes are created as cylinders that will be subtracted from the slab. Additionally, guide cylinders are created for the holes, which can be optionally included in the final output for visualization purposes.
   */
  const ceilStart = [cutoutWidth, wallThickness, wallHeight - ceilThickness]
  const ceilSize = [
    internalWidth - cutoutWidth * 2,
    internalDeep - wallThickness,
    ceilThickness,
  ]
  const ceilSlab = startRoundedSlab({
    start: ceilStart,
    size: ceilSize,
    roundedCorners: ceilRoundedCorners,
  })

  const distributeSupportHoles = ({
    origin,
    holeDim,
    reservedDim,
    rows,
    cols,
    colsStartOn,
    rowGap,
    colGap,
  }) => {
    const res = []
    for (let row = 0; row < rows; row += 1) {
      for (let col = colsStartOn; col < cols; col += 1) {
        const centerX =
          origin.x + col * (reservedDim + colGap) + reservedDim / 2
        const centerZ =
          origin.z + row * (reservedDim + rowGap) + reservedDim / 2
        res.push({ centerX, centerZ, radius: holeDim / 2 })
      }
    }
    return res
  }

  const supportHoles = distributeSupportHoles({
    origin: supportHolesGridOrigin,
    holeDim: supportHolesDimInternal,
    reservedDim: supportHolesDim,
    rowGap: supportHolesGap,
    rows: supportHolesBoxRows,
    cols: supportHolesBoxColumns,
    colsStartOn: supportHolesBoxColumnsStartOn,
    colGap: supportHolesGap,
  })

  const ceilHoles = supportHoles.map(({ centerX, centerZ, radius }) =>
    startCeilingCylinderHole({
      center: [
        ceilStart[0] + centerX,
        ceilStart[1] + centerZ,
        ceilStart[2] + ceilThickness / 2,
      ],
      radius,
      height: ceilThickness + 0.1,
    }),
  )

  const ceilHoleGuides = colors.colorize(
    [1, 0.1, 0, 0.45],
    supportHoles.map(({ centerX, centerZ }) =>
      startCeilingCylinderHole({
        center: [
          ceilStart[0] + centerX,
          ceilStart[1] + centerZ,
          ceilStart[2] +
            ceilThickness +
            supportHolesGuideLift +
            supportHolesGuideHeight / 2,
        ],
        radius: supportHolesDim / 2,
        height: supportHolesGuideHeight,
      }),
    ),
  )

  const ceil = colors.colorize(
    colors.colorNameToRgb('green'),
    ceilHoles.length > 0 ? booleans.subtract(ceilSlab, ...ceilHoles) : ceilSlab,
  )

  const ceilingRib = colors.colorize(
    colors.colorNameToRgb('yellow'),
    startQuarterCircleRib({
      start: [cutoutWidth, ceilStart[1], ceilStart[2]],
      length: internalWidth - cutoutWidth * 2,
      horizontalDirection: 1,
      radius: ribRadiusTop,
    }),
  )

  const printableSolid = booleans.union(
    floorWithLightenHoles,
    wallWithCutouts,
    ceil,
    floorRib,
    ceilingRib,
  )

  return includeGuides ? [printableSolid, ...ceilHoleGuides] : [printableSolid]
}

export { exportFileName, id, main, supportsIncludeGuides, title }
