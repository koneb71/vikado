/**
 * Dead-air detection on cached waveform peaks (see media/waveforms.ts).
 *
 * Works on the min/max pairs the timeline already draws, so finding speech
 * needs no second audio decode. The threshold adapts to each clip: a quiet
 * lavalier and a noisy street both split cleanly, because "silence" means
 * "near this clip's own noise floor", not a fixed dBFS.
 */

/** A [start, end) span of source seconds. */
export interface Range {
  start: number
  end: number
}

export interface SilenceOptions {
  /** quiet stretches shorter than this are pauses, not dead air (s) */
  minSilence: number
  /** breathing room kept around each spoken range (s) */
  padding: number
  /** spoken ranges shorter than this are clicks/bumps and dropped (s) */
  minKeep: number
  /** keeping less than this fraction means detection misread the clip */
  minKeptFraction: number
}

export const DEFAULT_SILENCE_OPTIONS: SilenceOptions = {
  minSilence: 0.5,
  padding: 0.12,
  minKeep: 0.3,
  minKeptFraction: 0.2,
}

/** dB above the noise floor that counts as sound */
const FLOOR_MARGIN_DB = 10
/** never call anything below this "sound", however quiet the floor */
const ABSOLUTE_MIN_DB = -50
/** loud and quiet parts closer than this → no real pauses to cut */
const MIN_CONTRAST_DB = 12

export function totalLength(ranges: Range[]): number {
  return ranges.reduce((sum, r) => sum + (r.end - r.start), 0)
}

/**
 * Spoken (non-silent) ranges of a clip, in source seconds. Falls back to the
 * whole clip when there is nothing meaningful to cut: no audio, constant
 * music, or detection that would throw most of the clip away.
 */
export function detectSpeechRanges(
  peaks: Float32Array | null,
  bucketsPerSecond: number,
  duration: number,
  options: Partial<SilenceOptions> = {},
): Range[] {
  const opts = { ...DEFAULT_SILENCE_OPTIONS, ...options }
  const whole = [{ start: 0, end: duration }]
  if (!peaks || duration <= 0) return whole

  const buckets = Math.min(peaks.length >> 1, Math.ceil(duration * bucketsPerSecond))
  if (buckets === 0) return whole

  const levels = new Float32Array(buckets)
  for (let i = 0; i < buckets; i++) {
    const amp = Math.max(Math.abs(peaks[i * 2]), Math.abs(peaks[i * 2 + 1]))
    levels[i] = 20 * Math.log10(Math.max(amp, 1e-6))
  }

  const sorted = levels.slice().sort()
  const floor = percentile(sorted, 0.15)
  const loud = percentile(sorted, 0.95)
  if (loud - floor < MIN_CONTRAST_DB) return whole
  const threshold = Math.max(floor + FLOOR_MARGIN_DB, ABSOLUTE_MIN_DB)

  // runs of sound, in bucket indices [start, end)
  const runs: [number, number][] = []
  for (let i = 0; i < buckets; i++) {
    if (levels[i] < threshold) continue
    const last = runs[runs.length - 1]
    if (last && last[1] === i) last[1] = i + 1
    else runs.push([i, i + 1])
  }

  // bridge pauses too short to be dead air, then pad (merging any overlap)
  const bridge = opts.minSilence * bucketsPerSecond
  const ranges: Range[] = []
  let prevEnd = -Infinity
  for (const [s, e] of runs) {
    const start = Math.max(0, s / bucketsPerSecond - opts.padding)
    const end = Math.min(duration, e / bucketsPerSecond + opts.padding)
    const last = ranges[ranges.length - 1]
    if (last && (s - prevEnd < bridge || start <= last.end)) last.end = end
    else ranges.push({ start, end })
    prevEnd = e
  }

  const kept = ranges.filter((r) => r.end - r.start >= opts.minKeep)
  if (totalLength(kept) < duration * opts.minKeptFraction) return whole
  return kept
}

function percentile(sorted: Float32Array, p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]
}
