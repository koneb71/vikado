import type { Transform } from '@/schema/project'

/**
 * Layer placement maths, kept free of WebGL so it can be tested directly.
 *
 * ORIENTATION CONTRACT (the ffmpeg renderer is the orientation of record —
 * see crates/vikado-renderer/src/filtergraph.rs):
 *   - The unit quad spans -0.5..0.5 in both axes. Its +y edge samples the
 *     TEXTURE'S TOP ROW, because the vertex shader flips v for top-left-origin
 *     sources (u_flipY is always on).
 *   - Therefore the quad's +y edge must land at the TOP of clip space, which
 *     is +y there too. The quad's y basis is NOT negated.
 *   - Only the TRANSLATION is negated, because layer.transform.y is canvas
 *     pixels growing downward while clip space grows upward.
 *   - Positive transform.rotation turns the layer CLOCKWISE on screen, and a
 *     rotated source's top-left corner moves to the top-right at 90 degrees.
 *
 * Negating the y basis as well (as the 0.1.0 release did) mirrors every layer
 * vertically, which is invisible to any preview-vs-local-export comparison
 * because both share this code — the divergence only shows against ffmpeg.
 */
export interface LayerGeometry {
  /** intrinsic pixel size of the source */
  width: number
  height: number
  transform: Transform
  fitMode?: 'contain' | 'cover' | 'none'
  flipH?: boolean
  flipV?: boolean
  /** extra stage-px translation applied after transform (slide transitions) */
  offsetX?: number
}

/**
 * quad (unit, centered) -> clip space, column-major mat3.
 * Media is "contain"-fitted to the stage at scale 1, then scaled/rotated and
 * offset by (x, y) canvas px (y down).
 */
export function layerMatrix(layer: LayerGeometry, stageWidth: number, stageHeight: number): Float32Array {
  const SW = stageWidth
  const SH = stageHeight
  const fit =
    layer.fitMode === 'none'
      ? 1
      : layer.fitMode === 'cover'
        ? Math.max(SW / layer.width, SH / layer.height)
        : Math.min(SW / layer.width, SH / layer.height)
  const w = layer.width * fit * layer.transform.scale * (layer.flipH ? -1 : 1)
  const h = layer.height * fit * layer.transform.scale * (layer.flipV ? -1 : 1)

  const rad = (layer.transform.rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  const sx = 2 / SW
  const sy = 2 / SH
  const tx = (layer.transform.x + (layer.offsetX ?? 0)) * sx
  // canvas y grows downward, clip space upward, so only the OFFSET is negated
  const ty = -layer.transform.y * sy

  return new Float32Array([
    (w * cos) * sx, (w * sin) * -sy, 0,
    (h * sin) * sx, (h * cos) * sy, 0,
    tx, ty, 1,
  ])
}

/** Apply a column-major mat3 to a quad corner, as the vertex shader does. */
export function applyMatrix(m: Float32Array, ax: number, ay: number): [number, number] {
  return [m[0] * ax + m[3] * ay + m[6], m[1] * ax + m[4] * ay + m[7]]
}
