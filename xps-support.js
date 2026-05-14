import modeling from '@jscad/modeling'

const { booleans, colors, extrusions, primitives, transforms } = modeling


// Internal space dimensions, in millimeters
const internalWidth = 150
const internalHeight = 18 + 18
const internalDeep = 25

const cutoutHeight = 18
const cutoutWidth = 20 

const verticalWallThickness = 5
const floorThickness = 3
const ceilThickness = 3
const ribRadius = 4
const ribSegments = 16

const supportHolesRadius = 6.2
const supportHolesRadiusInternal = 4
const supportHolesGap = 6.5

const wallLightenCutoutHorizontalGap = 10
const wallLightenCutoutVerticalGap = 0
const wallLightenCutoutMaxMin = [20, 50]


const floorLightenCutoutHorizontalGap = 15
const floorLightenCutoutDeepGap = 20
const floorLightenCutoutMaxMin = [20, 50]



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

const startRoundedRectangleWallHole = ({ start, size, length }) => {
  const [width, height] = size
  const roundRadius = Math.min(ribRadius, width / 2, height / 2)
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
  const roundRadius = Math.min(ribRadius, width / 2, depth / 2)
  const profile = primitives.roundedRectangle({
    center: [width / 2, depth / 2],
    size: [width, depth],
    roundRadius,
    segments: ribSegments,
  })
  const hole = extrusions.extrudeLinear({ height: length }, profile)

  return transforms.translate(start, hole)
}


const main = () => {
    // Floor
  const floor = startCuboid({ 
    start: [0, verticalWallThickness, 0], 
    size: [
        internalWidth, 
        internalDeep - verticalWallThickness, 
        floorThickness
    ] })

  const floorLightenHoleDepth = internalDeep - verticalWallThickness - floorLightenCutoutDeepGap * 2
  const floorLightenHoleRoundRadius = Math.min(
    ribRadius,
    Math.max(0, floorLightenHoleDepth / 2),
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
        start: [startX, verticalWallThickness + floorLightenCutoutDeepGap, 0],
        size: [width, floorLightenHoleDepth],
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
  const wallLightenHoleRoundRadius = Math.min(
    ribRadius,
    // wallLightenHoleHeight / 2,
    // wallLightenCutoutMaxMin[0] / 2,
  )
  const wallLightenHoles = calculateLightenHoles({
    spanWidth: centerWallWidth,
    sidePadding: wallLightenCutoutHorizontalGap,
    gap: wallLightenCutoutHorizontalGap,
    sizeRange: wallLightenCutoutMaxMin,
    roundRadius: wallLightenHoleRoundRadius,
  }).map(({ startX, width }) => startRoundedRectangleWallHole({
    start: [cutoutWidth + startX, verticalWallThickness, wallLightenCutoutVerticalGap + floorThickness + ribRadius],
    size: [width, wallLightenHoleHeight - ribRadius*2 -floorThickness],
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
  

  const ceil = colors.colorize(
    colors.colorNameToRgb('green'),
    startCuboid({ 
      start: [cutoutWidth, verticalWallThickness, internalHeight - floorThickness - ceilThickness], 
      size: [
          internalWidth - cutoutWidth * 2, 
          internalDeep - verticalWallThickness, 
          floorThickness
      ] })
    )

  const ceilingRib = colors.colorize(
    colors.colorNameToRgb('yellow'),
    startQuarterCircleRib({
      start: [cutoutWidth, verticalWallThickness, internalHeight - floorThickness - ceilThickness],
      length: internalWidth - cutoutWidth * 2,
      horizontalDirection: 1,
    })
)

  return [floorWithLightenHoles, wallWithCutouts, ceil, floorRib, ceilingRib]
  //return booleans.union(floor, wall)
}

export { main }
