import modeling from '@jscad/modeling'
import { hexToRgb } from '@jscad/modeling/src/colors'
import { startRoundedSlab } from '../utils/shape-helpers'

const { primitives, colors, booleans, transforms } = modeling

export const id = 'bedroom'
export const title = 'Bedroom'
export const exportFileName = 'bedroom.stl'

export const main = ({ includeGuides = true } = {}) => {
  const wallHeight = 250
  const columnLength = 38
  const columnDeep = 19
  const backWallSegments = [109, 38, 179]

  const backWallWidth = backWallSegments.reduce(
    (sum, segment) => sum + segment,
    0,
  )

  // floor
  const floorDimensions = [backWallWidth, 300, -3]

  const floor = colors.colorize(
    hexToRgb('#733608'),
    startRoundedSlab({
      start: [0, 0, 0],
      size: floorDimensions,
      roundedCorners: [],
      borderRadius: 0,
    }),
  )

  const wallThinkness = 20

  // Back wall
  const backWall = startRoundedSlab({
    start: [0, -wallThinkness, 0],
    size: [backWallWidth, wallThinkness, wallHeight],
    roundedCorners: [],
    borderRadius: 0,
  })

  // window wall
  const windowWallLength = 35
  const windowWall = startRoundedSlab({
    start: [backWallWidth, -wallThinkness, 0],
    size: [wallThinkness, windowWallLength + wallThinkness, wallHeight],
    roundedCorners: [],
    borderRadius: 0,
  })

  // bathroom wall
  const bathroomWallLength = 208
  const bathroomWall = startRoundedSlab({
    start: [-wallThinkness, -wallThinkness, 0],
    size: [wallThinkness, bathroomWallLength + wallThinkness, wallHeight],
    roundedCorners: [],
    borderRadius: 0,
  })

  //column

  const column = startRoundedSlab({
    start: [backWallSegments[2], 0, 0],
    size: [columnLength, columnDeep, wallHeight],
    roundedCorners: [],
    borderRadius: 0,
  })

  const walls = colors.colorize(
    hexToRgb('#999999'),
    booleans.union(backWall, windowWall, bathroomWall),
  )

  // bed
  const currentBedWindowsWallDistance = 80
  const bedWidth = 160
  const bedLength = 210
  const bedHeight = 63
  const bedBathWallDistance = 100

  const bedCurrent = colors.colorize(
    hexToRgb('#009933'),
    startRoundedSlab({
      start: [
        backWallWidth - currentBedWindowsWallDistance - bedWidth,
        columnDeep + 2,
        -bedHeight,
      ],
      size: [bedWidth, bedLength, bedHeight],
      roundedCorners: ['front-left', 'front-right', 'back-left', 'back-right'],
      borderRadius: 10,
    }),
  )

  const bed = colors.colorize(
    hexToRgb('#0000ff'),
    startRoundedSlab({
      start: [bedBathWallDistance, columnDeep + 2, 0],
      size: [bedWidth, bedLength, bedHeight],
      roundedCorners: ['front-left', 'front-right', 'back-left', 'back-right'],
      borderRadius: 10,
    }),
  )

  // Imagination

  const backHeight = 85

  const fakeWindowColWidth = 8
  const fakeBathColWidth = 38
  const topHeight = 20

  const back = colors.colorize(
    hexToRgb('#aaaaaa'),
    booleans.union(
      // bed header
      startRoundedSlab({
        start: [0, 0, 0],
        size: [backWallWidth, columnDeep - 1, backHeight],
        roundedCorners: [
          'front-left',
          'front-right',
          'back-left',
          'back-right',
        ],
        borderRadius: 0,
      }),
      // fake window col
      startRoundedSlab({
        start: [backWallWidth - fakeWindowColWidth, 0, backHeight],
        size: [fakeWindowColWidth, columnDeep - 1, wallHeight - backHeight],
        roundedCorners: [
          'front-left',
          'front-right',
          'back-left',
          'back-right',
        ],
        borderRadius: 0,
      }),
      // bed header top
      startRoundedSlab({
        start: [bedBathWallDistance, 0, backHeight],
        size: [bedWidth, columnDeep - 1, wallHeight - backHeight],
        roundedCorners: [
          'front-left',
          'front-right',
          'back-left',
          'back-right',
        ],
        borderRadius: 0,
      }),
      // top
      startRoundedSlab({
        start: [0, 0, wallHeight - topHeight],
        size: [backWallWidth, columnDeep - 1, topHeight],
        roundedCorners: [
          'front-left',
          'front-right',
          'back-left',
          'back-right',
        ],
        borderRadius: 0,
      }),
      // fake bath col
      startRoundedSlab({
        start: [0, 0, backHeight],
        size: [fakeBathColWidth, columnDeep - 1, wallHeight - backHeight],
        roundedCorners: [
          'front-left',
          'front-right',
          'back-left',
          'back-right',
        ],
        borderRadius: 0,
      }),
    ),
  )

  return [
    floor,
    walls,
    colors.colorize(hexToRgb('#aaaaaa'), column),
    bed,
    bedCurrent,
    back,
  ]
}
