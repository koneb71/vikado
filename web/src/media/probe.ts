import { createFile, MP4BoxBuffer, type Movie } from 'mp4box'

export interface ProbeResult {
  kind: 'video' | 'audio' | 'image'
  duration: number | null
  width: number | null
  height: number | null
  fps: number | null
  hasAudio: boolean
}

const VIDEO_TYPES = /^video\//
const AUDIO_TYPES = /^audio\//
const IMAGE_TYPES = /^image\//

export function classify(mimeType: string): ProbeResult['kind'] | null {
  if (VIDEO_TYPES.test(mimeType)) return 'video'
  if (AUDIO_TYPES.test(mimeType)) return 'audio'
  if (IMAGE_TYPES.test(mimeType)) return 'image'
  return null
}

export async function probeFile(file: File, objectUrl: string): Promise<ProbeResult> {
  const kind = classify(file.type)
  if (!kind) throw new Error(`Unsupported file type: ${file.type || 'unknown'}`)

  if (kind === 'image') {
    const { width, height } = await probeImage(objectUrl)
    return { kind, duration: null, width, height, fps: null, hasAudio: false }
  }

  const el = await probeMediaElement(kind, objectUrl)

  let fps: number | null = null
  let hasAudio = kind === 'audio'
  if (kind === 'video') {
    // mp4box gives exact fps + audio-track presence for MP4/MOV; other
    // containers (WebM etc.) fall back to a decode-based check
    const mp4 = await probeMp4(file).catch(() => null)
    fps = mp4?.fps ?? null
    hasAudio = mp4?.hasAudio ?? (await hasAudioViaDecode(file))
  }

  return {
    kind,
    // treat non-finite AND non-positive durations as unknown (streamed WebM
    // can report 0 through the seek-to-end backstop)
    duration: Number.isFinite(el.duration) && el.duration > 0 ? el.duration : null,
    width: kind === 'video' ? (el as HTMLVideoElement).videoWidth : null,
    height: kind === 'video' ? (el as HTMLVideoElement).videoHeight : null,
    fps,
    hasAudio,
  }
}

function probeImage(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error('Could not decode image'))
    img.src = url
  })
}

function probeMediaElement(
  kind: 'video' | 'audio',
  url: string,
): Promise<HTMLVideoElement | HTMLAudioElement> {
  return new Promise((resolve, reject) => {
    const el = document.createElement(kind)
    el.preload = 'metadata'
    el.onloadedmetadata = () => {
      if (el.duration !== Infinity) return resolve(el)
      // streamed WebM (e.g. MediaRecorder output) reports Infinity until the
      // element is forced to scan to the end — the standard workaround
      el.ondurationchange = () => {
        if (el.duration !== Infinity) {
          el.ondurationchange = null
          el.currentTime = 0
          resolve(el)
        }
      }
      el.currentTime = Number.MAX_SAFE_INTEGER
    }
    el.onerror = () => reject(new Error(`Could not decode ${kind} file`))
    el.src = url
  })
}

/**
 * Definitive audio-track check: decodeAudioData succeeds iff the container
 * carries a decodable audio track. Costs a decode at import time, but element
 * heuristics (audioTracks/webkitAudioDecodedByteCount) are unreliable before
 * playback, and a wrong `hasAudio: true` would make the renderer map a
 * non-existent audio stream.
 */
async function hasAudioViaDecode(file: File): Promise<boolean> {
  try {
    const buf = await file.arrayBuffer()
    const ctx = new OfflineAudioContext(1, 1, 44100)
    await ctx.decodeAudioData(buf)
    return true
  } catch {
    return false
  }
}

function probeMp4(file: File): Promise<{ fps: number | null; hasAudio: boolean } | null> {
  if (!/mp4|quicktime|m4v/.test(file.type)) return Promise.resolve(null)
  return new Promise((resolve, reject) => {
    const mp4file = createFile()
    mp4file.onError = (module: string, msg: string) => reject(new Error(`${module}: ${msg}`))
    mp4file.onReady = (info: Movie) => {
      const video = info.videoTracks[0]
      let fps: number | null = null
      if (video && video.nb_samples > 0) {
        const durationS = video.samples_duration / video.timescale
        if (durationS > 0) fps = video.nb_samples / durationS
      }
      resolve({ fps, hasAudio: info.audioTracks.length > 0 })
    }
    file
      .arrayBuffer()
      .then((buf) => {
        mp4file.appendBuffer(MP4BoxBuffer.fromArrayBuffer(buf, 0))
        mp4file.flush()
      })
      .catch(reject)
  })
}
