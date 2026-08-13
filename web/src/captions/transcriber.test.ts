import { describe, expect, it } from 'vitest'
import { dedupeSeam, segmentsToCues, splitSegment } from '@/captions/transcriber'
import { clipFromAsset } from '@/lib/clipFactory'
import type { Asset, VideoClip } from '@/schema/project'

const asset: Asset = {
  id: 'a1',
  kind: 'video',
  name: 'talk.mp4',
  hash: 'h1',
  duration: 60,
  width: 1920,
  height: 1080,
  fps: 30,
  hasAudio: true,
  mimeType: 'video/mp4',
}

function clip(start: number, duration: number, sourceIn = 0, speed = 1): VideoClip {
  const c = clipFromAsset(asset, start) as VideoClip
  c.duration = duration
  c.sourceIn = sourceIn
  c.speed = speed
  return c
}

describe('segmentsToCues', () => {
  it('offsets segment times by clip.start', () => {
    const cues = segmentsToCues([{ start: 1, end: 3, text: 'hello' }], clip(10, 20))
    expect(cues).toHaveLength(1)
    expect(cues[0].start).toBe(11)
    expect(cues[0].end).toBe(13)
    expect(cues[0].text).toBe('hello')
  })

  it('compresses source time by speed (2× clip plays source twice as fast)', () => {
    const cues = segmentsToCues([{ start: 4, end: 6, text: 'fast' }], clip(0, 10, 0, 2))
    // 4 source seconds land at 2 timeline seconds
    expect(cues[0].start).toBe(2)
    expect(cues[0].end).toBe(3)
  })

  it('drops cues that start after the clip ends on the timeline', () => {
    const cues = segmentsToCues(
      [
        { start: 1, end: 2, text: 'in range' },
        { start: 25, end: 26, text: 'out of range' },
      ],
      clip(0, 5),
    )
    expect(cues).toHaveLength(1)
    expect(cues[0].text).toBe('in range')
  })

  it('enforces a minimum cue duration', () => {
    const cues = segmentsToCues([{ start: 1, end: 1.05, text: 'blip' }], clip(0, 10))
    expect(cues[0].end - cues[0].start).toBeCloseTo(0.3)
  })
})

describe('splitSegment', () => {
  it('leaves short segments alone', () => {
    const seg = { start: 0, end: 5, text: 'Short one.' }
    expect(splitSegment(seg)).toEqual([seg])
  })

  it('splits long segments at sentence boundaries pro-rata', () => {
    const seg = {
      start: 0,
      end: 12,
      text: 'First sentence here. Second sentence follows! A third one?',
    }
    const parts = splitSegment(seg)
    expect(parts).toHaveLength(3)
    expect(parts[0].start).toBe(0)
    expect(parts[parts.length - 1].end).toBeCloseTo(12)
    // monotonic, contiguous
    for (let i = 1; i < parts.length; i++) {
      expect(parts[i].start).toBeCloseTo(parts[i - 1].end)
    }
  })

  it('keeps long single-sentence segments whole', () => {
    const seg = { start: 0, end: 10, text: 'no sentence boundaries in this run of words' }
    expect(splitSegment(seg)).toEqual([seg])
  })
})

describe('dedupeSeam', () => {
  const cue = (start: number, end: number, text: string) => ({ id: 'x', start, end, text })

  it('drops an identical repeated cue at the seam', () => {
    const last = cue(28, 30, 'and that is the story.')
    const incoming = [cue(30.1, 32, 'And that is the story'), cue(32, 34, 'Next part.')]
    const out = dedupeSeam(last, incoming)
    expect(out).toHaveLength(1)
    expect(out[0].text).toBe('Next part.')
  })

  it('drops a prefix repeat (window re-emits the tail sentence)', () => {
    const last = cue(28, 30, 'the quick brown fox jumps')
    const incoming = [cue(30.2, 31, 'The quick brown fox jumps over'), cue(31, 33, 'the lazy dog.')]
    const out = dedupeSeam(last, incoming)
    expect(out[0].text).toBe('the lazy dog.')
  })

  it('keeps cues far from the seam even when text matches', () => {
    const last = cue(10, 12, 'hello world')
    const incoming = [cue(20, 22, 'hello world')]
    expect(dedupeSeam(last, incoming)).toHaveLength(1)
  })

  it('keeps different text at the seam and handles null last', () => {
    const last = cue(28, 30, 'one thing')
    const incoming = [cue(30.1, 32, 'another thing entirely')]
    expect(dedupeSeam(last, incoming)).toHaveLength(1)
    expect(dedupeSeam(null, incoming)).toHaveLength(1)
  })
})
