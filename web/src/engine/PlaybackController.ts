import { Compositor, type DrawLayer, type TexSource } from '@/engine/compositor/Compositor'
import { clipSpeed } from '@/lib/timelineOps'
import { sampleTransform } from '@/lib/keyframes'
import { AudioGraph } from '@/engine/AudioGraph'
import { MediaPool } from '@/engine/MediaPool'
import { renderText, textCacheKey } from '@/engine/TextRenderer'
import {
  activeCueAt,
  audibleClipsAt,
  visualLayersAt,
  type AudibleClip,
  type VisualLayer,
} from '@/engine/activeClips'
import {
  DEFAULT_ADJUSTMENTS,
  DEFAULT_TRANSFORM,
  projectDuration,
  type Asset,
  type Clip,
  type ImageClip,
  type Project,
  type Transition,
  type VideoClip,
} from '@/schema/project'
import { useProjectStore } from '@/state/projectStore'
import { usePlaybackStore } from '@/state/playbackStore'

const SYNC_TOLERANCE_S = 0.08

function hexToRgb01(hex: string): [number, number, number] {
  const m = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex)
  if (!m) return [0, 1, 0]
  return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255]
}

/**
 * The rAF render loop: reads stores transiently (no React re-renders),
 * keeps media elements in sync with the transport clock, and draws the
 * composited frame every animation frame.
 *
 * Transport clock: derived from the AudioContext while it is running (audio
 * can never drift from the transport), with a performance.now fallback until
 * the first user gesture unlocks the context.
 */
export class PlaybackController {
  private compositor: Compositor
  private audio = new AudioGraph()
  /** small 2D canvases used to build blurred backdrop textures, per clip */
  private blurCanvases = new Map<string, { work: HTMLCanvasElement; out: HTMLCanvasElement }>()
  private pool = new MediaPool({ onEvict: (id) => this.audio.disconnect(id) })
  private rafId = 0
  private watchdogId: ReturnType<typeof setInterval> | 0 = 0
  private lastTickMs = 0
  private running = false
  private removeGestureListeners: (() => void) | null = null

  /** transport anchor while playing: playbackTime = (clockNow - anchorMs) / 1000 */
  private anchorMs = 0
  private wasPlaying = false
  /** increments on every re-anchor; keys scheduled audio envelopes */
  private anchorGen = 0
  /** true while the audio clock was the source at the last tick */
  private wasAudioClock = false
  /** last currentTime this controller wrote to the store (detects external seeks) */
  private lastWrittenTime = -1

  constructor(canvas: HTMLCanvasElement) {
    this.compositor = new Compositor(canvas)
  }

  /** ms, monotonic per source; source switches are handled via re-anchoring */
  private clockNow(): number {
    return this.audio.running ? this.audio.now() * 1000 : performance.now()
  }

