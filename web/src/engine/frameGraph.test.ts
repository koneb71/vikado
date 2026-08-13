import { describe, expect, it } from 'vitest'
import { hexToRgb01, mediaClipsAt, sourceTimeAt } from '@/engine/frameGraph'
import { clipFromAsset } from '@/lib/clipFactory'
import { createProject, type Asset, type Project, type VideoClip } from '@/schema/project'

const asset: Asset = {
  id: 'a1',
  kind: 'video',
  name: 'clip.mp4',
  hash: 'h1',
  duration: 30,
  width: 1920,
  height: 1080,
  fps: 30,
  hasAudio: true,
  mimeType: 'video/mp4',
}

function projectWith(...specs: { start: number; duration: number; speed?: number; sourceIn?: number }[]) {
  const project: Project = createProject()
  project.assets.push(asset)
  const clips = specs.map((s) => {
    const clip = clipFromAsset(asset, s.start) as VideoClip
    clip.duration = s.duration
    clip.speed = s.speed ?? 1
    clip.sourceIn = s.sourceIn ?? 0
    project.tracks[0].clips.push(clip)
    return clip
  })
  return { project, clips }
}

describe('sourceTimeAt', () => {
  it('maps timeline time to source time through sourceIn', () => {
    const { clips } = projectWith({ start: 5, duration: 10, sourceIn: 2 })
    expect(sourceTimeAt(clips[0], 5)).toBe(2)
    expect(sourceTimeAt(clips[0], 8)).toBe(5)
  })

  it('consumes source faster than timeline when sped up', () => {
    const { clips } = projectWith({ start: 0, duration: 10, speed: 2, sourceIn: 1 })
    // 3 timeline seconds in => 6 source seconds consumed past sourceIn
    expect(sourceTimeAt(clips[0], 3)).toBe(7)
  })

  it('never returns a negative source time', () => {
    const { clips } = projectWith({ start: 5, duration: 5 })
    expect(sourceTimeAt(clips[0], 0)).toBe(0)
  })

  it('is always 0 for images, which have no source timeline', () => {
    const image = { ...asset, id: 'img', kind: 'image' as const, duration: null }
    const project = createProject()
    project.assets.push(image)
    const clip = clipFromAsset(image, 4)
    expect(sourceTimeAt(clip as never, 9)).toBe(0)
  })
})

describe('mediaClipsAt', () => {
  it('returns nothing outside any clip', () => {
    const { project } = projectWith({ start: 2, duration: 3 })
    expect(mediaClipsAt(project, 0)).toHaveLength(0)
    expect(mediaClipsAt(project, 9)).toHaveLength(0)
  })

  it('returns the clip on stage with its source time', () => {
    const { project } = projectWith({ start: 2, duration: 3, sourceIn: 1 })
    const at = mediaClipsAt(project, 3)
    expect(at).toHaveLength(1)
    expect(at[0].sourceTime).toBe(2)
  })

  it('includes both sides inside a transition window', () => {
    const { project, clips } = projectWith(
      { start: 0, duration: 4 },
      { start: 4, duration: 4 },
    )
    clips[0].transitionOut = { type: 'crossfade', duration: 1 }
    // window is centred on the cut at t=4, so 3.5..4.5 has both clips
    const inside = mediaClipsAt(project, 4.2)
    expect(inside.map((m) => m.clip.id).sort()).toEqual([clips[0].id, clips[1].id].sort())
    // and only one outside it
    expect(mediaClipsAt(project, 2)).toHaveLength(1)
  })

  it('skips hidden tracks', () => {
    const { project } = projectWith({ start: 0, duration: 5 })
    project.tracks[0].hidden = true
    expect(mediaClipsAt(project, 1)).toHaveLength(0)
  })
})

describe('hexToRgb01', () => {
  it('converts to the 0..1 range the shader uses', () => {
    expect(hexToRgb01('#000000')).toEqual([0, 0, 0])
    expect(hexToRgb01('#ffffff')).toEqual([1, 1, 1])
    const [r, g, b] = hexToRgb01('#00d000')
    expect(r).toBe(0)
    expect(g).toBeCloseTo(208 / 255)
    expect(b).toBe(0)
  })

  it('falls back to green for malformed input rather than throwing', () => {
    expect(hexToRgb01('nonsense')).toEqual([0, 1, 0])
  })
})
