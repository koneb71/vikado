import { describe, expect, it } from 'vitest'
import { mapCuesToTimeline, toReelCaptions } from '@/reel/captions'
import type { ReelSegment } from '@/reel/plan'

const seg = (source: number, sourceIn: number, start: number, duration: number): ReelSegment => ({
  source,
  sourceIn,
  start,
  duration,
  transitionOut: null,
})

// source 0 keeps [1, 3) and [5, 9); source 1 follows on the timeline
const segments = [seg(0, 1, 0, 2), seg(0, 5, 2, 4), seg(1, 0, 6, 3)]

describe('mapCuesToTimeline', () => {
  it('shifts cues into timeline time', () => {
    expect(mapCuesToTimeline([{ start: 6, end: 7, text: 'hi' }], segments, 0)).toEqual([
      { start: 3, end: 4, text: 'hi' },
    ])
  })

  it('closes a cue up around cut silence', () => {
    // 2.5 → 5.5 straddles the cut [3, 5): 0.5 s before, 0.5 s after
    expect(mapCuesToTimeline([{ start: 2.5, end: 5.5, text: 'a b' }], segments, 0)).toEqual([
      { start: 1.5, end: 2.5, text: 'a b' },
    ])
  })

  it('drops cues that fell entirely into cut material', () => {
    expect(mapCuesToTimeline([{ start: 3.2, end: 4.8, text: 'um' }], segments, 0)).toEqual([])
    expect(mapCuesToTimeline([{ start: 9.5, end: 11, text: 'bye' }], segments, 0)).toEqual([])
  })

  it('only maps onto its own source', () => {
    expect(mapCuesToTimeline([{ start: 0, end: 1, text: 'b' }], segments, 1)).toEqual([
      { start: 6, end: 7, text: 'b' },
    ])
  })
})

describe('toReelCaptions', () => {
  it('splits sentences into short groups timed by length', () => {
    const out = toReelCaptions(
      [{ start: 0, end: 4, text: 'one two three four five six seven eight' }],
      30,
    )
    expect(out.map((c) => c.text)).toEqual(['one two three four', 'five six seven eight'])
    expect(out[0].start).toBe(0)
    expect(out[1].end).toBe(4)
    expect(out[0].end).toBe(out[1].start)
  })

  it('never overlaps, stays on the frame grid', () => {
    const out = toReelCaptions(
      [
        { start: 0, end: 2.01, text: 'first' },
        { start: 1.5, end: 3, text: 'second' },
      ],
      30,
    )
    expect(out[0].end).toBeLessThanOrEqual(out[1].start)
    for (const c of out) expect(Math.abs(c.start * 30 - Math.round(c.start * 30))).toBeLessThan(1e-9)
  })

  it('wraps long words onto their own group', () => {
    const out = toReelCaptions([{ start: 0, end: 3, text: 'internationalization is hard' }], 30)
    expect(out.map((c) => c.text)).toEqual(['internationalization', 'is hard'])
  })
})
