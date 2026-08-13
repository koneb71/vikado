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
import { audibleClipsAt, fadeEnvelope } from '@/engine/activeClips'
import { getFile } from '@/media/opfs'
import { clipSpeed } from '@/lib/timelineOps'
import {
  projectDuration,
  type Asset,
  type AudioClip,
  type Project,
  type VideoClip,
} from '@/schema/project'
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

/**
 * Per-asset decoders, opened lazily and reused across frames.
 *
 * Failures are recorded rather than swallowed: a source this browser cannot
 * decode must abort the export with the asset's name, because the alternative
 * is an MP4 that is silently black where that clip should be while the dialog
 * reports success.
 */
class SourcePool {
  private videos = new Map<string, Promise<VideoSampleSink | null>>()
  private images = new Map<string, Promise<ImageBitmap | null>>()
  private inputs: Input[] = []
  private failed = new Map<string, 'missing' | 'undecodable'>()

  private project: Project

  constructor(project: Project) {
    this.project = project
  }

  private asset(assetId: string): Asset | undefined {
    return this.project.assets.find((a) => a.id === assetId)
  }

  /** Human-readable name for error messages. */
  describe(assetId: string): string {
    return this.asset(assetId)?.name ?? assetId
  }

  private fail(assetId: string, why: 'missing' | 'undecodable'): null {
    // a missing file stays missing: don't record it as merely undecodable, or
    // we would send the user to the render service, which cannot find it either
    if (this.failed.get(assetId) !== 'missing') this.failed.set(assetId, why)
    return null
  }

  /** Why the export cannot proceed, or an empty string if it can. */
  blockedReason(): string {
    const named = (why: string) =>
      [...this.failed]
        .filter(([, w]) => w === why)
        .map(([id]) => this.describe(id))
        .join(', ')
    const missing = named('missing')
    const undecodable = named('undecodable')
    const parts: string[] = []
    if (missing) {
      parts.push(`The media for ${missing} is missing from this browser's storage. Re-import it.`)
    }
    if (undecodable) {
      parts.push(
        `This browser could not decode ${undecodable}. Export with the render service instead.`,
      )
    }
    return parts.join(' ')
  }

  videoSink(assetId: string): Promise<VideoSampleSink | null> {
    let entry = this.videos.get(assetId)
    if (!entry) {
      entry = (async () => {
        const asset = this.asset(assetId)
        if (!asset) return this.fail(assetId, 'missing')
        const file = await getFile(asset.hash).catch(() => null)
        if (!file) return this.fail(assetId, 'missing')
        const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS })
        this.inputs.push(input)
        const track = await input.getPrimaryVideoTrack()
        if (!track || !(await track.canDecode())) return this.fail(assetId, 'undecodable')
        return new VideoSampleSink(track)
      })().catch(() => this.fail(assetId, 'undecodable'))
      this.videos.set(assetId, entry)
    }
    return entry
  }

  image(assetId: string): Promise<ImageBitmap | null> {
    let entry = this.images.get(assetId)
    if (!entry) {
      entry = (async () => {
        const asset = this.asset(assetId)
        if (!asset) return this.fail(assetId, 'missing')
        const file = await getFile(asset.hash).catch(() => null)
        if (!file) return this.fail(assetId, 'missing')
        return createImageBitmap(file)
      })().catch(() => this.fail(assetId, 'undecodable'))
      this.images.set(assetId, entry)
    }
    return entry
  }

  async dispose(): Promise<void> {
    for (const p of this.images.values()) {
      const bmp = await p.catch(() => null)
      bmp?.close()
    }
    // disposing the Input closes its demuxer and any hardware decoders the
    // sinks opened; dropping the references alone leaks both
    for (const input of this.inputs) {
      try {
        input.dispose()
      } catch {
        /* already disposed */
      }
    }
    this.videos.clear()
    this.images.clear()
    this.inputs = []
  }
}

