import { clipEnd, type Project } from '@/schema/project'

/** Pixel distance within which edges magnetize. */
export const SNAP_THRESHOLD_PX = 8

export interface SnapResult {
  time: number
  /** the candidate time snapped to, for drawing the guide line (null = no snap) */
  snappedTo: number | null
}

/** All times worth snapping to: clip edges, playhead, timeline start. */
export function collectSnapPoints(
  project: Project,
  playhead: number,
  excludeClipIds: Set<string>,
): number[] {
  const points = [0, playhead]
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      if (excludeClipIds.has(clip.id)) continue
      points.push(clip.start, clipEnd(clip))
    }
  }
  return points
}

/**
 * Snap `time` to the nearest candidate within threshold. `offsets` lets a
 * drag snap by any of its edges (e.g. clip start AND end): each offset is
 * added to `time` before comparing, and subtracted from the result.
 */
export function applySnap(
  time: number,
  candidates: number[],
  thresholdS: number,
  offsets: number[] = [0],
): SnapResult {
  let best: { dist: number; snapped: number; result: number } | null = null
  for (const offset of offsets) {
    const edge = time + offset
    for (const c of candidates) {
      const dist = Math.abs(edge - c)
      if (dist <= thresholdS && (!best || dist < best.dist)) {
        best = { dist, snapped: c, result: c - offset }
      }
    }
  }
  return best
    ? { time: Math.max(0, best.result), snappedTo: best.snapped }
    : { time: Math.max(0, time), snappedTo: null }
}
