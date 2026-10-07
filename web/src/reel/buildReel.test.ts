import { describe, expect, it } from 'vitest'
import { zProject, type Asset, type TextClip, type VideoClip } from '@/schema/project'
import { buildReelProject } from '@/reel/buildReel'
import { planReel, type ReelSource } from '@/reel/plan'
import { REEL_CAPTION_Y } from '@/reel/captions'

function source(id: string, width: number, height: number, framing: ReelSource['framing']): ReelSource {
  const asset: Asset = {
    id,
    kind: 'video',
    name: `${id}.mp4`,
    hash: id,
    duration: 8,
    width,
    height,
    fps: 30,
    hasAudio: true,
    mimeType: 'video/mp4',
  }
  return { asset, ranges: [{ start: 0, end: 8 }], framing, captions: false }
}

describe('buildReelProject', () => {
  const sources = [
    source('phone', 1080, 1920, 'fill'),
    source('wide', 1920, 1080, 'blur'),
    source('wide2', 1920, 1080, 'fill'),
  ]
  const plan = planReel(sources)
  const project = buildReelProject('My Reel', sources, plan, [
    { start: 0, end: 1.5, text: 'hello there' },
  ])

  it('is a valid 9:16 project', () => {
    expect(() => zProject.parse(project)).not.toThrow()
    expect([project.width, project.height, project.fps]).toEqual([1080, 1920, 30])
    expect(project.assets.map((a) => a.id)).toEqual(['phone', 'wide', 'wide2'])
  })

  it('frames each clip per its source', () => {
    const clips = project.tracks[0].clips as VideoClip[]
    expect(clips.map((c) => [c.crop !== null, c.backgroundBlur])).toEqual([
      [false, false],
      [false, true],
      [true, false],
    ])
    expect(clips[0].transitionOut?.type).toBe('crossfade')
    expect(clips[2].fadeOut).toBeGreaterThan(0)
    expect(clips.map((c) => c.sourceIn)).toEqual(plan.segments.map((s) => s.sourceIn))
  })

  it('puts captions on their own text track in the safe zone', () => {
    const track = project.tracks[1]
    expect(track.kind).toBe('text')
    const [caption] = track.clips as TextClip[]
    expect(caption.text).toBe('hello there')
    expect(caption.duration).toBe(1.5)
    expect(caption.transform.y).toBe(REEL_CAPTION_Y)
  })

  it('leaves out the captions track when there are none', () => {
    expect(buildReelProject('x', sources, plan).tracks).toHaveLength(1)
  })
})
