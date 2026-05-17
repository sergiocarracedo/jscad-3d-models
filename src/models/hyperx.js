import modeling from '@jscad/modeling'
import { startCuboid, startRoundedSlab } from '../utils/shape-helpers'

const { primitives } = modeling

export const id = 'hyperx'
export const title = 'HyperX'
export const exportFileName = 'hyperx.stl'

const cardWidth = 68.2
const cardHeight = 30.2
const baseThickness = 5
const lipWidthX = 5
const lipWidthZ = 3
const backCableWidth = 14
const clipPivotWidth = 14
const clipPivotHeight = 14
const clipHolesGAp = 12
const clipClampWidth = 15
const clipClampHeight = 8.4
const deckLipHeight = 17.9
const deckLipThickness = 1.3
const topSlapWidth = 30
const topSlapThickness = 5

export const main = () => {
  const baseDimensions = [
    baseThickness,
    cardWidth + lipWidthX,
    cardHeight + lipWidthZ,
  ]
  // base
  const cube = startRoundedSlab({
    start: [0, 0, 0],
    size: [baseDimensions[0], baseDimensions[1], baseDimensions[2]],
    roundedCorners: [],
    borderRadius: 0,
  })

  const pilotHoleTotalWidth = clipPivotWidth + lipWidthZ
  const pilotHoleStartY = cardWidth - clipPivotWidth + lipWidthZ
  const clipPivotHole = startCuboid({
    start: [0, pilotHoleStartY, lipWidthZ + (cardHeight - clipPivotHeight) / 2],
    size: [baseDimensions[0] + 1, pilotHoleTotalWidth, clipPivotHeight],
  })

  const clipClampHole = startCuboid({
    start: [
      0,
      pilotHoleStartY - pilotHoleTotalWidth - clipClampWidth,
      lipWidthZ + (cardHeight - clipClampHeight) / 2,
    ],
    size: [baseDimensions[0] + 1, clipClampWidth, clipClampHeight],
  })

  const cubeWithHoles = modeling.booleans.subtract(
    cube,
    clipPivotHole,
    clipClampHole,
  )

  // lips
  const bottomLip = startRoundedSlab({
    start: [baseThickness, 0, 0],
    size: [lipWidthX, baseDimensions[1], lipWidthZ],
    roundedCorners: ['front-left', 'front-right', 'back-left', 'back-right'],
    borderRadius: 0,
  })

  const verticalLipsHeight = (cardHeight - backCableWidth) / 2
  const backLipBottom = startRoundedSlab({
    start: [baseThickness, 0, lipWidthZ],
    size: [lipWidthX, lipWidthX, verticalLipsHeight],
    roundedCorners: ['front-left', 'front-right', 'back-left', 'back-right'],
    borderRadius: 0,
  })

  const backLipTop = startRoundedSlab({
    start: [
      baseThickness,
      cardWidth,
      verticalLipsHeight + backCableWidth + lipWidthZ,
    ],
    size: [lipWidthX, lipWidthX, verticalLipsHeight],
    roundedCorners: ['front-left', 'front-right', 'back-left', 'back-right'],
    borderRadius: 0,
  })

  const frontLipY = cardWidth + lipWidthX - lipWidthZ
  const frontLipBottom = startRoundedSlab({
    start: [baseThickness, frontLipY, lipWidthZ],
    size: [lipWidthX, lipWidthZ, verticalLipsHeight],
    roundedCorners: ['front-left', 'front-right', 'back-left', 'back-right'],
    borderRadius: 0,
  })

  const frontLipTop = startRoundedSlab({
    start: [
      baseThickness,
      frontLipY,
      verticalLipsHeight + backCableWidth + lipWidthZ,
    ],
    size: [lipWidthX, lipWidthZ, verticalLipsHeight],
    roundedCorners: ['front-left', 'front-right', 'back-left', 'back-right'],
    borderRadius: 0,
  })

  const deckLipXSize = baseThickness - deckLipThickness
  const deckLip = startRoundedSlab({
    start: [0, 0, baseDimensions[2]],
    size: [
      deckLipXSize,
      cardWidth + lipWidthX,
      deckLipHeight - deckLipThickness,
    ],
    roundedCorners: ['front-left', 'front-right', 'back-left', 'back-right'],
    borderRadius: 0,
  })

  const topSlap = startRoundedSlab({
    start: [
      baseThickness - deckLipThickness - topSlapWidth,
      0,
      baseDimensions[2] + deckLipHeight - deckLipThickness - topSlapThickness,
    ],
    size: [topSlapWidth - deckLipXSize, baseDimensions[1], topSlapThickness],
    roundedCorners: ['front-left', 'front-right', 'back-left', 'back-right'],
    borderRadius: 0,
  })

  return [
    cubeWithHoles,
    bottomLip,
    // backLipBottom,
    // backLipTop,
    frontLipBottom,
    frontLipTop,
    deckLip,
    topSlap,
  ]
}