  start(): void {
    if (this.running) return
    this.running = true

    // AudioContext.resume() must run inside a genuine user gesture
    const unlock = () => this.audio.unlock()
    window.addEventListener('pointerdown', unlock, { capture: true })
    window.addEventListener('keydown', unlock, { capture: true })
    this.removeGestureListeners = () => {
      window.removeEventListener('pointerdown', unlock, { capture: true })
      window.removeEventListener('keydown', unlock, { capture: true })
    }

    const safeTick = () => {
      this.lastTickMs = performance.now()
      try {
        this.tick()
      } catch (err) {
        // keep the loop alive — a single bad frame must not kill playback
        console.error('[vikado] render tick failed:', err)
      }
    }
    const loop = () => {
      if (!this.running) return
      safeTick()
      this.rafId = requestAnimationFrame(loop)
    }
    this.rafId = requestAnimationFrame(loop)
    // rAF is throttled (or fully suspended) in hidden/backgrounded tabs;
    // a timer watchdog keeps the transport and canvas alive at ~20fps there
    this.watchdogId = setInterval(() => {
      if (this.running && performance.now() - this.lastTickMs > 150) safeTick()
    }, 50)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.rafId)
    if (this.watchdogId) clearInterval(this.watchdogId)
    this.watchdogId = 0
    this.removeGestureListeners?.()
    this.removeGestureListeners = null
    this.audio.setTransportPaused(true)
    this.pool.pauseAll()
  }

  dispose(): void {
    this.stop()
    this.pool.dispose()
    this.audio.dispose()
    this.compositor.dispose()
  }

  private tick(): void {
    const project = useProjectStore.getState().project
    if (!project) return

    const playback = usePlaybackStore.getState()
    const nowMs = this.clockNow()
    let t = playback.currentTime

    const externallySeeked = this.lastWrittenTime !== -1 && t !== this.lastWrittenTime
    // switching between wall clock and audio clock invalidates the anchor
    const clockSwitched = this.audio.running !== this.wasAudioClock
    this.wasAudioClock = this.audio.running

    if (playback.isPlaying) {
      if (!this.wasPlaying || externallySeeked || clockSwitched) {
        this.anchorMs = nowMs - t * 1000 // (re)anchor on play/seek/clock switch
        this.anchorGen++
      }
      t = (nowMs - this.anchorMs) / 1000

      const duration = projectDuration(project)
      if (t >= duration) {
        t = duration
        playback.pause()
      }
      usePlaybackStore.setState({ currentTime: t })
      this.lastWrittenTime = t
    } else {
      this.lastWrittenTime = t
    }
    if (this.wasPlaying !== playback.isPlaying) {
      this.audio.setTransportPaused(!playback.isPlaying)
    }
    this.wasPlaying = playback.isPlaying

    this.syncMedia(project, t, playback.isPlaying)
    this.drawFrame(project, t)
  }

  /** All media-backed clips on stage at t, including incoming transition clips. */
  private stageClips(visual: VisualLayer[], t: number): { clip: Clip; sourceTime: number }[] {
    const out: { clip: Clip; sourceTime: number }[] = []
    for (const layer of visual) {
      if (layer.clip.type === 'video' || layer.clip.type === 'image') {
        const st =
          layer.clip.type === 'video'
            ? layer.clip.sourceIn + (t - layer.clip.start) * layer.clip.speed
            : 0
        out.push({ clip: layer.clip, sourceTime: st })
      }
      const b = layer.transition?.clip
      if (b && (b.type === 'video' || b.type === 'image')) {
        const st = b.type === 'video' ? Math.max(0, b.sourceIn + (t - b.start) * b.speed) : 0
        out.push({ clip: b, sourceTime: st })
      }
    }
    return out
  }

  /** Pool key for an audible clip: detached audio clips get their OWN
   * element so they can't seek-fight the video clip sharing their asset. */
  private static audioKey(clip: AudibleClip['clip']): string {
    return clip.type === 'audio' ? `aclip:${clip.id}` : clip.assetId
  }

  /** Keep media elements at the right time / play state / volume. */
  private syncMedia(project: Project, t: number, isPlaying: boolean): void {
    const audible = audibleClipsAt(project, t)
    const audibleByKey = new Map(audible.map((a) => [PlaybackController.audioKey(a.clip), a]))
    const visual = visualLayersAt(project, t)
    const stage = this.stageClips(visual, t)

    // key → what the element should be doing
    const needs = new Map<string, { asset: Asset; expected: number; speed: number }>()
    for (const { clip, sourceTime } of stage) {
      if (!('assetId' in clip)) continue
      const asset = project.assets.find((a) => a.id === clip.assetId)
      if (!asset) continue
      needs.set(clip.assetId, {
        asset,
        expected: sourceTime,
        speed: clipSpeed(clip),
      })
    }
    for (const a of audible) {
      const key = PlaybackController.audioKey(a.clip)
      const asset = project.assets.find((as) => as.id === a.clip.assetId)
      if (!asset) continue
      // video clips' own audio shares the visual element (same clip timing);
      // audio-track clips get a dedicated entry under their own key
      if (!needs.has(key)) {
        needs.set(key, { asset, expected: a.sourceTime, speed: clipSpeed(a.clip) })
      }
    }

    for (const [key, need] of needs) {
      const el = this.pool.peek(key)
      if (!el) {
        // trigger async load; it'll be ready on a later frame
        void this.pool.acquire(need.asset, key)
        continue
      }
      if (el instanceof HTMLImageElement) continue
      this.audio.connect(key, el)

      if (el.playbackRate !== need.speed) el.playbackRate = need.speed
      const drift = Math.abs(el.currentTime - need.expected)
      if (isPlaying) {
        if (drift > SYNC_TOLERANCE_S && !el.seeking) el.currentTime = need.expected
        if (el.paused) void el.play().catch(() => {})
      } else {
        if (!el.paused) el.pause()
        if (drift > 1 / 120 && !el.seeking) el.currentTime = need.expected
      }
      // loudness is owned by the AudioGraph (envelopes on clipGain);
      // element volume/muted are left neutral after connect()
    }

    if (isPlaying) {
      // timeline seconds → ctx seconds under the current anchor
      const anchorMs = this.anchorMs
      this.audio.scheduleAudible(audibleByKey, (t2) => (anchorMs + t2 * 1000) / 1000, this.anchorGen)
      // pause anything no longer on stage
      this.pool.forEachMedia((key, el) => {
        if (!needs.has(key) && !el.paused) el.pause()
      })
    }
  }

  /**
   * Blurred, stage-filling copy of the clip's frame ("background blur" fill),
   * matching the renderer's backdrop semantics: the source is first cropped /
   * flipped / chroma-keyed like the clip itself, then aspect-preserving
   * cover-cropped to the stage, then blurred. Exact blur-kernel parity
   * (Canvas2D blur vs gblur) isn't attempted; geometry and content are.
   */
  private backdropLayer(
    clip: VideoClip | ImageClip,
    el: TexSource,
    mediaW: number,
    mediaH: number,
    opacity: number,
    stageW: number,
    stageH: number,
  ): DrawLayer {
    const outW = 192
    const outH = Math.max(2, Math.round((outW * stageH) / stageW))
    let pair = this.blurCanvases.get(clip.id)
    if (!pair || pair.out.width !== outW || pair.out.height !== outH) {
      const work = document.createElement('canvas')
      const out = document.createElement('canvas')
      work.width = out.width = outW
      work.height = out.height = outH
      pair = { work, out }
      this.blurCanvases.set(clip.id, pair)
    }
    const wctx = pair.work.getContext('2d', { willReadFrequently: true })!

    // source region = crop rect (clamped like the renderer), then a centered
    // cover sub-rect of it with the stage's aspect
    const crop = clip.crop
    const cw = crop?.w ?? 1
    const ch = crop?.h ?? 1
    const cx = Math.max(0, Math.min(crop?.x ?? 0, 1 - cw))
    const cy = Math.max(0, Math.min(crop?.y ?? 0, 1 - ch))
    const rx = cx * mediaW
    const ry = cy * mediaH
    const rw = cw * mediaW
    const rh = ch * mediaH
    const targetAR = stageW / stageH
    let sx = rx
    let sy = ry
    let sw = rw
    let sh = rh
    if (rw / rh > targetAR) {
      sw = rh * targetAR
      sx = rx + (rw - sw) / 2
    } else {
      sh = rw / targetAR
      sy = ry + (rh - sh) / 2
    }

    try {
      wctx.save()
      wctx.filter = 'none'
      wctx.setTransform(clip.flipH ? -1 : 1, 0, 0, clip.flipV ? -1 : 1,
        clip.flipH ? outW : 0, clip.flipV ? outH : 0)
      wctx.drawImage(el as CanvasImageSource, sx, sy, sw, sh, 0, 0, outW, outH)
      wctx.restore()

      // chroma key on the small canvas (same RGB-distance math as the shader)
      if (clip.chromaKey) {
        const [kr, kg, kb] = hexToRgb01(clip.chromaKey.color)
        const { similarity, blend } = clip.chromaKey
        const img = wctx.getImageData(0, 0, outW, outH)
        const d = img.data
        for (let i = 0; i < d.length; i += 4) {
          const dr = d[i] / 255 - kr
          const dg = d[i + 1] / 255 - kg
          const db = d[i + 2] / 255 - kb
          const diff = Math.sqrt(dr * dr + dg * dg + db * db) / Math.sqrt(3)
          const a = blend > 0
            ? Math.min(1, Math.max(0, (diff - similarity) / blend))
            : diff < similarity ? 0 : 1
          d[i + 3] = Math.round(d[i + 3] * a)
        }
        wctx.putImageData(img, 0, 0)
      }

      const octx = pair.out.getContext('2d')!
      octx.clearRect(0, 0, outW, outH)
      octx.filter = 'blur(5px)'
      octx.drawImage(pair.work, 0, 0)
      octx.filter = 'none'
    } catch {
      // source not ready — keep previous backdrop contents
    }

    return {
      source: pair.out,
      width: outW,
      height: outH,
      key: `bg:${clip.id}`,
      dynamic: true,
      fitMode: 'cover',
      transform: DEFAULT_TRANSFORM,
      adjustments: DEFAULT_ADJUSTMENTS,
      filter: null,
      opacity,
    }
  }

  /** Build the DrawLayer for a media/text clip, or null when not drawable yet. */
  private layerFor(
    project: Project,
    clip: Clip,
    opacity: number,
    localTime: number,
  ): DrawLayer | null {
    if (clip.type === 'video' || clip.type === 'image') {
      const asset = project.assets.find((a) => a.id === clip.assetId)
      const el = this.pool.peek(clip.assetId)
      if (!asset || !el || el instanceof HTMLAudioElement) return null
      if (el instanceof HTMLVideoElement && el.readyState < 2) return null
      const transform = sampleTransform(clip, localTime)
      const crop = clip.crop
      // clamp x/y so the rect stays inside the frame (matches the renderer's
      // crop clamp for hand-edited out-of-range project JSON)
      const cropX = crop ? Math.max(0, Math.min(crop.x, 1 - crop.w)) : 0
      const cropY = crop ? Math.max(0, Math.min(crop.y, 1 - crop.h)) : 0
      return {
        source: el,
        width: (asset.width ?? 1) * (crop?.w ?? 1),
        height: (asset.height ?? 1) * (crop?.h ?? 1),
        key: clip.assetId,
        dynamic: el instanceof HTMLVideoElement,
        transform,
        adjustments: clip.adjustments,
        filter: clip.filter,
        flipH: clip.flipH,
        flipV: clip.flipV,
        uvRect: crop ? [cropX, cropY, crop.w, crop.h] : undefined,
        chromaKey: clip.chromaKey
          ? {
              rgb: hexToRgb01(clip.chromaKey.color),
              similarity: clip.chromaKey.similarity,
              blend: clip.chromaKey.blend,
            }
          : undefined,
        opacity: transform.opacity * opacity,
      }
    }
    if (clip.type === 'text') {
      const rendered = renderText(clip.text, clip.style)
      const transform = sampleTransform(clip, localTime)
      return {
        source: rendered.canvas,
        width: rendered.width,
        height: rendered.height,
        key: textCacheKey(clip.text, clip.style),
        dynamic: false,
        fitMode: 'none',
        transform,
        adjustments: DEFAULT_ADJUSTMENTS,
        filter: null,
        opacity: transform.opacity * opacity,
      }
    }
    return null
  }

  /**
   * Transition blending without an extra render pass:
   *  - crossfade: B drawn over A with opacity p
   *  - fade-black: A fades out, then B fades in
   *  - wipes: B scissored to the revealed region
   *  - slides: B translated in from its edge
   * The ffmpeg xfade output is the reference; these are visually equivalent
   * for full-stage clips (the common case).
   */
  private pushTransitionLayers(
    layers: DrawLayer[],
    project: Project,
    a: DrawLayer | null,
    bClip: Clip,
    type: Transition['type'],
    p: number,
    t: number,
  ): void {
    const b = this.layerFor(project, bClip, 1, Math.max(0, t - bClip.start))
    const W = project.width
    const H = project.height
    switch (type) {
      case 'crossfade':
        if (a) layers.push(a)
        if (b) layers.push({ ...b, opacity: b.opacity * p })
        break
      case 'fade-black':
        if (p < 0.5) {
          if (a) layers.push({ ...a, opacity: a.opacity * (1 - p * 2) })
        } else if (b) {
          layers.push({ ...b, opacity: b.opacity * ((p - 0.5) * 2) })
        }
        break
      case 'wipe-left': // reveal B from the right edge moving left
        if (a) layers.push(a)
        if (b) layers.push({ ...b, scissor: [W * (1 - p), 0, W * p, H] })
        break
      case 'wipe-right':
        if (a) layers.push(a)
        if (b) layers.push({ ...b, scissor: [0, 0, W * p, H] })
        break
      case 'slide-left': // B slides in from the right
        if (a) layers.push(a)
        if (b) layers.push({ ...b, offsetX: W * (1 - p) })
        break
      case 'slide-right':
        if (a) layers.push(a)
        if (b) layers.push({ ...b, offsetX: -W * (1 - p) })
        break
    }
  }

  private drawFrame(project: Project, t: number): void {
    this.compositor.setStageSize(project.width, project.height)
    this.compositor.setBackground(project.canvasBackground)
    const layers: DrawLayer[] = []

    for (const layer of visualLayersAt(project, t)) {
      if (layer.transition) {
        const a = this.layerFor(project, layer.clip, 1, layer.localTime)
        this.pushTransitionLayers(
          layers,
          project,
          a,
          layer.transition.clip,
          layer.transition.type,
          layer.transition.progress,
          t,
        )
      } else {
        const l = this.layerFor(project, layer.clip, layer.fade, layer.localTime)
        if (l) {
          // blurred fill behind the clip (skipped inside transition windows)
          if (
            (layer.clip.type === 'video' || layer.clip.type === 'image') &&
            layer.clip.backgroundBlur
          ) {
            const asset = project.assets.find(
              (a) => 'assetId' in layer.clip && a.id === layer.clip.assetId,
            )
            layers.push(
              this.backdropLayer(
                layer.clip,
                l.source,
                asset?.width ?? 1,
                asset?.height ?? 1,
                layer.fade,
                project.width,
                project.height,
              ),
            )
          }
          layers.push(l)
        }
      }
    }

    // subtitles: bottom-center, 5% margin
    const cueText = activeCueAt(project, t)
    if (cueText && project.subtitles) {
      const rendered = renderText(cueText, project.subtitles.style)
      layers.push({
        source: rendered.canvas,
        width: rendered.width,
        height: rendered.height,
        key: textCacheKey(cueText, project.subtitles.style),
        dynamic: false,
        fitMode: 'none',
        transform: {
          ...DEFAULT_TRANSFORM,
          y: project.height / 2 - rendered.height / 2 - project.height * 0.05,
        },
        adjustments: DEFAULT_ADJUSTMENTS,
        filter: null,
        opacity: 1,
      })
    }

    this.compositor.draw(layers)
  }
}
