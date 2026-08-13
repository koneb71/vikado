import { Compositor } from '@/engine/compositor/Compositor'
import { clipSpeed } from '@/lib/timelineOps'
import { AudioGraph } from '@/engine/AudioGraph'
import { MediaPool } from '@/engine/MediaPool'
import { audibleClipsAt, type AudibleClip } from '@/engine/activeClips'
import { buildFrameLayers, mediaClipsAt, type BlurStore } from '@/engine/frameGraph'
import { projectDuration, type Asset, type Project } from '@/schema/project'
import { useProjectStore } from '@/state/projectStore'
import { usePlaybackStore } from '@/state/playbackStore'

const SYNC_TOLERANCE_S = 0.08

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
  private blurCanvases: BlurStore = new Map()
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

  /** Pool key for an audible clip: detached audio clips get their OWN
   * element so they can't seek-fight the video clip sharing their asset. */
  private static audioKey(clip: AudibleClip['clip']): string {
    return clip.type === 'audio' ? `aclip:${clip.id}` : clip.assetId
  }

  /** Keep media elements at the right time / play state / volume. */
  private syncMedia(project: Project, t: number, isPlaying: boolean): void {
    const audible = audibleClipsAt(project, t)
    const audibleByKey = new Map(audible.map((a) => [PlaybackController.audioKey(a.clip), a]))
    const stage = mediaClipsAt(project, t)

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
   * Draw the frame at `t`. The layer stack itself is built by the shared
   * frameGraph module, which the in-browser exporter also uses — the preview
   * and a local export are the same code path, so they cannot drift.
   * Pixels come from the pool's media elements, which syncMedia has already
   * seeked to the right source time.
   */
  private drawFrame(project: Project, t: number): void {
    this.compositor.setStageSize(project.width, project.height)
    this.compositor.setBackground(project.canvasBackground)
    const layers = buildFrameLayers(
      project,
      t,
      (clip) => {
        const el = this.pool.peek(clip.assetId)
        if (!el || el instanceof HTMLAudioElement) return null
        if (el instanceof HTMLVideoElement && el.readyState < 2) return null
        return el
      },
      this.blurCanvases,
    )
    this.compositor.draw(layers)
  }
}
