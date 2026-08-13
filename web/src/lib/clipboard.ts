import { nanoid } from 'nanoid'
import type { Clip, Project } from '@/schema/project'
import { findClip } from '@/lib/timelineOps'

/**
 * In-app clip clipboard. Deliberately NOT the system clipboard: clips
 * reference project-local asset ids, so pasting across projects would dangle.
 * Copies store plain JSON snapshots plus the source track id (so paste can
 * prefer the original track).
 */

export interface CopiedClip {
  clip: Clip
  trackId: string
}

let clipboard: CopiedClip[] = []

export function copyClips(project: Project, clipIds: string[]): number {
  const copies: CopiedClip[] = []
  for (const id of clipIds) {
    const loc = findClip(project, id)
    if (loc) {
      copies.push({ clip: JSON.parse(JSON.stringify(loc.clip)) as Clip, trackId: loc.track.id })
    }
  }
  if (copies.length) clipboard = copies
  return copies.length
}

export function hasClips(): boolean {
  return clipboard.length > 0
}

/**
 * Snapshots for pasting at `at` (timeline s): earliest copied clip lands at
 * `at`, relative offsets between copied clips are preserved, ids are fresh.
 */
export function clipsForPaste(at: number): CopiedClip[] {
  if (!clipboard.length) return []
  const base = Math.min(...clipboard.map((c) => c.clip.start))
  return clipboard.map(({ clip, trackId }) => {
    const copy = JSON.parse(JSON.stringify(clip)) as Clip
    copy.id = nanoid()
    copy.start = at + (clip.start - base)
    if ('transitionOut' in copy) copy.transitionOut = null // adjacency won't hold at the target
    return { clip: copy, trackId }
  })
}