/**
 * Hand the compositor a frame with rotation and pixel aspect ratio applied.
 *
 * mediabunny stamps the container's display matrix onto the sample, but
 * `toCanvasImageSource()` returns the RAW decoded frame. A phone portrait clip
 * (coded 1920x1080 plus rotate=90) would therefore export on its side, while
 * the preview shows it upright — there a <video> element rotates for us, and
 * `asset.width/height` (which size the layer) are the post-rotation dimensions
 * the browser reports. `sample.draw()` applies rotation and aspect, so blit
 * through a per-clip canvas whenever the sample is not already upright and
 * square-pixel. `shared` forces the blit when two clips decode from one sink
 * this frame, since the second getSample() may recycle the first sample.
 */
function frameSource(
  sample: VideoSample,
  clipId: string,
  store: Map<string, OffscreenCanvas>,
  shared: boolean,
): TexSource {
  const upright =
    sample.rotation === 0 &&
    sample.displayWidth === sample.codedWidth &&
    sample.displayHeight === sample.codedHeight
  if (upright && !shared) return sample.toCanvasImageSource() as unknown as TexSource

  let canvas = store.get(clipId)
  if (!canvas || canvas.width !== sample.displayWidth || canvas.height !== sample.displayHeight) {
    canvas = new OffscreenCanvas(sample.displayWidth, sample.displayHeight)
    store.set(clipId, canvas)
  }
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  sample.draw(ctx, 0, 0, canvas.width, canvas.height)
  return canvas as unknown as TexSource
}

/**
 * Gain curve for one clip, sampled from the SAME fadeEnvelope the preview uses,
 * so the two agree by construction.
 *
 * The fades MULTIPLY: the preview does `fade *= …` twice and ffmpeg chains
 * `afade=t=in` then `afade=t=out`. Scheduling them as separate ramp events
 * does not — when fadeIn + fadeOut > duration (reachable from the inspector,
 * which allows 0.5s of each on any clip) a later setValueAtTime lands mid-ramp
 * and Web Audio's sorted automation timeline overrides the fade-in, producing a
 * click and roughly full volume where the preview is barely audible. The
 * product of two overlapping linear ramps is quadratic, which
 * linearRampToValueAtTime cannot express, hence a sampled curve.
 */
