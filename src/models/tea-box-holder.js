import modeling from '@jscad/modeling'
import { startCuboid } from '../utils/shape-helpers'

const { booleans, primitives } = modeling

export const id = 'tea-box-holder'
export const title = 'Tea Box Holder'
export const exportFileName = 'tea-box-holder.stl'

const length = 165
const stemWidth = 5
const flangeWidth = 12
const flangeWidthTop = 8
const flangeThickness = 3
const flangeThicknessTop = 2
const stemHeight = 10
const totalHeight = stemHeight + flangeThicknessTop + flangeThickness

const pinSize = 2
const pinTolerance = 0.2
const pinLength = 5
const pinCrossSection = pinSize - 2 * pinTolerance

const holeOffsetFromEnd = 25
const screwShaftRadius = 1.6
const screwHeadRadius = 3.0
const counterboreDepth = 2.0

const yStemCenter = (flangeWidth - stemWidth) / 2

const createScrewHole = (xPosition) => {
  const shaftHole = primitives.cylinder({
    radius: screwShaftRadius,
    height: totalHeight,
    center: [xPosition, flangeWidth / 2, totalHeight / 2],
    segments: 32,
  })

  const counterbore = primitives.cylinder({
    radius: screwHeadRadius,
    height: counterboreDepth,
    center: [xPosition, flangeWidth / 2, totalHeight - counterboreDepth / 2],
    segments: 32,
  })

  return booleans.union(shaftHole, counterbore)
}

const createTShapeBlock = (startX, blockLength) =>
  booleans.union(
    startCuboid({
      start: [startX, (flangeWidth - flangeWidthTop) / 2, 0],
      size: [blockLength, flangeWidthTop, flangeThicknessTop],
    }),
    startCuboid({
      start: [startX, yStemCenter, flangeThicknessTop],
      size: [blockLength, stemWidth, stemHeight],
    }),
    startCuboid({
      start: [startX, 0, flangeThicknessTop + stemHeight],
      size: [blockLength, flangeWidth, flangeThickness],
    }),
  )

export const main = () => {
  const body = createTShapeBlock(0, length)

  const pin = startCuboid({
    start: [length, flangeWidth / 2 - pinCrossSection / 2, 0],
    size: [pinLength, pinCrossSection, totalHeight],
  })

  const slot = startCuboid({
    start: [0, flangeWidth / 2 - pinSize / 2, 0],
    size: [pinLength, pinSize, totalHeight],
  })

  const holes = [
    createScrewHole(holeOffsetFromEnd),
    createScrewHole(length - holeOffsetFromEnd),
  ]

  return [booleans.subtract(booleans.union(body, pin), slot, ...holes)]
}
