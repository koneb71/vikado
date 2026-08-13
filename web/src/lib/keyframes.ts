import type {
  Clip,
  Easing,
  Keyframe,
  KeyframeProp,
  Keyframes,
  Transform,
} from '@/schema/project'

/**
 * Keyframe evaluation — the preview's source of truth. The Rust renderer
 * compiles the SAME math into ffmpeg expressions (filtergraph.rs kf_expr);
 * change both together.
 *
 * Semantics: a property with ≥1 keyframes ignores the static transform value;
 * between keyframes the value interpolates with the LEFT keyframe's easing;
 * outside the keyframe range it clamps to the nearest keyframe.
 */

export function easeProgress(easing: Easing, p: number): number {
  switch (easing) {
    case 'linear':
      return p
    case 'ease-in':
      return p * p
    case 'ease-out':
      return p * (2 - p)
    case 'ease-in-out':
      return p * p * (3 - 2 * p)
  }
}

/** Value of one keyframe track at clip-local time t; `fallback` when empty. */
export function sampleTrack(track: Keyframe[], t: number, fallback: number): number {
  if (track.length === 0) return fallback
  if (t <= track[0].t) return track[0].value
  const last = track[track.length - 1]
  if (t >= last.t) return last.value
  for (let i = 0; i < track.length - 1; i++) {
    const a = track[i]
    const b = track[i + 1]
    if (t >= a.t && t < b.t) {
      const span = b.t - a.t
      const p = span > 0 ? (t - a.t) / span : 1
      return a.value + (b.value - a.value) * easeProgress(a.easing, p)
    }
  }
  return last.value
}

export function hasAnyKeyframes(keyframes: Keyframes | undefined): boolean {
  if (!keyframes) return false
  return (
    keyframes.x.length > 0 ||
    keyframes.y.length > 0 ||
    keyframes.scale.length > 0 ||
    keyframes.rotation.length > 0 ||
    keyframes.opacity.length > 0
  )
}

/** Effective transform of a visual clip at clip-local time. */
export function sampleTransform(clip: Clip, localTime: number): Transform {
  if (!('transform' in clip)) throw new Error('audio clips have no transform')
  const st = clip.transform
  const kf = 'keyframes' in clip ? clip.keyframes : undefined
  if (!kf || !hasAnyKeyframes(kf)) return st
  return {
    x: sampleTrack(kf.x, localTime, st.x),
    y: sampleTrack(kf.y, localTime, st.y),
    scale: Math.max(0.01, sampleTrack(kf.scale, localTime, st.scale)),
    rotation: sampleTrack(kf.rotation, localTime, st.rotation),
    opacity: Math.min(1, Math.max(0, sampleTrack(kf.opacity, localTime, st.opacity))),
  }
}

/** All keyframe times on a clip (deduped, sorted) — for timeline markers. */
export function keyframeTimes(keyframes: Keyframes | undefined): number[] {
  if (!keyframes) return []
  const times = new Set<number>()
  for (const prop of Object.keys(keyframes) as KeyframeProp[]) {
    for (const kf of keyframes[prop]) times.add(kf.t)
  }
  return [...times].sort((a, b) => a - b)
}

const EPS = 1 / 120

/** Insert or replace (within half a frame) a keyframe; returns a sorted copy. */
export function upsertKeyframe(track: Keyframe[], t: number, value: number): Keyframe[] {
  const next = track.filter((k) => Math.abs(k.t - t) > EPS)
  const existing = track.find((k) => Math.abs(k.t - t) <= EPS)
  next.push({ t, value, easing: existing?.easing ?? 'linear' })
  next.sort((a, b) => a.t - b.t)
  return next
}

/** Remove the keyframe at t (within half a frame); returns a copy. */
export function removeKeyframeAt(track: Keyframe[], t: number): Keyframe[] {
  return track.filter((k) => Math.abs(k.t - t) > EPS)
}

export function keyframeAt(track: Keyframe[], t: number): Keyframe | undefined {
  return track.find((k) => Math.abs(k.t - t) <= EPS)
}
