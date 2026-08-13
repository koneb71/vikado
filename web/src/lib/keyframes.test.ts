import { describe, expect, it } from 'vitest'
import {
  easeProgress,
  keyframeTimes,
  removeKeyframeAt,
  sampleTrack,
  sampleTransform,
  upsertKeyframe,
} from '@/lib/keyframes'
import { emptyKeyframes, type Keyframe, type ImageClip } from '@/schema/project'

const kf = (t: number, value: number, easing: Keyframe['easing'] = 'linear'): Keyframe => ({
  t,
  value,
  easing,
})

describe('sampleTrack', () => {
  it('returns fallback when empty', () => {
    expect(sampleTrack([], 1, 42)).toBe(42)
  })

  it('clamps outside the range', () => {
    const track = [kf(1, 10), kf(3, 30)]
    expect(sampleTrack(track, 0, 0)).toBe(10)
    expect(sampleTrack(track, 5, 0)).toBe(30)
  })

  it('interpolates linearly between keyframes', () => {
    const track = [kf(0, 0), kf(2, 100)]
    expect(sampleTrack(track, 1, 0)).toBe(50)
    expect(sampleTrack(track, 0.5, 0)).toBe(25)
  })

  it('uses the left keyframe easing', () => {
    const track = [kf(0, 0, 'ease-in'), kf(2, 100)]
    expect(sampleTrack(track, 1, 0)).toBe(25) // p=0.5 → p²=0.25
  })

  it('handles multiple segments', () => {
    const track = [kf(0, 0), kf(1, 10), kf(3, 30)]
    expect(sampleTrack(track, 0.5, 0)).toBe(5)
    expect(sampleTrack(track, 2, 0)).toBe(20)
  })
})

describe('easeProgress', () => {
  it('all easings hit the endpoints', () => {
    for (const e of ['linear', 'ease-in', 'ease-out', 'ease-in-out'] as const) {
      expect(easeProgress(e, 0)).toBe(0)
      expect(easeProgress(e, 1)).toBe(1)
    }
  })
})

describe('sampleTransform', () => {
  const clip: ImageClip = {
    type: 'image',
    id: 'c1',
    start: 5,
    duration: 4,
    assetId: 'a1',
    flipH: false,
    flipV: false,
    chromaKey: null,
    backgroundBlur: false,
    crop: null,
    transform: { x: 100, y: -50, scale: 1, rotation: 0, opacity: 1 },
    keyframes: { ...emptyKeyframes(), x: [kf(0, 0), kf(4, 400)] },
    adjustments: { brightness: 0, contrast: 0, saturation: 0, temperature: 0 },
    filter: null,
    fadeIn: 0,
    fadeOut: 0,
    transitionOut: null,
  }

  it('animates keyframed properties and keeps static ones', () => {
    const at2 = sampleTransform(clip, 2)
    expect(at2.x).toBe(200) // animated
    expect(at2.y).toBe(-50) // static fallback
    expect(at2.scale).toBe(1)
  })

  it('returns the static transform when there are no keyframes', () => {
    const staticClip = { ...clip, keyframes: emptyKeyframes() }
    expect(sampleTransform(staticClip, 2)).toBe(staticClip.transform)
  })
})

describe('upsert/remove', () => {
  it('inserts sorted and replaces within half a frame', () => {
    let track = upsertKeyframe([], 2, 10)
    track = upsertKeyframe(track, 1, 5)
    expect(track.map((k) => k.t)).toEqual([1, 2])
    track = upsertKeyframe(track, 2.001, 99) // within EPS of 2
    expect(track).toHaveLength(2)
    expect(track[1].value).toBe(99)
  })

  it('preserves easing when replacing', () => {
    let track = [kf(2, 10, 'ease-out')]
    track = upsertKeyframe(track, 2, 20)
    expect(track[0].easing).toBe('ease-out')
  })

  it('removes at time', () => {
    const track = [kf(1, 5), kf(2, 10)]
    expect(removeKeyframeAt(track, 2).map((k) => k.t)).toEqual([1])
  })
})

describe('keyframeTimes', () => {
  it('aggregates and dedupes across properties', () => {
    const keyframes = {
      ...emptyKeyframes(),
      x: [kf(0, 0), kf(2, 10)],
      opacity: [kf(2, 1), kf(3, 0)],
    }
    expect(keyframeTimes(keyframes)).toEqual([0, 2, 3])
  })
})
