import { describe, expect, it } from 'vitest'
import { animationSegments, hasTextAnimation, textAnimationState } from '@/lib/textAnimation'
import { newTextClip } from '@/lib/clipFactory'
import type { TextAnimation, TextClip } from '@/schema/project'

/**
 * This math is mirrored by `text_animation_state` in crates/vikado-types. The
 * ASS emitter samples it only at segment boundaries and lets libass interpolate
 * between them, which is exact ONLY while every ramp stays linear — so these
 * cases pin the endpoints AND the midpoint of each ramp.
 */

const W = 1920
const H = 1080

function clip(over: Partial<TextClip> = {}): TextClip {
  return { ...newTextClip(0), duration: 4, measuredWidth: 400, measuredHeight: 90, ...over }
}

const anim = (type: TextAnimation['type'], duration: number): TextAnimation => ({ type, duration })

describe('textAnimationState entrances', () => {
  it('slide-up starts one block below and arrives at rest', () => {
    const c = clip({ animationIn: anim('slide-up', 0.5) })
    expect(textAnimationState(c, 0, W, H).offsetY).toBeCloseTo(90)
    expect(textAnimationState(c, 0.5, W, H).offsetY).toBeCloseTo(0)
  })

  it('slide-down comes from above', () => {
    const c = clip({ animationIn: anim('slide-down', 0.5) })
    expect(textAnimationState(c, 0, W, H).offsetY).toBeCloseTo(-90)
  })

  it('slide-left enters from the right by one block width', () => {
    const c = clip({ animationIn: anim('slide-left', 0.5) })
    expect(textAnimationState(c, 0, W, H).offsetX).toBeCloseTo(400)
    expect(textAnimationState(c, 0.5, W, H).offsetX).toBeCloseTo(0)
  })

  it('ramps linearly, which is what ASS \\move interpolates', () => {
    const c = clip({ animationIn: anim('slide-up', 1) })
    expect(textAnimationState(c, 0.25, W, H).offsetY).toBeCloseTo(67.5)
    expect(textAnimationState(c, 0.5, W, H).offsetY).toBeCloseTo(45)
    expect(textAnimationState(c, 0.75, W, H).offsetY).toBeCloseTo(22.5)
  })

  it('zoom-in grows 0.6 -> 1 and zoom-out shrinks 1.4 -> 1', () => {
    const zin = clip({ animationIn: anim('zoom-in', 1) })
    expect(textAnimationState(zin, 0, W, H).scale).toBeCloseTo(0.6)
    expect(textAnimationState(zin, 0.5, W, H).scale).toBeCloseTo(0.8)
    expect(textAnimationState(zin, 1, W, H).scale).toBeCloseTo(1)

    const zout = clip({ animationIn: anim('zoom-out', 1) })
    expect(textAnimationState(zout, 0, W, H).scale).toBeCloseTo(1.4)
    expect(textAnimationState(zout, 1, W, H).scale).toBeCloseTo(1)
  })

  it('holds at rest once the entrance is over', () => {
    const c = clip({ animationIn: anim('slide-up', 0.5) })
    expect(textAnimationState(c, 2, W, H)).toEqual({ offsetX: 0, offsetY: 0, scale: 1 })
  })

  it('falls back to a slice of the canvas when the block is unmeasured', () => {
    const c = clip({ animationIn: anim('slide-up', 0.5), measuredHeight: 0 })
    expect(textAnimationState(c, 0, W, H).offsetY).toBeCloseTo(H * 0.1)
  })
})

describe('textAnimationState exits', () => {
  it('runs in reverse over the tail of the clip', () => {
    const c = clip({ animationOut: anim('slide-left', 0.8) })
    expect(textAnimationState(c, 3.2, W, H).offsetX).toBeCloseTo(0)
    expect(textAnimationState(c, 4, W, H).offsetX).toBeCloseTo(400)
  })

  it('leaves the clip alone before the exit begins', () => {
    const c = clip({ animationOut: anim('zoom-out', 0.5) })
    expect(textAnimationState(c, 1, W, H).scale).toBeCloseTo(1)
  })
})

describe('textAnimationState composition', () => {
  it('adds offsets and multiplies scales when both ends animate', () => {
    const c = clip({ animationIn: anim('zoom-in', 1), animationOut: anim('slide-left', 1) })
    // at t=0: entrance fully away (scale 0.6), exit at rest
    expect(textAnimationState(c, 0, W, H)).toMatchObject({ offsetX: 0, scale: 0.6 })
    // at t=4: entrance at rest, exit fully away
    expect(textAnimationState(c, 4, W, H)).toMatchObject({ offsetX: 400, scale: 1 })
  })
})

describe('animationSegments', () => {
  it('is just the clip bounds when nothing animates', () => {
    expect(animationSegments(clip())).toEqual([0, 4])
    expect(hasTextAnimation(clip())).toBe(false)
  })

  it('breaks at the end of the entrance and the start of the exit', () => {
    const c = clip({ animationIn: anim('slide-up', 0.5), animationOut: anim('zoom-out', 1) })
    expect(animationSegments(c)).toEqual([0, 0.5, 3, 4])
  })

  it('stays sorted and inside the clip when an animation is longer than the clip', () => {
    const c = clip({ duration: 1, animationIn: anim('slide-up', 5), animationOut: anim('zoom-in', 5) })
    const segs = animationSegments(c)
    expect(segs[0]).toBe(0)
    expect(segs[segs.length - 1]).toBe(1)
    expect([...segs].sort((a, b) => a - b)).toEqual(segs)
    expect(segs.every((s) => s >= 0 && s <= 1)).toBe(true)
  })
})
