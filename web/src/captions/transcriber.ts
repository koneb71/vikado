import { nanoid } from 'nanoid'
import type { AudioClip, Project, SubtitleCue, VideoClip } from '@/schema/project'
import { extractPcm16k } from '@/captions/pcm'
import {
  DEFAULT_WHISPER_MODEL,
  type RawSegment,
  type WorkerIn,
  type WorkerOut,
} from '@/captions/protocol'
import { clipSpeed } from '@/lib/timelineOps'

export interface TranscribeCallbacks {
  /** model download progress, 0..1 (only fires on first ever run) */
  modelProgress?: (fraction: number) => void
  /** cues for one window, already offset to timeline time */
  segments: (cues: SubtitleCue[]) => void
  /** transcription progress 0..1 */
  progress: (fraction: number) => void
  done: () => void
  error: (message: string) => void
  cancelled: () => void
}

export interface TranscribeHandle {
  cancel: () => void
}

/** cues longer than this get split at sentence boundaries for readability */
const MAX_CUE_S = 7
const MIN_CUE_S = 0.3
/** seam window: repeated text this close to the previous cue is a duplicate */
const SEAM_GAP_S = 1.5

/** Languages offered in the UI (whisper language codes). */
export const CAPTION_LANGUAGES: { code: string | null; label: string }[] = [
  { code: null, label: 'Auto-detect' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' },
  { code: 'it', label: 'Italiano' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'zh', label: '中文' },
  { code: 'hi', label: 'हिन्दी' },
]

const normalize = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

/**
 * Drop/merge cues that repeat across transcription-window seams: whisper
 * often re-emits the sentence spanning a 30s boundary at the start of the
 * next window. `last` is the final cue already accepted.
 */
export function dedupeSeam(last: SubtitleCue | null, incoming: SubtitleCue[]): SubtitleCue[] {
  if (!last || incoming.length === 0) return incoming
  const first = incoming[0]
  const closeToSeam = first.start - last.end < SEAM_GAP_S
  if (!closeToSeam) return incoming
  const a = normalize(last.text)
  const b = normalize(first.text)
  if (a === b || (a.length > 8 && (a.endsWith(b) || b.startsWith(a)))) {
    return incoming.slice(1)
  }
  return incoming
}

let worker: Worker | null = null

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./whisper.worker.ts', import.meta.url), { type: 'module' })
    const device = 'gpu' in navigator ? 'webgpu' : 'wasm'
    const init: WorkerIn = { type: 'init', model: DEFAULT_WHISPER_MODEL, device }
    worker.postMessage(init)
  }
  return worker
}

/** Split an over-long segment at sentence-ish boundaries, pro-rata by length. */
export function splitSegment(seg: RawSegment): RawSegment[] {
  const duration = seg.end - seg.start
  if (duration <= MAX_CUE_S) return [seg]
  const parts = seg.text.match(/[^.!?]+[.!?]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [seg.text]
  if (parts.length <= 1) return [seg]
  const totalChars = parts.reduce((n, p) => n + p.length, 0)
  const out: RawSegment[] = []
  let t = seg.start
  for (const part of parts) {
    const d = (part.length / totalChars) * duration
    out.push({ start: t, end: Math.min(seg.end, t + d), text: part })
    t += d
  }
  return out
}

/** Map worker segments (clip-source time) to timeline cues. */
export function segmentsToCues(
  segments: RawSegment[],
  clip: VideoClip | AudioClip,
): SubtitleCue[] {
  const speed = clipSpeed(clip)
  return segments
    .flatMap(splitSegment)
    .map((seg) => {
      // segment times are source seconds relative to sourceIn; timeline
      // seconds = source seconds / speed, offset by clip.start
      const start = clip.start + seg.start / speed
      const end = clip.start + seg.end / speed
      return {
        id: nanoid(),
        start,
        end: Math.max(end, start + MIN_CUE_S),
        text: seg.text,
      }
    })
    .filter((cue) => cue.start < clip.start + clip.duration)
}

/**
 * Transcribe the audio a clip plays and stream SubtitleCues back.
 * The worker (and the loaded model) stay warm across runs.
 */
export function transcribeClip(
  project: Project,
  clip: VideoClip | AudioClip,
  callbacks: TranscribeCallbacks,
  language?: string,
): TranscribeHandle {
  const id = nanoid()
  const w = getWorker()

  const downloadTotals = new Map<string, { loaded: number; total: number }>()
  let lastCue: SubtitleCue | null = null

  const onMessage = (e: MessageEvent<WorkerOut>) => {
    const msg = e.data
    switch (msg.type) {
      case 'download-progress': {
        downloadTotals.set(msg.file, { loaded: msg.loaded, total: msg.total })
        let loaded = 0
        let total = 0
        for (const v of downloadTotals.values()) {
          loaded += v.loaded
          total += v.total
        }
        if (total > 0) callbacks.modelProgress?.(loaded / total)
        break
      }
      case 'segments': {
        if (msg.id !== id) return
        const cues = dedupeSeam(lastCue, segmentsToCues(msg.segments, clip))
        if (cues.length) lastCue = cues[cues.length - 1]
        callbacks.segments(cues)
        callbacks.progress(msg.progress)
        break
      }
      case 'done':
        if (msg.id !== id) return
        cleanup()
        callbacks.done()
        break
      case 'cancelled':
        if (msg.id !== id) return
        cleanup()
        callbacks.cancelled()
        break
      case 'error':
        if (msg.id && msg.id !== id) return
        cleanup()
        callbacks.error(msg.message)
        break
    }
  }
  const cleanup = () => w.removeEventListener('message', onMessage)
  w.addEventListener('message', onMessage)

  void (async () => {
    try {
      const asset = project.assets.find((a) => a.id === clip.assetId)
      if (!asset) throw new Error('Asset not found')
      const speed = clipSpeed(clip)
      const pcm = await extractPcm16k(asset, clip.sourceIn, clip.duration * speed)
      if (pcm.length < 1600) throw new Error('No audio in the selected clip')
      const msg: WorkerIn = { type: 'transcribe', id, pcm, language }
      w.postMessage(msg, [pcm.buffer])
    } catch (err) {
      cleanup()
      callbacks.error(err instanceof Error ? err.message : String(err))
    }
  })()

  return {
    cancel: () => {
      const msg: WorkerIn = { type: 'cancel', id }
      w.postMessage(msg)
    },
  }
}
