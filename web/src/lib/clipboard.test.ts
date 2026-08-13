import { describe, expect, it } from 'vitest'
import { copyClips, clipsForPaste, hasClips } from '@/lib/clipboard'
import { createProject, type VideoClip } from '@/schema/project'
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

function setup() {
  const project = createProject()
  project.assets.push(asset)
  const c1 = clipFromAsset(asset, 1) as VideoClip
  c1.duration = 2
  c1.transitionOut = { type: 'crossfade', duration: 0.5 }
  const c2 = clipFromAsset(asset, 5) as VideoClip
  c2.duration = 2
  project.tracks[0].clips.push(c1, c2)
  return { project, c1, c2 }
}

describe('clipboard', () => {
  it('copies and pastes preserving relative offsets with fresh ids', () => {
    const { project, c1, c2 } = setup()
    expect(copyClips(project, [c1.id, c2.id])).toBe(2)
    expect(hasClips()).toBe(true)

    const pasted = clipsForPaste(10)
    expect(pasted).toHaveLength(2)
    expect(pasted[0].clip.start).toBe(10) // earliest lands at `at`
    expect(pasted[1].clip.start).toBe(14) // +4 relative offset preserved
    expect(pasted[0].clip.id).not.toBe(c1.id)
    expect(pasted[0].trackId).toBe(project.tracks[0].id)
  })

  it('clears transitions on pasted clips (adjacency will not hold)', () => {
    const { project, c1 } = setup()
    copyClips(project, [c1.id])
    const [pasted] = clipsForPaste(0)
    expect((pasted.clip as VideoClip).transitionOut).toBeNull()
  })

  it('ignores unknown clip ids and keeps previous clipboard on empty copy', () => {
    const { project, c1 } = setup()
    copyClips(project, [c1.id])
    expect(copyClips(project, ['nope'])).toBe(0)
    expect(clipsForPaste(0)).toHaveLength(1) // previous copy retained
  })
})
