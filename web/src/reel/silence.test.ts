import { describe, expect, it } from 'vitest'
import { detectSpeechRanges, totalLength } from '@/reel/silence'

const BPS = 50

/** Waveform peaks from [seconds, amplitude] spans, as media/waveforms.ts stores them. */
function peaks(...spans: [number, number][]): Float32Array {
  const buckets = spans.reduce((n, [s]) => n + Math.round(s * BPS), 0)
  const out = new Float32Array(buckets * 2)
  let b = 0
  for (const [seconds, amp] of spans) {
    for (let i = 0; i < Math.round(seconds * BPS); i++, b++) {
      out[b * 2] = -amp
      out[b * 2 + 1] = amp
    }
  }
  return out
}

const SPEECH = 0.3 // about -10 dBFS
const ROOM = 0.002 // about -54 dBFS

describe('detectSpeechRanges', () => {
  it('cuts dead air between phrases, keeping a little padding', () => {
    const p = peaks([1, ROOM], [2, SPEECH], [2, ROOM], [3, SPEECH], [1, ROOM])
    const ranges = detectSpeechRanges(p, BPS, 9)
    expect(ranges).toHaveLength(2)
    expect(ranges[0].start).toBeCloseTo(0.88)
    expect(ranges[0].end).toBeCloseTo(3.12)
    expect(ranges[1].start).toBeCloseTo(4.88)
    expect(ranges[1].end).toBeCloseTo(8.12)
  })

  it('bridges pauses shorter than minSilence', () => {
    const p = peaks([1, SPEECH], [0.3, ROOM], [1, SPEECH])
    expect(detectSpeechRanges(p, BPS, 2.3)).toEqual([{ start: 0, end: 2.3 }])
  })

  it('adapts to a noisy room: silence is relative to the floor', () => {
    const noisy = 0.03 // about -30 dBFS, above any fixed "silence" cutoff
    const p = peaks([2, noisy], [2, 0.5], [2, noisy], [2, 0.5])
    const ranges = detectSpeechRanges(p, BPS, 8)
    expect(ranges).toHaveLength(2)
    // padded both sides, except where the clip ends
    expect(totalLength(ranges)).toBeCloseTo(4 + 3 * 0.12, 5)
  })

  it('keeps the whole clip when there is no audio or no contrast', () => {
    expect(detectSpeechRanges(null, BPS, 5)).toEqual([{ start: 0, end: 5 }])
    expect(detectSpeechRanges(peaks([5, 0]), BPS, 5)).toEqual([{ start: 0, end: 5 }])
    expect(detectSpeechRanges(peaks([5, SPEECH]), BPS, 5)).toEqual([{ start: 0, end: 5 }])
  })

  it('keeps the whole clip rather than gutting it', () => {
    // a single cough in a long quiet take: keeping 0.3 s of 20 s is a misread
    const p = peaks([10, ROOM], [0.2, SPEECH], [10, ROOM])
    expect(detectSpeechRanges(p, BPS, 20.2)).toEqual([{ start: 0, end: 20.2 }])
  })

  it('drops clicks too short to be speech', () => {
    const p = peaks([3, SPEECH], [2, ROOM], [0.04, SPEECH], [2, ROOM], [3, SPEECH])
    const ranges = detectSpeechRanges(p, BPS, 10.04)
    expect(ranges).toHaveLength(2)
  })
})
