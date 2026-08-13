/** Typed messages between transcriber.ts and whisper.worker.ts. */

export interface RawSegment {
  /** seconds relative to the transcribed PCM */
  start: number
  end: number
  text: string
}

export type WorkerIn =
  | { type: 'init'; model: string; device: 'webgpu' | 'wasm' }
  | { type: 'transcribe'; id: string; pcm: Float32Array; language?: string }
  | { type: 'cancel'; id: string }

export type WorkerOut =
  | { type: 'download-progress'; file: string; loaded: number; total: number }
  | { type: 'ready' }
  | { type: 'segments'; id: string; segments: RawSegment[]; progress: number }
  | { type: 'done'; id: string }
  | { type: 'cancelled'; id: string }
  | { type: 'error'; id?: string; message: string }

export const DEFAULT_WHISPER_MODEL = 'onnx-community/whisper-base'
/** window size fed to the model per pass (whisper's native context is 30 s) */
export const WINDOW_S = 30
