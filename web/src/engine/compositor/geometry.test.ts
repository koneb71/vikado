import { describe, expect, it } from 'vitest'
import { applyMatrix, layerMatrix, type LayerGeometry } from '@/engine/compositor/geometry'

/**
 * Orientation is the one thing a preview-vs-local-export comparison can never
 * check: both share this code, so a flip in here cancels out and looks like
 * perfect parity. These cases are pinned against the ffmpeg renderer, which is
 * the orientation of record — the corner expectations below were read off real
 * `vikado-renderer` output for the same project (a quad image with
 * TL=red TR=green BL=blue BR=white).
 *
 * The quad spans -0.5..0.5 and its +y edge samples the TEXTURE'S TOP ROW
 * (the vertex shader flips v), so "+y maps to positive clip y" means upright.
 */

const SW = 1920
const SH = 1080

function layer(over: Partial<LayerGeometry> = {}): LayerGeometry {
  return {
    width: 1920,
    height: 1080,
    transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
    ...over,
  }
}

/** Where does the source's top-left corner land, in clip space? */
function sourceTopLeft(l: LayerGeometry): [number, number] {
  return applyMatrix(layerMatrix(l, SW, SH), -0.5, 0.5)
}

function sourceTopRight(l: LayerGeometry): [number, number] {
  return applyMatrix(layerMatrix(l, SW, SH), 0.5, 0.5)
}

describe('layerMatrix orientation', () => {
  it('puts the source top edge at the top of the screen', () => {
    const [, y] = sourceTopLeft(layer())
    expect(y).toBeGreaterThan(0) // clip space +y is up
  })

  it('puts the source bottom edge at the bottom of the screen', () => {
    const [, y] = applyMatrix(layerMatrix(layer(), SW, SH), -0.5, -0.5)
    expect(y).toBeLessThan(0)
  })

  it('keeps left on the left', () => {
    const [x] = sourceTopLeft(layer())
    expect(x).toBeLessThan(0)
  })

  it('maps the whole frame to the full stage when it matches the canvas', () => {
    const [x, y] = sourceTopLeft(layer())
    expect(x).toBeCloseTo(-1, 6)
    expect(y).toBeCloseTo(1, 6)
  })
})

describe('layerMatrix flips', () => {
  it('flipH mirrors horizontally and leaves vertical alone', () => {
    const [x, y] = sourceTopLeft(layer({ flipH: true }))
    expect(x).toBeGreaterThan(0) // top-left now draws on the right
    expect(y).toBeGreaterThan(0) // still the top
  })

  it('flipV mirrors vertically and leaves horizontal alone', () => {
    const [x, y] = sourceTopLeft(layer({ flipV: true }))
    expect(x).toBeLessThan(0)
    expect(y).toBeLessThan(0)
  })
})

describe('layerMatrix rotation', () => {
  // ffmpeg render of rotation=90 puts the source's top-left at the TOP-RIGHT
  it('turns clockwise: at 90deg the top-left corner moves to the top-right', () => {
    const square = layer({ width: 400, height: 400, transform: { x: 0, y: 0, scale: 1, rotation: 90, opacity: 1 } })
    const [x, y] = sourceTopLeft(square)
    expect(x).toBeGreaterThan(0)
    expect(y).toBeGreaterThan(0)
  })

  it('turns clockwise: at 90deg the top-right corner moves to the bottom-right', () => {
    const square = layer({ width: 400, height: 400, transform: { x: 0, y: 0, scale: 1, rotation: 90, opacity: 1 } })
    const [x, y] = sourceTopRight(square)
    expect(x).toBeGreaterThan(0)
    expect(y).toBeLessThan(0)
  })
})

describe('layerMatrix translation', () => {
  it('moves the layer DOWN the screen for a positive transform.y', () => {
    const base = applyMatrix(layerMatrix(layer(), SW, SH), 0, 0)
    const moved = applyMatrix(
      layerMatrix(layer({ transform: { x: 0, y: 200, scale: 1, rotation: 0, opacity: 1 } }), SW, SH),
      0,
      0,
    )
    expect(moved[1]).toBeLessThan(base[1]) // clip y decreases downward
  })

  it('moves the layer RIGHT for a positive transform.x', () => {
    const moved = applyMatrix(
      layerMatrix(layer({ transform: { x: 200, y: 0, scale: 1, rotation: 0, opacity: 1 } }), SW, SH),
      0,
      0,
    )
    expect(moved[0]).toBeGreaterThan(0)
  })

  it('applies offsetX on top of transform.x (slide transitions)', () => {
    const withOffset = applyMatrix(layerMatrix(layer({ offsetX: 480 }), SW, SH), 0, 0)
    expect(withOffset[0]).toBeCloseTo((480 * 2) / SW, 6)
  })
})

describe('layerMatrix fit modes', () => {
  it("'contain' fits a square source inside a wide stage without cropping", () => {
    const [x, y] = sourceTopLeft(layer({ width: 400, height: 400 }))
    expect(Math.abs(x)).toBeLessThan(1) // pillarboxed
    expect(y).toBeCloseTo(1, 6) // full height
  })

  it("'cover' fills the stage, overflowing the narrow axis", () => {
    const [x, y] = sourceTopLeft(layer({ width: 400, height: 400, fitMode: 'cover' }))
    expect(x).toBeCloseTo(-1, 6)
    expect(Math.abs(y)).toBeGreaterThan(1) // cropped top and bottom
  })

  it("'none' maps source pixels 1:1 to stage pixels (text, subtitles)", () => {
    const [x, y] = sourceTopLeft(layer({ width: 192, height: 108, fitMode: 'none' }))
    expect(x).toBeCloseTo(-0.1, 6) // 192px of a 1920px stage
    expect(y).toBeCloseTo(0.1, 6) // 108px of a 1080px stage
  })
})
