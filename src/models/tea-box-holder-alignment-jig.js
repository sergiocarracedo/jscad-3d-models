import modeling from '@jscad/modeling'
import { startCuboid } from '../utils/shape-helpers'
import {
  teaBoxHolderDimensions,
  teaBoxHolderTotalHeight,
} from './tea-box-holder-shape.js'

const { booleans } = modeling

export const id = 'tea-box-holder-alignment-jig'
export const title = 'Tea Box Holder Alignment Jig'
export const exportFileName = 'tea-box-holder-alignment-jig.stl'

const railGap = 80

export const main = () => {
  const frameThickness = teaBoxHolderDimensions.lowerFlangeThickness
  const endStopThickness = teaBoxHolderDimensions.upperFlangeThickness

  const tipsHeight =
    teaBoxHolderTotalHeight -
    teaBoxHolderDimensions.lowerFlangeThickness -
    teaBoxHolderDimensions.upperFlangeThickness

  const sizeX = tipsHeight

  const flapTop = {
    width:
      (teaBoxHolderDimensions.upperFlangeWidth -
        teaBoxHolderDimensions.stemWidth) /
      2,
    height: teaBoxHolderDimensions.upperFlangeThickness,
  }

  const flapBottom = {
    width:
      (teaBoxHolderDimensions.lowerFlangeWidth -
        teaBoxHolderDimensions.stemWidth) /
      2,
    height: teaBoxHolderDimensions.lowerFlangeThickness,
  }

  const width = railGap
  const height = teaBoxHolderTotalHeight

  const outerFrame = startCuboid({
    start: [0, 0, 0],
    size: [sizeX, width, height],
  })

  const cutTop1 = startCuboid({
    start: [0, 0, height - flapTop.height],
    size: [sizeX, flapTop.width, flapTop.height],
  })

  const cutTop2 = startCuboid({
    start: [0, width - flapTop.width, height - flapTop.height],
    size: [sizeX, flapTop.width, flapTop.height],
  })

  const cutBottom1 = startCuboid({
    start: [0, 0, 0],
    size: [sizeX, flapBottom.width, flapTop.height],
  })

  const cutBottom2 = startCuboid({
    start: [0, width - flapBottom.width, 0],
    size: [sizeX, flapBottom.width, flapBottom.height],
  })

  return [
    booleans.subtract(outerFrame, cutTop1, cutTop2, cutBottom1, cutBottom2),
  ]
}
