import { describe, expect, it } from 'vitest'
import {
  addClip,
  clampStart,
  deleteClip,
  moveClip,
  splitClip,
  trimClipLeft,
  trimClipRight,
} from '@/lib/timelineOps'
import { createProject, type Project, type VideoClip } from '@/schema/project'
import { clipFromAsset } from '@/lib/clipFactory'
import type { Asset } from '@/schema/project'

const asset: Asset = {
  id: 'a1',
  kind: 'video',
  name: 'test.mp4',
  hash: 'h1',
  duration: 10,
  width: 1920,
  height: 1080,
  fps: 30,
  hasAudio: true,
  mimeType: 'video/mp4',
}

function projectWith(...clips: { start: number; duration: number }[]): {
  project: Project
  ids: string[]
} {
  const project = createProject()
  project.assets.push(asset)
  const ids: string[] = []
  for (const c of clips) {
    const clip = clipFromAsset(asset, c.start) as VideoClip
    clip.duration = c.duration
    project.tracks[0].clips.push(clip)
    ids.push(clip.id)
  }
  return { project, ids }
}

describe('clampStart', () => {
  it('returns desired start when there is no collision', () => {
    const { project } = projectWith({ start: 0, duration: 2 })
    expect(clampStart(project.tracks[0], 'x', 5, 3)).toBe(5)
  })

  it('clamps against a neighbor', () => {
    const { project } = projectWith({ start: 0, duration: 2 }, { start: 5, duration: 2 })
    // wants 4 with duration 2 → would overlap clip at 5 → clamped to 3
    expect(clampStart(project.tracks[0], 'x', 4, 2)).toBe(3)
  })

  it('appends at the end when nothing fits', () => {
    const { project } = projectWith({ start: 0, duration: 2 }, { start: 2, duration: 2 })
    expect(clampStart(project.tracks[0], 'x', 1, 5)).toBe(4)
  })
})

describe('trim', () => {
  it('trim right respects source headroom', () => {
    const { project, ids } = projectWith({ start: 0, duration: 5 })
    trimClipRight(project, ids[0], 20) // asset is only 10s long
    expect(project.tracks[0].clips[0].duration).toBe(10)
  })

  it('trim left adjusts sourceIn', () => {
    const { project, ids } = projectWith({ start: 2, duration: 5 })
    trimClipLeft(project, ids[0], 4)
    const clip = project.tracks[0].clips[0] as VideoClip
    expect(clip.start).toBe(4)
    expect(clip.duration).toBe(3)
    expect(clip.sourceIn).toBe(2)
  })

  it('trim left cannot exceed sourceIn headroom', () => {
    const { project, ids } = projectWith({ start: 2, duration: 5 })
    trimClipLeft(project, ids[0], 0) // sourceIn is 0, can't extend before source start
    const clip = project.tracks[0].clips[0] as VideoClip
    expect(clip.start).toBe(2)
  })
})

describe('splitClip', () => {
  it('splits into two adjacent clips with adjusted sourceIn', () => {
    const { project, ids } = projectWith({ start: 1, duration: 6 })
    const rightId = splitClip(project, ids[0], 4)
    const [left, right] = project.tracks[0].clips as VideoClip[]
    expect(rightId).toBe(right.id)
    expect(left.duration).toBe(3)
    expect(right.start).toBe(4)
    expect(right.duration).toBe(3)
    expect(right.sourceIn).toBe(3)
  })

  it('refuses to split at clip edges', () => {
    const { project, ids } = projectWith({ start: 1, duration: 6 })
    expect(splitClip(project, ids[0], 1)).toBeNull()
    expect(splitClip(project, ids[0], 7)).toBeNull()
    expect(project.tracks[0].clips).toHaveLength(1)
  })
})

describe('moveClip', () => {
  it('moves within a track and clamps into gaps', () => {
    const { project, ids } = projectWith({ start: 0, duration: 2 }, { start: 6, duration: 2 })
    moveClip(project, ids[0], 5)
    expect(project.tracks[0].clips.map((c) => c.start)).toEqual([4, 6])
  })

  it('refuses incompatible target tracks', () => {
    const { project, ids } = projectWith({ start: 0, duration: 2 })
    project.tracks.push({
      id: 't-audio',
      kind: 'audio',
      name: 'Audio 1',
      muted: false,
      hidden: false,
      clips: [],
    })
    moveClip(project, ids[0], 0, 't-audio')
    expect(project.tracks[0].clips).toHaveLength(1)
    expect(project.tracks[1].clips).toHaveLength(0)
  })
})

describe('addClip / deleteClip', () => {
  it('keeps clips sorted', () => {
    const { project } = projectWith({ start: 5, duration: 2 })
    const clip = clipFromAsset(asset, 0)
    clip.duration = 2 // fits in the gap before the existing clip
    addClip(project, project.tracks[0].id, clip)
    expect(project.tracks[0].clips[0].id).toBe(clip.id)
  })

  it('appends at end when the clip cannot fit the desired gap', () => {
    const { project } = projectWith({ start: 5, duration: 2 })
    const clip = clipFromAsset(asset, 0) // 10s long — gap before 5 is too small
    addClip(project, project.tracks[0].id, clip)
    expect(clip.start).toBe(7)
  })

  it('deletes by id', () => {
    const { project, ids } = projectWith({ start: 0, duration: 2 }, { start: 3, duration: 2 })
    deleteClip(project, ids[0])
    expect(project.tracks[0].clips).toHaveLength(1)
    expect(project.tracks[0].clips[0].id).toBe(ids[1])
  })
})

describe('speed-aware source math', () => {
  function speedClip(start: number, duration: number, speed: number) {
    const { project, ids } = projectWith({ start, duration })
    const clip = project.tracks[0].clips[0] as VideoClip
    clip.speed = speed
    return { project, clip, id: ids[0] }
  }

  it('trim right headroom scales with speed (2× consumes source twice as fast)', () => {
    // asset 10s; 3s timeline at 2× consumes 6s of source → 4s source left = 2s timeline
    const { project, id } = speedClip(0, 3, 2)
    trimClipRight(project, id, 100)
    expect(project.tracks[0].clips[0].duration).toBe(5)
  })

  it('trim right headroom scales with speed (0.5× stretches source)', () => {
    // asset 10s; 4s timeline at 0.5× consumes 2s → 8s source left = 16s timeline
    const { project, id } = speedClip(0, 4, 0.5)
    trimClipRight(project, id, 100)
    expect(project.tracks[0].clips[0].duration).toBe(20)
  })

  it('trim left converts timeline delta to source delta', () => {
    const { project, clip, id } = speedClip(2, 4, 2)
    clip.sourceIn = 4 // 4 source seconds available = 2 timeline seconds at 2×
    trimClipLeft(project, id, 0) // wants to extend 2s back; only 2 allowed
    expect(clip.start).toBe(0)
    expect(clip.sourceIn).toBe(0)
    expect(clip.duration).toBe(6)
  })

  it('split adjusts the right half sourceIn by offset × speed', () => {
    const { project, id } = speedClip(0, 4, 2)
    splitClip(project, id, 1)
    const [left, right] = project.tracks[0].clips as VideoClip[]
    expect(left.duration).toBe(1)
    expect(right.sourceIn).toBe(2) // 1 timeline second = 2 source seconds
    expect(right.duration).toBe(3)
  })
})
