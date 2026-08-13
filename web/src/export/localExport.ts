import {
  ALL_FORMATS,
  AudioBufferSource,
  BlobSource,
  BufferTarget,
  CanvasSource,
  Input,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  QUALITY_LOW,
  QUALITY_MEDIUM,
  VideoSampleSink,
  canEncodeAudio,
  canEncodeVideo,
  type VideoSample,
} from 'mediabunny'
import { Compositor, type TexSource } from '@/engine/compositor/Compositor'
import { buildFrameLayers, mediaClipsAt, type BlurStore } from '@/engine/frameGraph'
import { audibleClipsAt } from '@/engine/activeClips'
import { getFile } from '@/media/opfs'
import { clipSpeed } from '@/lib/timelineOps'
import { projectDuration, type Asset, type Project } from '@/schema/project'
import type { RenderOptions } from '@/generated/RenderOptions'

/**
 * In-browser export: renders the timeline with the GPU and encodes an MP4
 * locally, so no render service is needed.
 *
 * Frames come from the SAME compositor and the SAME layer graph as the live
 * preview (see engine/frameGraph.ts), so what you exported is what you saw.
 * The difference from the preview is where pixels come from: instead of
 * <video> elements nudged towards the right time, every frame is decoded at an
 * exact timestamp with WebCodecs, which is what makes the output deterministic.
 *
 * Video is encoded by the platform's hardware H.264 encoder where available;
 * audio is mixed offline with the same gain/fade envelope the preview uses.
 */

export interface LocalExportProgress {
  phase: 'preparing' | 'rendering' | 'finalizing'
  /** 0..1 within the whole export */
  progress: number
}

export interface LocalExportHandle {
  cancel: () => void
  result: Promise<Blob>
}

export class ExportCanceledError extends Error {
  constructor() {
    super('canceled')
    this.name = 'ExportCanceledError'
  }
}

/** Whether this browser can encode an MP4 locally at all. */
export async function isLocalExportSupported(): Promise<boolean> {
  if (typeof VideoEncoder === 'undefined' || typeof OffscreenCanvas === 'undefined') return false
  try {
    return await canEncodeVideo('avc')
  } catch {
    return false
  }
}

function bitrateFor(quality: RenderOptions['quality']) {
  switch (quality) {
    case 'draft':
      return QUALITY_LOW
    case 'standard':
      return QUALITY_MEDIUM
    default:
      return QUALITY_HIGH
  }
}

/** Mirrors RenderOptions::output_size in crates/vikado-types: even dimensions. */
export function outputSize(project: Project, options: RenderOptions): [number, number] {
  const scale = Math.min(1, Math.max(0.25, options.scale))
  const even = (v: number) => Math.max(2, Math.round((v * scale) / 2) * 2)
  return [even(project.width), even(project.height)]
}

/** Per-asset decoders, opened lazily and reused across frames. */
class SourcePool {
  private videos = new Map<string, Promise<VideoSampleSink | null>>()
  private images = new Map<string, Promise<ImageBitmap | null>>()
  private inputs: Input[] = []

  private project: Project

  constructor(project: Project) {
    this.project = project
  }

  private asset(assetId: string): Asset | undefined {
    return this.project.assets.find((a) => a.id === assetId)
  }

  videoSink(assetId: string): Promise<VideoSampleSink | null> {
    let entry = this.videos.get(assetId)
    if (!entry) {
      entry = (async () => {
        const asset = this.asset(assetId)
        if (!asset) return null
        const file = await getFile(asset.hash)
        const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS })
        this.inputs.push(input)
        const track = await input.getPrimaryVideoTrack()
        if (!track || !(await track.canDecode())) return null
        return new VideoSampleSink(track)
      })().catch(() => null)
      this.videos.set(assetId, entry)
    }
    return entry
  }

  image(assetId: string): Promise<ImageBitmap | null> {
    let entry = this.images.get(assetId)
    if (!entry) {
      entry = (async () => {
        const asset = this.asset(assetId)
        if (!asset) return null
        const file = await getFile(asset.hash)
        return createImageBitmap(file)
      })().catch(() => null)
      this.images.set(assetId, entry)
    }
    return entry
  }

  async dispose(): Promise<void> {
    for (const p of this.images.values()) {
      const bmp = await p.catch(() => null)
      bmp?.close()
    }
    this.videos.clear()
    this.images.clear()
    this.inputs = []
  }
}

/**
 * Mix every audible clip into one buffer, offline. Mirrors the preview's
 * AudioGraph and the renderer's atrim/atempo/volume/afade/adelay chain:
 * playback rate carries clip speed, and the gain envelope is the same
 * fadeEnvelope the preview schedules.
 */
