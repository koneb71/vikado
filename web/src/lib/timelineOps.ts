import { nanoid } from 'nanoid'
import {
  clipEnd,
  trackAcceptsClip,
  type Clip,
  type Project,
  type Track,
} from '@/schema/project'

/**
 * Pure timeline mutations. All functions mutate the given Project draft in
 * place (they are designed to run inside immer `produce`) and enforce the
 * track invariant: clips non-overlapping, sorted by start.
 */

export interface ClipLocation {
  track: Track
  trackIndex: number
  clip: Clip
  clipIndex: number
}

export function findClip(project: Project, clipId: string): ClipLocation | null {
  for (let ti = 0; ti < project.tracks.length; ti++) {
    const track = project.tracks[ti]
    const ci = track.clips.findIndex((c) => c.id === clipId)
    if (ci !== -1) return { track, trackIndex: ti, clip: track.clips[ci], clipIndex: ci }
  }
  return null
}

export function sortTrack(track: Track): void {
  track.clips.sort((a, b) => a.start - b.start)
}

/**
 * Clamp a desired start so [start, start+duration) doesn't overlap any other
 * clip on the track. The clip stays as close to `desired` as neighbors allow;
 * if the gap at the desired position is too small, falls back to the clip's
 * current start (or the end of the timeline when it doesn't fit anywhere).
 */
export function clampStart(track: Track, clipId: string, desired: number, duration: number): number {
  const others = track.clips.filter((c) => c.id !== clipId).sort((a, b) => a.start - b.start)
  const start = Math.max(0, desired)

  // find the gap the desired start falls into
  let gapStart = 0
  for (let i = 0; i <= others.length; i++) {
    const gapEnd = i < others.length ? others[i].start : Infinity
    if (start + duration <= gapEnd && start >= gapStart) return start
    // desired start collides — try clamping inside this gap if it fits
    if (start < gapEnd && gapEnd - gapStart >= duration) {
      const clamped = Math.min(Math.max(start, gapStart), gapEnd - duration)
      if (clamped >= gapStart) return clamped
    }
    if (i < others.length) gapStart = clipEnd(others[i])
  }
  // no gap fits: append at end of track
  return others.length ? clipEnd(others[others.length - 1]) : 0
}

export function addClip(project: Project, trackId: string, clip: Clip): void {
  const track = project.tracks.find((t) => t.id === trackId)
  if (!track || !trackAcceptsClip(track, clip.type)) return
  clip.start = clampStart(track, clip.id, clip.start, clip.duration)
  track.clips.push(clip)
  sortTrack(track)
}

export function deleteClip(project: Project, clipId: string): void {
  const loc = findClip(project, clipId)
  if (loc) loc.track.clips.splice(loc.clipIndex, 1)
}

export function moveClip(
  project: Project,
  clipId: string,
  desiredStart: number,
  toTrackId?: string,
): void {
  const loc = findClip(project, clipId)
  if (!loc) return
  const dest = toTrackId ? project.tracks.find((t) => t.id === toTrackId) : loc.track
  if (!dest || !trackAcceptsClip(dest, loc.clip.type)) return

  if (dest.id !== loc.track.id) loc.track.clips.splice(loc.clipIndex, 1)
  loc.clip.start = clampStart(dest, clipId, desiredStart, loc.clip.duration)
  if (dest.id !== loc.track.id) dest.clips.push(loc.clip)
  sortTrack(dest)
}

/** Max source-side room available beyond the clip's current out point. */
function sourceHeadroom(project: Project, clip: Clip): number {
  if (clip.type !== 'video' && clip.type !== 'audio') return Infinity
  const asset = project.assets.find((a) => a.id === clip.assetId)
  if (!asset?.duration) return Infinity
  const speed = clipSpeed(clip)
  // remaining source seconds beyond the out point, converted to timeline seconds
  return (asset.duration - (clip.sourceIn + clip.duration * speed)) / speed
}

/** Playback rate; 1 for clip types without a speed field. */
export function clipSpeed(clip: Clip): number {
  return 'speed' in clip ? clip.speed : 1
}

/** Drag the clip's left edge to `newStart` (timeline seconds). */
export function trimClipLeft(project: Project, clipId: string, newStart: number): void {
  const loc = findClip(project, clipId)
  if (!loc) return
  const { clip, track } = loc
  const end = clipEnd(clip)

  const prev = track.clips
    .filter((c) => c.id !== clipId && clipEnd(c) <= end)
    .reduce<number>((max, c) => Math.max(max, clipEnd(c)), 0)
  // source room converted to timeline seconds at the clip's playback rate
  const sourceRoom = 'sourceIn' in clip ? clip.sourceIn / clipSpeed(clip) : Infinity

  const minStart = Math.max(prev, 0, clip.start - sourceRoom)
  const maxStart = end - MIN_CLIP_DURATION
  const start = Math.min(Math.max(newStart, minStart), maxStart)

  const delta = start - clip.start
  if ('sourceIn' in clip) clip.sourceIn += delta * clipSpeed(clip)
  clip.start = start
  clip.duration = end - start
}

/** Drag the clip's right edge to `newEnd` (timeline seconds). */
export function trimClipRight(project: Project, clipId: string, newEnd: number): void {
  const loc = findClip(project, clipId)
  if (!loc) return
  const { clip, track } = loc

  const next = track.clips
    .filter((c) => c.id !== clipId && c.start >= clip.start)
    .reduce<number>((min, c) => Math.min(min, c.start), Infinity)
  const maxEnd = Math.min(
    next,
    clip.start + clip.duration + sourceHeadroom(project, clip),
  )

  const end = Math.min(Math.max(newEnd, clip.start + MIN_CLIP_DURATION), maxEnd)
  clip.duration = end - clip.start
}

export const MIN_CLIP_DURATION = 0.05

/** Split a clip at an absolute timeline time. Returns the new right-half id. */
export function splitClip(project: Project, clipId: string, at: number): string | null {
  const loc = findClip(project, clipId)
  if (!loc) return null
  const { clip, track, clipIndex } = loc
  if (at <= clip.start + MIN_CLIP_DURATION || at >= clipEnd(clip) - MIN_CLIP_DURATION) return null

  const offset = at - clip.start
  // deep-clone via JSON: clips are plain data, and this reads through immer draft proxies
  const right = JSON.parse(JSON.stringify(clip)) as Clip
  right.id = nanoid()
  right.start = at
  right.duration = clip.duration - offset
  if ('sourceIn' in right) right.sourceIn += offset * clipSpeed(right)
  if ('fadeIn' in right) right.fadeIn = 0
  if ('fadeOut' in clip) clip.fadeOut = 0
  if ('transitionOut' in clip) {
    // the transition into the next clip belongs to the right half now
    clip.transitionOut = null
  }

  clip.duration = offset
  track.clips.splice(clipIndex + 1, 0, right)
  return right.id
}

/** Ripple: shift every clip on the track starting at/after `fromT` by `delta`. */
export function rippleShift(track: Track, fromT: number, delta: number): void {
  for (const clip of track.clips) {
    if (clip.start >= fromT - 1e-6) clip.start += delta
  }
  sortTrack(track)
}
