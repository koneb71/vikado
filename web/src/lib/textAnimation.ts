import type { TextAnimation, TextClip } from '@/schema/project'

/**
 * Entrance/exit animation math for text clips.
 *
 * THE definition of what a text animation does. The preview folds the result
 * into the layer's transform; the ASS emitter samples it at segment boundaries
 * and emits \move / \t(\fscx\fscy) between them
 * (crates/vikado-renderer/src/ass.rs — keep both in step).
 *
 * Everything here is LINEAR in the animation's progress, because that is what
 * ASS \move and \t give us. Easing it on this side only would drift.
 */

export interface TextAnimationState {
  /** canvas px added to transform.x */
  offsetX: number
  /** canvas px added to transform.y (positive = down) */
  offsetY: number
  /** multiplier on transform.scale */
  scale: number
}

export const NEUTRAL_ANIMATION: TextAnimationState = { offsetX: 0, offsetY: 0, scale: 1 }

/** Travel distance for a slide: the text block itself, or a slice of canvas. */
function slideDistance(clip: TextClip, horizontal: boolean, canvasW: number, canvasH: number): number {
  const measured = horizontal ? clip.measuredWidth : clip.measuredHeight
  if (measured > 0) return measured
  return (horizontal ? canvasW : canvasH) * 0.1
}

/**
 * Contribution of one animation at progress `q`, where q=0 is fully "away"
 * and q=1 is at rest. Entrances run q 0→1, exits run q 1→0, so both share
 * this function.
 */
function contribution(
  animation: TextAnimation,
  q: number,
  clip: TextClip,
  canvasW: number,
  canvasH: number,
): TextAnimationState {
  const away = 1 - q
  switch (animation.type) {
    case 'slide-up': // enters from below, travelling up
      return { offsetX: 0, offsetY: away * slideDistance(clip, false, canvasW, canvasH), scale: 1 }
    case 'slide-down':
      return { offsetX: 0, offsetY: -away * slideDistance(clip, false, canvasW, canvasH), scale: 1 }
    case 'slide-left': // enters from the right, travelling left
      return { offsetX: away * slideDistance(clip, true, canvasW, canvasH), offsetY: 0, scale: 1 }
    case 'slide-right':
      return { offsetX: -away * slideDistance(clip, true, canvasW, canvasH), offsetY: 0, scale: 1 }
    case 'zoom-in': // grows into place from 60%
      return { offsetX: 0, offsetY: 0, scale: 0.6 + 0.4 * q }
    case 'zoom-out': // settles down from 140%
      return { offsetX: 0, offsetY: 0, scale: 1.4 - 0.4 * q }
  }
}

/**
 * Combined animation state at `localTime` seconds into the clip. In and out
 * compose: offsets add, scales multiply, so a clip can zoom in and slide out.
 */
export function textAnimationState(
  clip: TextClip,
  localTime: number,
  canvasW: number,
  canvasH: number,
): TextAnimationState {
  let { offsetX, offsetY, scale } = NEUTRAL_ANIMATION

  if (clip.animationIn) {
    const q = clamp01(localTime / clip.animationIn.duration)
    const c = contribution(clip.animationIn, q, clip, canvasW, canvasH)
    offsetX += c.offsetX
    offsetY += c.offsetY
    scale *= c.scale
  }
  if (clip.animationOut) {
    const q = clamp01((clip.duration - localTime) / clip.animationOut.duration)
    const c = contribution(clip.animationOut, q, clip, canvasW, canvasH)
    offsetX += c.offsetX
    offsetY += c.offsetY
    scale *= c.scale
  }
  return { offsetX, offsetY, scale }
}

/** True when the clip animates at all — the renderer only splits events then. */
export function hasTextAnimation(clip: TextClip): boolean {
  return clip.animationIn !== null || clip.animationOut !== null
}

/**
 * Clip-local times where the animation changes slope. The ASS emitter turns
 * each adjacent pair into one event with a linear \move/\t across it, which is
 * exact precisely because the ramps are linear between these points.
 */
export function animationSegments(clip: TextClip): number[] {
  const bounds = new Set([0, clip.duration])
  if (clip.animationIn) bounds.add(Math.min(clip.animationIn.duration, clip.duration))
  if (clip.animationOut) bounds.add(Math.max(0, clip.duration - clip.animationOut.duration))
  return [...bounds].sort((a, b) => a - b)
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}