async function renderAudio(
  project: Project,
  duration: number,
  signal: { canceled: boolean },
): Promise<AudioBuffer | null> {
  const SAMPLE_RATE = 48_000
  const clips = new Map<string, ReturnType<typeof audibleClipsAt>[number]>()
  // one entry per clip across the whole timeline, not per instant
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      if (clip.type !== 'audio' && clip.type !== 'video') continue
      const at = audibleClipsAt(project, clip.start + Math.min(0.01, clip.duration / 2))
      const found = at.find((a) => a.clip.id === clip.id)
      if (found) clips.set(clip.id, found)
    }
  }
  if (clips.size === 0) return null

  const ctx = new OfflineAudioContext(2, Math.max(1, Math.ceil(duration * SAMPLE_RATE)), SAMPLE_RATE)
  const decoded = new Map<string, AudioBuffer | null>()

  for (const { clip, track } of clips.values()) {
    if (signal.canceled) throw new ExportCanceledError()
    const asset = project.assets.find((a) => a.id === clip.assetId)
    if (!asset) continue

    let buffer = decoded.get(asset.hash)
    if (buffer === undefined) {
      buffer = await getFile(asset.hash)
        .then((f) => f.arrayBuffer())
        .then((b) => ctx.decodeAudioData(b))
        .catch(() => null)
      decoded.set(asset.hash, buffer)
    }
    if (!buffer) continue

    const speed = clipSpeed(clip)
    const node = ctx.createBufferSource()
    node.buffer = buffer
    node.playbackRate.value = speed

    const gain = ctx.createGain()
    const volume = track.muted ? 0 : clip.volume
    // same envelope shape as activeClips.fadeEnvelope, as ramps
    gain.gain.setValueAtTime(clip.fadeIn > 0 ? 0 : volume, clip.start)
    if (clip.fadeIn > 0) {
      gain.gain.linearRampToValueAtTime(volume, clip.start + clip.fadeIn)
    }
    const end = clip.start + clip.duration
    if (clip.fadeOut > 0) {
      gain.gain.setValueAtTime(volume, Math.max(clip.start, end - clip.fadeOut))
      gain.gain.linearRampToValueAtTime(0, end)
    }

    node.connect(gain).connect(ctx.destination)
    // source seconds consumed = timeline seconds × speed
    node.start(clip.start, clip.sourceIn, clip.duration * speed)
    node.stop(end)
  }

  return ctx.startRendering()
}

export function startLocalExport(
  project: Project,
  options: RenderOptions,
  onProgress: (p: LocalExportProgress) => void,
): LocalExportHandle {
  const signal = { canceled: false }

  const result = (async (): Promise<Blob> => {
    const duration = projectDuration(project)
    if (duration <= 0) throw new Error('Nothing to export — the timeline is empty.')

    onProgress({ phase: 'preparing', progress: 0 })

    const fps = project.fps
    const totalFrames = Math.max(1, Math.ceil(duration * fps))
    const [outW, outH] = outputSize(project, options)

    // composite at canvas resolution, then downscale once at the end of the
    // chain — the same order the ffmpeg graph uses
    const stage = new OffscreenCanvas(project.width, project.height)
    const compositor = new Compositor(stage as unknown as HTMLCanvasElement)
    const outCanvas = new OffscreenCanvas(outW, outH)
    const outCtx = outCanvas.getContext('2d')!
    const needsScale = outW !== project.width || outH !== project.height

    const pool = new SourcePool(project)
    const blurStore: BlurStore = new Map()

    const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() })
    const videoSource = new CanvasSource(needsScale ? outCanvas : (stage as OffscreenCanvas), {
      codec: 'avc',
      bitrate: bitrateFor(options.quality),
    })
    output.addVideoTrack(videoSource, { frameRate: fps })

    // audio first: it is cheap relative to the frame loop and tells us whether
    // to declare an audio track before the output starts
    const audio = await renderAudio(project, duration, signal)
    let audioSource: AudioBufferSource | null = null
    if (audio && (await canEncodeAudio('aac').catch(() => false))) {
      audioSource = new AudioBufferSource({ codec: 'aac', bitrate: 192_000 })
      output.addAudioTrack(audioSource)
    }

    await output.start()

    try {
      for (let frame = 0; frame < totalFrames; frame++) {
        if (signal.canceled) throw new ExportCanceledError()
        const t = frame / fps

        // decode every source this instant needs, at an exact timestamp
        const samples = new Map<string, VideoSample>()
        const sources = new Map<string, TexSource>()
        for (const { clip, sourceTime } of mediaClipsAt(project, t)) {
          if (sources.has(clip.id)) continue
          if (clip.type === 'image') {
            const bmp = await pool.image(clip.assetId)
            if (bmp) sources.set(clip.id, bmp)
          } else {
            const sink = await pool.videoSink(clip.assetId)
            if (!sink) continue
            const sample = await sink.getSample(sourceTime)
            if (sample) {
              samples.set(clip.id, sample)
              sources.set(clip.id, sample.toCanvasImageSource() as unknown as TexSource)
            }
          }
        }

        compositor.setStageSize(project.width, project.height)
        compositor.setBackground(project.canvasBackground)
        compositor.draw(
          buildFrameLayers(project, t, (clip) => sources.get(clip.id) ?? null, blurStore),
        )

        if (needsScale) {
          outCtx.drawImage(stage, 0, 0, outW, outH)
        }
        await videoSource.add(t, 1 / fps)

        for (const s of samples.values()) s.close()

        if (frame % 5 === 0 || frame === totalFrames - 1) {
          onProgress({ phase: 'rendering', progress: (frame + 1) / totalFrames })
        }
      }

      if (audio && audioSource) await audioSource.add(audio)

      onProgress({ phase: 'finalizing', progress: 1 })
      await output.finalize()
      const buffer = (output.target as BufferTarget).buffer
      if (!buffer) throw new Error('Encoder produced no output')
      return new Blob([buffer], { type: 'video/mp4' })
    } finally {
      compositor.dispose()
      await pool.dispose()
      if (signal.canceled) await output.cancel().catch(() => {})
    }
  })()

  return {
    cancel: () => {
      signal.canceled = true
    },
    result,
  }
}
