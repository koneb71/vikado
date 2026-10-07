import type { Asset, Crop } from '@/schema/project'

/** Facebook Reels: 9:16 at 1080×1920, 30 fps, up to 90 s. */
export const REEL_WIDTH = 1080
export const REEL_HEIGHT = 1920
export const REEL_FPS = 30
export const REEL_MAX_DURATION = 90

/**
 * How a source that isn't 9:16 sits in the frame:
 *  - fill: center-crop to the canvas aspect, nothing letterboxed
 *  - blur: show the whole frame over a blurred cover-fit copy of itself
 */
export type Framing = 'fill' | 'blur'

/** aspects within this ratio of the canvas fill it as-is */
const ASPECT_TOLERANCE = 0.03

function aspectOf(asset: Pick<Asset, 'width' | 'height'>): number | null {
  return asset.width && asset.height ? asset.width / asset.height : null
}

/** True when the source already fills a 9:16 frame (give or take a sliver). */
export function matchesCanvas(
  asset: Pick<Asset, 'width' | 'height'>,
  canvasW = REEL_WIDTH,
  canvasH = REEL_HEIGHT,
): boolean {
  const aspect = aspectOf(asset)
  return aspect === null || Math.abs(aspect / (canvasW / canvasH) - 1) <= ASPECT_TOLERANCE
}

/**
 * Portrait footage (phone video, 3:4) crops to fill with little loss;
 * square and landscape footage would lose too much, so it gets the blur.
 */
export function defaultFraming(asset: Pick<Asset, 'width' | 'height'>): Framing {
  const aspect = aspectOf(asset)
  return aspect !== null && aspect < 1 ? 'fill' : 'blur'
}

/**
 * Clip fields that place `asset` in the canvas. The crop is applied before
 * the renderers' contain-fit, so a crop with exactly the canvas aspect fills
 * the frame edge to edge in both the preview and ffmpeg.
 */
export function frameForReel(
  asset: Pick<Asset, 'width' | 'height'>,
  framing: Framing,
  canvasW = REEL_WIDTH,
  canvasH = REEL_HEIGHT,
): { crop: Crop | null; backgroundBlur: boolean } {
  const aspect = aspectOf(asset)
  if (aspect === null || matchesCanvas(asset, canvasW, canvasH)) {
    return { crop: null, backgroundBlur: false }
  }
  if (framing === 'blur') return { crop: null, backgroundBlur: true }

  const target = canvasW / canvasH
  if (aspect > target) {
    const w = target / aspect
    return { crop: { x: (1 - w) / 2, y: 0, w, h: 1 }, backgroundBlur: false }
  }
  const h = aspect / target
  return { crop: { x: 0, y: (1 - h) / 2, w: 1, h }, backgroundBlur: false }
}
