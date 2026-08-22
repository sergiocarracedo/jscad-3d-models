import modeling from '@jscad/modeling'
import { startCuboid } from '../utils/shape-helpers'

const { booleans } = modeling

export const id = 'tea-box-holder-end'
export const title = 'Tea Box Holder End'
export const exportFileName = 'tea-box-holder-end.stl'

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

const endLength = 1

const yStemCenter = (flangeWidth - stemWidth) / 2

const createTShapeBlock = (length) =>
  booleans.union(
    startCuboid({
      start: [0, (flangeWidth - flangeWidthTop) / 2, 0],
      size: [length, flangeWidthTop, flangeThicknessTop],
    }),
    startCuboid({
      start: [0, yStemCenter, flangeThicknessTop],
      size: [length, stemWidth, stemHeight],
    }),
    startCuboid({
      start: [0, 0, flangeThicknessTop + stemHeight],
      size: [length, flangeWidth, flangeThickness],
    }),
  )

export const main = () => {
  const body = createTShapeBlock(endLength)

  const pin = startCuboid({
    start: [endLength, flangeWidth / 2 - pinCrossSection / 2, 0],
    size: [pinLength, pinCrossSection, totalHeight],
  })

  return [booleans.union(body, pin)]
}
