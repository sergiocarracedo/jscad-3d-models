import modeling from '@jscad/modeling'

const { booleans, colors, extrusions, primitives, transforms } = modeling


// Internal space dimensions, in millimeters
const internalWidth = 185
const internalHeight = 18 + 18
const internalDeep = 30

const cutoutHeight = 20
const cutoutWidth = 22 

const borderRadius = 2

const verticalWallThickness = 5
const floorThickness = 3
const ceilThickness = 3
const ribRadius = 4
const ribSegments = 16

const supportHolesDim = 6.2
const supportHolesDimInternal = 4
const supportHolesGap = 6.5
const supportHolesGuideHeight = 0.5
const supportHolesGuideLift = 0.35

const supportHolesGridOrigin = {
  x: 32.6 - cutoutWidth - supportHolesGap,
  z: 5,
}
const supportHolesBoxColumns = 15
const supportHolesBoxRows = 2

const wallLightenCutoutHorizontalGap = 15
const wallLightenCutoutVerticalGap = 0
const wallLightenCutoutMaxMin = [20, 200]


const floorLightenCutoutHorizontalGap = 15
const floorLightenCutoutDeepGap = 7
const floorLightenCutoutMaxMin = [20, 50]


const floorRoundedCorners = ['back-left', 'back-right']
const ceilRoundedCorners = ['back-left', 'back-right']



const startCuboid = (params) => {
  const { start, size } = params
  // Calculamos el centro basado en el inicio y el tamaño
  const center = [
    start[0] + size[0] / 2,
    start[1] + size[1] / 2,
    start[2] + size[2] / 2
  ]
  return primitives.cuboid({ ...params, size, center, })
}

const allRoundedCorners = ['front-left', 'front-right', 'back-right', 'back-left']

const normalizeRoundedCorners = (roundedCorners) => {
  if (roundedCorners === 'all') return new Set(allRoundedCorners)
  if (Array.isArray(roundedCorners)) {
    return new Set(roundedCorners.filter((corner) => allRoundedCorners.includes(corner)))
  }

  return new Set()
}

const addArcPoints = (points, center, radius, startAngle, endAngle) => {
  for (let index = 1; index <= ribSegments; index += 1) {
    const ratio = index / ribSegments
    const angle = startAngle + (endAngle - startAngle) * ratio

    points.push([
      center[0] + radius * Math.cos(angle),
      center[1] + radius * Math.sin(angle),
    ])
  }
}

const selectiveRoundedRectanglePoints = ({ width, depth, radius, roundedCorners }) => {
  const corners = normalizeRoundedCorners(roundedCorners)
  const effectiveRadius = Math.min(radius, width / 2, depth / 2)

  if (effectiveRadius <= 0 || corners.size === 0) {
    return [[0, 0], [width, 0], [width, depth], [0, depth]]
  }

  const points = []
  const frontLeftRounded = corners.has('front-left')
  const frontRightRounded = corners.has('front-right')
  const backRightRounded = corners.has('back-right')
  const backLeftRounded = corners.has('back-left')

  points.push(frontLeftRounded ? [effectiveRadius, 0] : [0, 0])
  points.push(frontRightRounded ? [width - effectiveRadius, 0] : [width, 0])

  if (frontRightRounded) {
    addArcPoints(points, [width - effectiveRadius, effectiveRadius], effectiveRadius, -Math.PI / 2, 0)
  }

  points.push(backRightRounded ? [width, depth - effectiveRadius] : [width, depth])

  if (backRightRounded) {
    addArcPoints(points, [width - effectiveRadius, depth - effectiveRadius], effectiveRadius, 0, Math.PI / 2)
  }

  points.push(backLeftRounded ? [effectiveRadius, depth] : [0, depth])

  if (backLeftRounded) {
    addArcPoints(points, [effectiveRadius, depth - effectiveRadius], effectiveRadius, Math.PI / 2, Math.PI)
  }

  points.push(frontLeftRounded ? [0, effectiveRadius] : [0, 0])

  if (frontLeftRounded) {
    addArcPoints(points, [effectiveRadius, effectiveRadius], effectiveRadius, Math.PI, Math.PI * 1.5)
  }

  return points
}