export function fadeCurve(clip: VideoClip | AudioClip, volume: number): Float32Array {
  const fades = [clip.fadeIn, clip.fadeOut].filter((f) => f > 0)
  const shortest = fades.length > 0 ? Math.min(...fades) : clip.duration
  const step = Math.min(0.02, Math.max(0.001, shortest / 128))
  const n = Math.min(8192, Math.max(2, Math.ceil(clip.duration / step) + 1))
  const curve = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    curve[i] = volume * fadeEnvelope(clip, (i / (n - 1)) * clip.duration)
  }
  return curve
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
  pool: SourcePool,
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
  const failedAudio = new Set<string>()

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
    if (!buffer) {
      // silently dropping the track would ship an export that is mute where
      // the preview is not, so surface it the same way a bad video source is
      failedAudio.add(pool.describe(asset.id))
      continue
    }

    const speed = clipSpeed(clip)
    const node = ctx.createBufferSource()
    node.buffer = buffer
    node.playbackRate.value = speed

    const gain = ctx.createGain()
    const volume = track.muted ? 0 : clip.volume
    const end = clip.start + clip.duration
    if (clip.duration > 0 && (clip.fadeIn > 0 || clip.fadeOut > 0)) {
      gain.gain.setValueCurveAtTime(fadeCurve(clip, volume), clip.start, clip.duration)
    } else {
      gain.gain.value = volume
    }

    node.connect(gain).connect(ctx.destination)
    // source seconds consumed = timeline seconds × speed
    node.start(clip.start, clip.sourceIn, clip.duration * speed)
    node.stop(end)
  }

  if (failedAudio.size > 0) {
    throw new Error(
      `This browser could not decode the audio of ${[...failedAudio].join(', ')}. ` +
        'Export with the render service instead.',
    )
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
    // the service downscales with lanczos; ask the browser for its best filter
    // rather than the default, which aliases visibly on a 0.5x export
    outCtx.imageSmoothingEnabled = true
    outCtx.imageSmoothingQuality = 'high'
    const needsScale = outW !== project.width || outH !== project.height
    let finalized = false

    const pool = new SourcePool(project)
    const blurStore: BlurStore = new Map()
    const frameCanvases = new Map<string, OffscreenCanvas>()

    const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() })
    const videoSource = new CanvasSource(needsScale ? outCanvas : (stage as OffscreenCanvas), {
      codec: 'avc',
      bitrate: bitrateFor(options.quality),
    })
    output.addVideoTrack(videoSource, { frameRate: fps })

    // everything below can throw or be canceled; the finally must own the
    // compositor's WebGL context and the pool's decoders from here on
    try {
      // Preflight: open every source the timeline needs before spending
      // minutes on the frame loop. A source that cannot be decoded has to fail
      // loudly — otherwise it just goes missing from the output and the export
      // "succeeds" with black where the clip should be.
      const needed = new Map<string, 'video' | 'image'>()
      for (const track of project.tracks) {
        for (const clip of track.clips) {
          if (clip.type === 'video') needed.set(clip.assetId, 'video')
          else if (clip.type === 'image') needed.set(clip.assetId, 'image')
        }
      }
      for (const [assetId, kind] of needed) {
        if (signal.canceled) throw new ExportCanceledError()
        if (kind === 'video') await pool.videoSink(assetId)
        else await pool.image(assetId)
      }
      const blocked = pool.blockedReason()
      if (blocked) throw new Error(blocked)

      // audio next: it is cheap relative to the frame loop and tells us whether
      // to declare an audio track before the output starts
      const audio = await renderAudio(project, duration, pool, signal)
      let audioSource: AudioBufferSource | null = null
      if (audio) {
        if (!(await canEncodeAudio('aac').catch(() => false))) {
          throw new Error(
            'This browser cannot encode AAC audio. Export with the render service instead.',
          )
        }
        audioSource = new AudioBufferSource({
          codec: 'aac',
          bitrate: options.quality === 'draft' ? 128_000 : 192_000,
        })
        output.addAudioTrack(audioSource)
      }

      await output.start()

      for (let frame = 0; frame < totalFrames; frame++) {
        if (signal.canceled) throw new ExportCanceledError()
        const t = frame / fps

        // decode every source this instant needs, at an exact timestamp
        const onStage = mediaClipsAt(project, t)
        // two clips of one asset (split-then-crossfade) share a sink, so each
        // frame has to be copied out before the next getSample recycles it
        const perAsset = new Map<string, number>()
        for (const { clip } of onStage) {
          perAsset.set(clip.assetId, (perAsset.get(clip.assetId) ?? 0) + 1)
        }

        const samples = new Map<string, VideoSample>()
        const sources = new Map<string, TexSource>()
        for (const { clip, sourceTime } of onStage) {
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
              const shared = (perAsset.get(clip.assetId) ?? 0) > 1
              sources.set(clip.id, frameSource(sample, clip.id, frameCanvases, shared))
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
      finalized = true
      const buffer = (output.target as BufferTarget).buffer
      if (!buffer) throw new Error('Encoder produced no output')
      return new Blob([buffer], { type: 'video/mp4' })
    } finally {
      compositor.dispose(true)
      await pool.dispose()
      for (const canvas of frameCanvases.values()) {
        canvas.width = 0
        canvas.height = 0
      }
      frameCanvases.clear()
      // any exit before finalize leaves encoders running: cancel on error and
      // on cancellation alike, not only when the user pressed cancel
      if (!finalized) await output.cancel().catch(() => {})
    }
  })()

  return {
    cancel: () => {
      signal.canceled = true
    },
    result,
  }
}
