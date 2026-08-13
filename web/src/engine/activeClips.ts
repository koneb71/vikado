import {
  clipEnd,
  type AudioClip,
  type Clip,
  type Project,
  type Track,
  type Transition,
  type VideoClip,
} from '@/schema/project'

/**
 * Pure evaluation of "what is on screen / audible at time t".
 * The compositor and audio graph consume this; the Rust renderer implements
 * the same semantics on the whole timeline at once.
 */

export interface TransitionState {
  /** incoming clip (B) */
  clip: Clip
  type: Transition['type']
  /** 0 at window start → 1 at window end */
  progress: number
}

export interface VisualLayer {
  track: Track
  clip: Clip // video | image | text
  /** 0..1 opacity multiplier from fadeIn/fadeOut envelopes */
  fade: number
  /** local time within the clip: t - clip.start */
  localTime: number
  /**
   * Set while t is inside a transition window between this clip (outgoing)
   * and the next (incoming). The window is centered on the cut; each side
   * draws from source beyond its trim (freezing when headroom runs out).
   */
  transition?: TransitionState
}

export interface AudibleClip {
  track: Track
  clip: VideoClip | AudioClip
  /** effective gain including clip volume, fades and track mute */
  gain: number
  /** source time the media element should be at */
  sourceTime: number
}

export function fadeEnvelope(clip: Clip, localTime: number): number {
  let fade = 1
  const fadeIn = 'fadeIn' in clip ? clip.fadeIn : 0
  const fadeOut = 'fadeOut' in clip ? clip.fadeOut : 0
  if (fadeIn > 0 && localTime < fadeIn) fade *= localTime / fadeIn
  const untilEnd = clip.duration - localTime
  if (fadeOut > 0 && untilEnd < fadeOut) fade *= Math.max(0, untilEnd / fadeOut)
  return Math.min(1, Math.max(0, fade))
}

/** Visual layers at time t, bottom-up (track 0 first). */
export function visualLayersAt(project: Project, t: number): VisualLayer[] {
  const layers: VisualLayer[] = []
  for (const track of project.tracks) {
    if (track.kind === 'audio' || track.hidden) continue
    const clips = track.clips
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i]
      const transition = transitionWindow(clips, i, t)
      if (transition) {
        // draw the OUTGOING clip as the base layer; the incoming clip rides
        // along in `transition` and is blended by the compositor
        const a = transition.a
        const localTime = t - a.start
        layers.push({
          track,
          clip: a,
          fade: 1, // fades don't apply inside a transition window
          localTime,
          transition: { clip: transition.b, type: transition.type, progress: transition.progress },
        })
        break
      }
      if (t >= clip.start && t < clipEnd(clip)) {
        const localTime = t - clip.start
        layers.push({ track, clip, fade: fadeEnvelope(clip, localTime), localTime })
        break // clips on a track don't overlap
      }
    }
  }
  return layers
}

interface TransitionHit {
  a: Clip
  b: Clip
  type: TransitionState['type']
  progress: number
}

/**
 * If t falls inside the transition window around the cut after clips[i]
 * (window = [cut - d/2, cut + d/2], clips must be adjacent), returns the pair.
 */
function transitionWindow(clips: Clip[], i: number, t: number): TransitionHit | null {
  const a = clips[i]
  const b = clips[i + 1]
  if (!a || !b) return null
  if (!('transitionOut' in a) || !a.transitionOut) return null
  const cut = clipEnd(a)
  if (Math.abs(b.start - cut) > 1e-6) return null // must be adjacent
  const half = a.transitionOut.duration / 2
  if (t < cut - half || t >= cut + half) return null
  return {
    a,
    b,
    type: a.transitionOut.type,
    progress: (t - (cut - half)) / a.transitionOut.duration,
  }
}

/** Clips that should be audible at time t. */
export function audibleClipsAt(project: Project, t: number): AudibleClip[] {
  const out: AudibleClip[] = []
  for (const track of project.tracks) {
    if (track.kind === 'text') continue
    for (const clip of track.clips) {
      if (t < clip.start || t >= clipEnd(clip)) continue
      if (clip.type !== 'video' && clip.type !== 'audio') continue
      if (clip.type === 'video' && clip.muted) continue
      const localTime = t - clip.start
      const gain = track.muted ? 0 : clip.volume * fadeEnvelope(clip, localTime)
      out.push({ track, clip, gain, sourceTime: clip.sourceIn + localTime * clip.speed })
      break
    }
  }
  return out
}

/** Subtitle cue text visible at t (if any). */
export function activeCueAt(project: Project, t: number): string | null {
  const cues = project.subtitles?.cues
  if (!cues) return null
  for (const cue of cues) {
    if (t >= cue.start && t < cue.end) return cue.text
  }
  return null
}
