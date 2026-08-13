/// <reference lib="webworker" />
import { pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'
import {
  DEFAULT_WHISPER_MODEL,
  WINDOW_S,
  type RawSegment,
  type WorkerIn,
  type WorkerOut,
} from '@/captions/protocol'

/**
 * Whisper in a module worker. PCM is chunked into 30s windows at the app
 * level: real progress, streamed partial segments, and cancellation between
 * windows (transformers.js has no reliable mid-call abort). Model weights are
 * fetched from the HF hub once and cached via the browser Cache API.
 */

const SAMPLE_RATE = 16_000

let asr: AutomaticSpeechRecognitionPipeline | null = null
let loading: Promise<AutomaticSpeechRecognitionPipeline> | null = null
let model = DEFAULT_WHISPER_MODEL
let device: 'webgpu' | 'wasm' = 'wasm'
const cancelled = new Set<string>()

const post = (msg: WorkerOut, transfer: Transferable[] = []) =>
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg, transfer)

function loadPipeline(): Promise<AutomaticSpeechRecognitionPipeline> {
  loading ??= (async () => {
    const instance = await pipeline('automatic-speech-recognition', model, {
      device,
      // fp32 on both devices: the q4/q8 decoder exports fail to load on the
      // wasm backend and produce badly degraded text on (software) WebGPU.
      // Bigger one-time download, correct output everywhere.
      dtype: { encoder_model: 'fp32', decoder_model_merged: 'fp32' },
      progress_callback: (p) => {
        if (p.status === 'progress' && 'file' in p) {
          post({
            type: 'download-progress',
            file: p.file ?? '',
            loaded: p.loaded ?? 0,
            total: p.total ?? 0,
          })
        }
      },
    })
    asr = instance
    post({ type: 'ready' })
    return instance
  })()
  return loading
}

interface ChunkResult {
  timestamp: [number, number | null]
  text: string
}

async function transcribe(id: string, pcm: Float32Array, language?: string): Promise<void> {
  const pipe = asr ?? (await loadPipeline())
  const windowSamples = WINDOW_S * SAMPLE_RATE
  const windows = Math.max(1, Math.ceil(pcm.length / windowSamples))

  for (let w = 0; w < windows; w++) {
    if (cancelled.has(id)) {
      cancelled.delete(id)
      post({ type: 'cancelled', id })
      return
    }
    const offsetS = w * WINDOW_S
    const slice = pcm.subarray(w * windowSamples, (w + 1) * windowSamples)

    const output = await pipe(slice, {
      return_timestamps: true,
      // multilingual models require a task; language auto-detects when omitted
      task: 'transcribe',
      ...(language ? { language } : {}),
    })
    const single = Array.isArray(output) ? output[0] : output
    const chunks = (single.chunks ?? []) as ChunkResult[]

    const segments: RawSegment[] = chunks
      .map((c) => ({
        start: offsetS + (c.timestamp[0] ?? 0),
        // null end = model ran off the window; clamp to the window edge
        end: offsetS + (c.timestamp[1] ?? Math.min(WINDOW_S, slice.length / SAMPLE_RATE)),
        text: c.text.trim(),
      }))
      .filter((s) => s.text.length > 0 && s.end > s.start)

    post({ type: 'segments', id, segments, progress: (w + 1) / windows })
  }
  post({ type: 'done', id })
}

self.onmessage = (e: MessageEvent<WorkerIn>) => {
  const msg = e.data
  switch (msg.type) {
    case 'init':
      model = msg.model
      device = msg.device
      void loadPipeline().catch((err) =>
        post({ type: 'error', message: err instanceof Error ? err.message : String(err) }),
      )
      break
    case 'transcribe':
      void transcribe(msg.id, msg.pcm, msg.language).catch((err) =>
        post({
          type: 'error',
          id: msg.id,
          message: err instanceof Error ? err.message : String(err),
        }),
      )
      break
    case 'cancel':
      cancelled.add(msg.id)
      break
  }
}