const startRoundedSlab = (params) => {
  const { start, size, roundedCorners = 'all' } = params
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

const quarterCircleProfilePoints = ({ radius, horizontalDirection }) => {
  const points = [[0, 0], [horizontalDirection * radius, 0]]
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

const startQuarterCircleRib = ({ start, length, horizontalDirection }) => {
  const profile = primitives.polygon({
    points: quarterCircleProfilePoints({ radius: ribRadius, horizontalDirection }),
  })
  const rib = extrusions.extrudeLinear({ height: length }, profile)

  return transforms.translate(start, transforms.rotateY(Math.PI / 2, rib))
}

const startQuarterCircleCutoutRound = ({ start, length, horizontalDirection }) => {
  const profile = primitives.polygon({
    points: quarterCircleProfilePoints({ radius: ribRadius, horizontalDirection }),
  })
  const round = extrusions.extrudeLinear({ height: length }, profile)

  return transforms.translate(start, transforms.rotateX(Math.PI / 2, round))
}

const startQuarterCircleWallEdgeCut = ({ start, length, horizontalDirection }) => {
  const profile = primitives.polygon({
    points: quarterCircleProfilePoints({ radius: ribRadius, horizontalDirection })
      .map(([x, z]) => [x, -z])
      .reverse(),
  })
  const cut = extrusions.extrudeLinear({ height: length }, profile)

  return transforms.translate(start, transforms.rotateX(Math.PI / 2, cut))
}

const calculateLightenHoles = ({ spanWidth, sidePadding, gap, sizeRange, roundRadius }) => {
  const [minWidth, maxWidth] = sizeRange
  const effectiveSidePadding = Math.max(0, sidePadding - roundRadius)
  const effectiveGap = Math.max(0, gap - roundRadius * 2)
  const usableWidth = spanWidth - effectiveSidePadding * 2

  if (usableWidth < minWidth) return []
  const minimumHoleCount = Math.max(1, Math.ceil((usableWidth + effectiveGap) / (maxWidth + effectiveGap)))
  const maximumHoleCount = Math.max(1, Math.floor((usableWidth + effectiveGap) / (minWidth + effectiveGap)))

  if (minimumHoleCount > maximumHoleCount) return []

  const holeCount = maximumHoleCount
  const holeWidth = (usableWidth - effectiveGap * (holeCount - 1)) / holeCount

  return Array.from({ length: holeCount }, (_, index) => ({
    startX: effectiveSidePadding + index * (holeWidth + effectiveGap),
    width: holeWidth,
  }))
}

const distributeSupportHoles = ({ origin, holeDim, reservedDim, rows, cols, rowGap, colGap }) => {

  const res = []
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const centerX = origin.x + col * (reservedDim - holeDim + colGap) + reservedDim / 2
      const centerZ = origin.z + row * (reservedDim - holeDim + rowGap) + reservedDim / 2
      console.log(`Hole at row ${row}, col ${col}: centerX=${centerX}, centerZ=${centerZ}`)
      res.push({ centerX, centerZ, radius: holeDim / 2 })
    }
  }
  return res
}


const startRoundedRectangleWallHole = ({ start, size, length }) => {
  const [width, height] = size
  const maxRoundRadius = Math.max(0, Math.min(width, height) / 2 - 0.01)
  const roundRadius = Math.min(ribRadius, maxRoundRadius)
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
  const roundRadius = Math.min(ribRadius, maxRoundRadius)
  const profile = primitives.roundedRectangle({
    center: [width / 2, depth / 2],
    size: [width, depth],
    roundRadius,
    segments: ribSegments,
  })
  const hole = extrusions.extrudeLinear({ height: length }, profile)

  return transforms.translate(start, hole)
}

const startCeilingCylinderHole = ({ center, radius, height }) => primitives.cylinder({
  center,
  radius,
  height,
  segments: Math.max(ribSegments * 2, 32),
})


