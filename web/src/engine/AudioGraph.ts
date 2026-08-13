import type { AudibleClip } from '@/engine/activeClips'
import { clipEnd } from '@/schema/project'
import { clipSpeed } from '@/lib/timelineOps'

interface Chain {
  el: HTMLVideoElement | HTMLAudioElement
  source: MediaElementAudioSourceNode
  clipGain: GainNode
  /** signature of the envelope currently scheduled on clipGain */
  scheduled: string
}

/**
 * Web Audio mixing graph for the preview:
 *
 *   element → MediaElementAudioSourceNode → clipGain → master → destination
 *
 * Volume/fade envelopes are SCHEDULED on clipGain (setValueAtTime + linear
 * ramps mirroring activeClips.fadeEnvelope) instead of written per-frame,
 * which eliminates fade zipper noise. The context also provides the transport
 * clock: `now()` while running is drift-free against what's audible.
 *
 * Autoplay policy: the context starts suspended until `unlock()` runs inside
 * a user gesture. Elements routed through a suspended context are silent, so
 * the controller registers one-time gesture listeners.
 */
export class AudioGraph {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private chains = new Map<string, Chain>()
  private paused = true

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0 // transport starts paused
      this.master.connect(this.ctx.destination)
    }
    return this.ctx
  }

  /** Resume the context — MUST be called from a user gesture handler. */
  unlock(): void {
    const ctx = this.ensureCtx()
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
  }

  get running(): boolean {
    return this.ctx?.state === 'running'
  }

  /** Context time in seconds (only meaningful while running). */
  now(): number {
    return this.ctx?.currentTime ?? 0
  }

  /**
   * Route an element through the graph. Idempotent per (assetId, element);
   * a NEW element for a known assetId (LRU re-create) rebuilds the chain.
   * createMediaElementSource throws if called twice for one element — the
   * chain cache guarantees exactly one call.
   */
  connect(key: string, el: HTMLVideoElement | HTMLAudioElement): void {
    const ctx = this.ensureCtx()
    const existing = this.chains.get(key)
    if (existing?.el === el) return
    if (existing) this.teardown(existing)

    try {
      const source = ctx.createMediaElementSource(el)
      const clipGain = ctx.createGain()
      clipGain.gain.value = 0
      source.connect(clipGain)
      clipGain.connect(this.master!)
      // element-level volume/mute must stay neutral from here on — the graph
      // owns loudness
      el.muted = false
      el.volume = 1
      this.chains.set(key, { el, source, clipGain, scheduled: '' })
    } catch {
      // element already claimed by another context (shouldn't happen) —
      // leave it un-routed rather than crash the render loop
    }
  }

  disconnect(key: string): void {
    const chain = this.chains.get(key)
    if (chain) {
      this.teardown(chain)
      this.chains.delete(key)
    }
  }

  private teardown(chain: Chain): void {
    try {
      chain.source.disconnect()
      chain.clipGain.disconnect()
    } catch {
      // already disconnected
    }
  }

  /**
   * (Re)schedule gain envelopes for the audible set. `timelineToCtx` maps a
   * timeline second to a context timestamp under the current play anchor.
   * `anchorKey` changes on every re-anchor (play/seek/clock switch) which
   * invalidates previously scheduled envelopes.
   */
  scheduleAudible(
    audibleByKey: Map<string, AudibleClip>,
    timelineToCtx: (t: number) => number,
    anchorKey: number,
  ): void {
    if (!this.ctx || !this.running) return
    const now = this.ctx.currentTime

    for (const [key, chain] of this.chains) {
      const entry = audibleByKey.get(key)
      if (!entry) {
        if (chain.scheduled !== 'silent') {
          chain.clipGain.gain.cancelScheduledValues(now)
          chain.clipGain.gain.setTargetAtTime(0, now, 0.01)
          chain.scheduled = 'silent'
        }
        continue
      }

      const { clip, track } = entry
      const speed = clipSpeed(clip)
      const signature = JSON.stringify([
        anchorKey,
        clip.id,
        clip.volume,
        clip.fadeIn,
        clip.fadeOut,
        clip.start,
        clip.duration,
        speed,
        track.muted,
      ])
      if (chain.scheduled === signature) continue
      chain.scheduled = signature

      const gain = chain.clipGain.gain
      gain.cancelScheduledValues(now)
      if (track.muted || clip.volume <= 0) {
        gain.setValueAtTime(0, now)
        continue
      }

      // envelope in timeline time, mirrored from activeClips.fadeEnvelope
      // (GainNode handles volume > 1, unlike HTMLMediaElement.volume)
      const vol = clip.volume
      const fadeInEnd = clip.start + clip.fadeIn
      const fadeOutStart = clipEnd(clip) - clip.fadeOut
      gain.setValueAtTime(entry.gain, now)
      if (clip.fadeIn > 0 && timelineToCtx(fadeInEnd) > now) {
        gain.linearRampToValueAtTime(vol, Math.max(now, timelineToCtx(fadeInEnd)))
      } else {
        gain.setValueAtTime(vol, now)
      }
      if (clip.fadeOut > 0) {
        gain.setValueAtTime(vol, Math.max(now, timelineToCtx(fadeOutStart)))
        gain.linearRampToValueAtTime(0, Math.max(now, timelineToCtx(clipEnd(clip))))
      }
    }
  }

  /** Master mute while paused/scrubbing so seeks never blip. */
  setTransportPaused(paused: boolean): void {
    if (this.paused === paused) return
    this.paused = paused
    if (!this.ctx || !this.master) return
    const now = this.ctx.currentTime
    this.master.gain.cancelScheduledValues(now)
    this.master.gain.setTargetAtTime(paused ? 0 : 1, now, 0.01)
    if (paused) {
      // invalidate envelopes so resume reschedules from scratch
      for (const chain of this.chains.values()) chain.scheduled = ''
    }
  }

  dispose(): void {
    for (const chain of this.chains.values()) this.teardown(chain)
    this.chains.clear()
    void this.ctx?.close().catch(() => {})
    this.ctx = null
    this.master = null
  }
}
