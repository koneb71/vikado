import { clipFromAsset } from '@/lib/clipFactory'
import * as db from '@/media/db'
import { BUCKETS_PER_SECOND, generateWaveform } from '@/media/waveforms'
import { transcribeClip } from '@/captions/transcriber'
import { createProject, type Asset } from '@/schema/project'
import { detectSpeechRanges, type Range } from '@/reel/silence'
import type { TimedText } from '@/reel/captions'

/**
 * Browser-side inputs for the pure Reel planner: speech ranges from the
 * cached waveform, and whisper captions in source time.
 */

/** Spoken ranges of a video (the whole clip when it has no audio). */
export async function analyzeSpeech(asset: Asset): Promise<Range[]> {
  const duration = asset.duration ?? 0
  await generateWaveform(asset).catch(() => {}) // no-op when cached
  const entry = await db.getWaveform(asset.hash)
  return detectSpeechRanges(entry?.peaks ?? null, entry?.bucketsPerSecond ?? BUCKETS_PER_SECOND, duration)
}

export interface TranscribeJob {
  result: Promise<TimedText[]>
  cancel: () => void
}

/**
 * Transcribe `span` of a video once, returning cues in source seconds.
 * A stand-in clip placed at its own source time makes the transcriber's
 * timeline-time output read as source time directly.
 */
export function transcribeSpan(
  asset: Asset,
  span: Range,
  language: string | undefined,
  onProgress: (phase: 'downloading' | 'transcribing', fraction: number) => void,
): TranscribeJob {
  const clip = clipFromAsset(asset, span.start)
  if (clip.type !== 'video') throw new Error(`${asset.name} is not a video`)
  clip.sourceIn = span.start
  clip.duration = span.end - span.start
  const project = { ...createProject(), assets: [asset] }

  let cancel = () => {}
  const result = new Promise<TimedText[]>((resolve, reject) => {
    const cues: TimedText[] = []
    const handle = transcribeClip(
      project,
      clip,
      {
        modelProgress: (f) => onProgress('downloading', f),
        progress: (f) => onProgress('transcribing', f),
        segments: (batch) => cues.push(...batch.map(({ start, end, text }) => ({ start, end, text }))),
        done: () => resolve(cues),
        error: (message) => reject(new Error(message)),
        cancelled: () => reject(new DOMException('Cancelled', 'AbortError')),
      },
      language,
    )
    cancel = handle.cancel
  })
  return { result, cancel: () => cancel() }
}