const main = ({ includeGuides = true } = {}) => {
    // Floor
  const floor = startRoundedSlab({ 
    start: [0, verticalWallThickness, 0], 
    size: [
        internalWidth, 
        internalDeep - verticalWallThickness, 
        floorThickness
    ],
    roundedCorners: floorRoundedCorners,
  })

  const floorUsableDepth = internalDeep - verticalWallThickness - ribRadius
  
  const floorLightenHoleDepth = floorUsableDepth - floorLightenCutoutDeepGap
  const floorLightenHoleRoundRadius = Math.min(
    ribRadius,
    Math.max(0, floorLightenHoleDepth / 3),
    floorLightenCutoutMaxMin[0] / 2,
  )
  const floorLightenHoles = floorLightenHoleDepth > 0
    ? calculateLightenHoles({
        spanWidth: internalWidth,
        sidePadding: floorLightenCutoutHorizontalGap,
        gap: floorLightenCutoutHorizontalGap,
        sizeRange: floorLightenCutoutMaxMin,
        roundRadius: floorLightenHoleRoundRadius,
      }).map(({ startX, width }) => startRoundedRectangleFloorHole({
        start: [startX, verticalWallThickness + ribRadius, 0],
        size: [width, floorLightenHoleDepth-ribRadius/2],
        length: floorThickness,
      }))
    : []

  const floorWithLightenHoles = booleans.subtract(floor, ...floorLightenHoles)

    // Vertical 
  const wall = colors.colorize(
    colors.colorNameToRgb('red'), 
    startCuboid({ 
        start: [0, 0, 0], 
        size: [
            internalWidth, 
            verticalWallThickness, 
            internalHeight - floorThickness
        ] 
    }))

  const leftCutout = startCuboid({
    start: [0, 0, cutoutHeight], 
    size: [
        cutoutWidth, 
        verticalWallThickness, 
        internalHeight - floorThickness - cutoutHeight
    ] 
  })

  const rightCutout = transforms.translate(
    [internalWidth - cutoutWidth, 0, 0],
    leftCutout
  )

  const leftCutoutRound = startQuarterCircleCutoutRound({
    start: [cutoutWidth, verticalWallThickness, cutoutHeight],
    length: verticalWallThickness,
    horizontalDirection: -1,
  })

  const rightCutoutRound = startQuarterCircleCutoutRound({
    start: [internalWidth - cutoutWidth, verticalWallThickness, cutoutHeight],
    length: verticalWallThickness,
    horizontalDirection: 1,
  })

  const leftWallBottomRoundCut = startQuarterCircleWallEdgeCut({
    start: [0, verticalWallThickness, cutoutHeight],
    length: verticalWallThickness,
    horizontalDirection: 1,
  })

  const rightWallBottomRoundCut = startQuarterCircleWallEdgeCut({
    start: [internalWidth, verticalWallThickness, cutoutHeight],
    length: verticalWallThickness,
    horizontalDirection: -1,
  })

  const centerWallWidth = internalWidth - cutoutWidth * 2
  const centerWallHeight = internalHeight - floorThickness
  const wallLightenHoleHeight = centerWallHeight - floorThickness - wallLightenCutoutVerticalGap * 2
  const wallLightenHoleRoundRadius = ribRadius
  const wallLightenHoles = calculateLightenHoles({
    spanWidth: centerWallWidth,
    sidePadding: wallLightenCutoutHorizontalGap,
    gap: wallLightenCutoutHorizontalGap,
    sizeRange: wallLightenCutoutMaxMin,
    roundRadius: wallLightenHoleRoundRadius,
  }).map(({ startX, width }) => startRoundedRectangleWallHole({
    start: [cutoutWidth + startX, verticalWallThickness, wallLightenCutoutVerticalGap + floorThickness + ribRadius],
    size: [width, wallLightenHoleHeight - ribRadius * 2 -floorThickness],
    length: verticalWallThickness ,
  }))

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
    start: [0, verticalWallThickness, floorThickness],
    length: internalWidth,
    horizontalDirection: -1,
  }))
  

  const ceilStart = [cutoutWidth, verticalWallThickness, internalHeight - floorThickness - ceilThickness]
  const ceilSize = [
    internalWidth - cutoutWidth * 2,
    internalDeep - verticalWallThickness,
    ceilThickness,
  ]
  const ceilSlab = startRoundedSlab({
    start: ceilStart,
    size: ceilSize,
    roundedCorners: ceilRoundedCorners,
  })
  const supportHoles = distributeSupportHoles({
    origin: supportHolesGridOrigin,
    holeDim: supportHolesDimInternal,
    reservedDim: supportHolesDim,
    rowGap: supportHolesGap,
    rows: supportHolesBoxRows,
    cols: supportHolesBoxColumns,
    colGap: supportHolesGap ,

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
    }))
  
  const ceilHoleGuides = colors.colorize(
    [1, 0.1, 0, 0.45],
    supportHoles.map(({ centerX, centerZ }) => startCeilingCylinderHole({
        center: [
          ceilStart[0] + centerX,
          ceilStart[1] + centerZ,
          ceilStart[2] + ceilThickness + supportHolesGuideLift + supportHolesGuideHeight / 2,
        ],
        radius: supportHolesDim / 2,
        height: supportHolesGuideHeight,
      })),
    )

  const ceil = colors.colorize(
    colors.colorNameToRgb('green'),
    ceilHoles.length > 0 ? booleans.subtract(ceilSlab, ...ceilHoles) : ceilSlab,
  )

  const ceilingRib = colors.colorize(
    colors.colorNameToRgb('yellow'),
    startQuarterCircleRib({
      start: [cutoutWidth, verticalWallThickness, internalHeight - floorThickness - ceilThickness],
      length: internalWidth - cutoutWidth * 2,
      horizontalDirection: 1,
    })
)

  const printableSolid = booleans.union(floorWithLightenHoles, wallWithCutouts, ceil, floorRib, ceilingRib)

  return includeGuides ? [printableSolid, ...ceilHoleGuides] : [printableSolid]
  //return booleans.union(floor, wall)
}

export { main }
