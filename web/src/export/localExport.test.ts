import { describe, expect, it } from 'vitest'
import { fadeCurve, outputSize } from '@/export/localExport'
import { fadeEnvelope } from '@/engine/activeClips'
import { clipFromAsset } from '@/lib/clipFactory'
import { createProject, type Asset, type Project, type VideoClip } from '@/schema/project'

/**
 * outputSize mirrors RenderOptions::output_size in crates/vikado-types. Both
 * exports must agree on dimensions or the same project renders at different
 * sizes depending on which engine the user picked, so the cases below are the
 * ones where rounding could diverge.
 */

function project(width: number, height: number): Project {
  const p = createProject()
  p.width = width
  p.height = height
  return p
}

const high = (scale: number) => ({ quality: 'high' as const, scale })

describe('outputSize', () => {
  it('passes the canvas through at full scale', () => {
    expect(outputSize(project(1920, 1080), high(1))).toEqual([1920, 1080])
    expect(outputSize(project(1080, 1920), high(1))).toEqual([1080, 1920])
  })

  it('halves and three-quarters cleanly', () => {
    expect(outputSize(project(1920, 1080), high(0.5))).toEqual([960, 540])
    expect(outputSize(project(1920, 1080), high(0.75))).toEqual([1440, 810])
  })

  it('always returns even dimensions, which the encoder requires', () => {
    // 1080 * 0.75 = 810 (even); 1918 * 0.75 = 1438.5 -> rounds to an even number
    for (const [w, h] of [
      [1918, 1080],
      [1280, 722],
      [1001, 999],
    ]) {
      for (const scale of [1, 0.75, 0.5, 0.25]) {
        const [ow, oh] = outputSize(project(w, h), high(scale))
        expect(ow % 2).toBe(0)
        expect(oh % 2).toBe(0)
      }
    }
  })

  it('clamps the scale to the range the schema allows', () => {
    expect(outputSize(project(1920, 1080), high(4))).toEqual([1920, 1080])
    expect(outputSize(project(1920, 1080), high(0))).toEqual([480, 270])
  })

  it('never collapses a dimension to zero', () => {
    const [w, h] = outputSize(project(4, 2), high(0.25))
    expect(w).toBeGreaterThanOrEqual(2)
    expect(h).toBeGreaterThanOrEqual(2)
  })
})

/**
 * The export's gain curve has to agree with the preview's fadeEnvelope and with
 * ffmpeg's chained afade filters. All three MULTIPLY the two fades; scheduling
 * them as separate Web Audio ramp events does not, which is what this covers.
 */
const audioAsset: Asset = {
  id: 'a1',
  kind: 'video',
  name: 'clip.mp4',
  hash: 'h1',
  duration: 30,
  width: 1920,
  height: 1080,
  fps: 30,
  hasAudio: true,
  mimeType: 'video/mp4',
}

function clipWith(duration: number, fadeIn: number, fadeOut: number): VideoClip {
  const clip = clipFromAsset(audioAsset, 0) as VideoClip
  clip.duration = duration
  clip.fadeIn = fadeIn
  clip.fadeOut = fadeOut
  return clip
}

describe('fadeCurve', () => {
  it('matches fadeEnvelope at every sample', () => {
    const clip = clipWith(4, 1, 1.5)
    const curve = fadeCurve(clip, 0.8)
    for (let i = 0; i < curve.length; i++) {
      const local = (i / (curve.length - 1)) * clip.duration
      expect(curve[i]).toBeCloseTo(0.8 * fadeEnvelope(clip, local), 5)
    }
  })

  it('multiplies overlapping fades rather than jumping to full volume', () => {
    // reachable from the inspector: any clip under 1s can have 0.5s of each
    const clip = clipWith(0.6, 0.5, 0.5)
    const curve = fadeCurve(clip, 1)
    // the product peaks at 0.36 at the midpoint; scheduling the fades as
    // independent ramp events gave a hard step to 1.0 instead
    expect(Math.max(...curve)).toBeLessThan(0.4)
    expect(Math.max(...curve)).toBeCloseTo(0.36, 2)
  })

  it('has no discontinuity between adjacent samples', () => {
    const clip = clipWith(0.6, 0.5, 0.5)
    const curve = fadeCurve(clip, 1)
    for (let i = 1; i < curve.length; i++) {
      expect(Math.abs(curve[i] - curve[i - 1])).toBeLessThan(0.05)
    }
  })

  it('starts and ends at silence when both fades are set', () => {
    const curve = fadeCurve(clipWith(4, 1, 1), 1)
    expect(curve[0]).toBeCloseTo(0, 5)
    expect(curve[curve.length - 1]).toBeCloseTo(0, 5)
  })

  it('scales by clip volume', () => {
    const curve = fadeCurve(clipWith(4, 0, 0), 0.25)
    expect(Math.max(...curve)).toBeCloseTo(0.25, 5)
  })
})
