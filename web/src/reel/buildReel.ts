import { nanoid } from 'nanoid'
import { clipFromAsset, newTextClip } from '@/lib/clipFactory'
import { createProject, type Clip, type Project, type TextClip } from '@/schema/project'
import { REEL_HEIGHT, REEL_WIDTH, frameForReel } from '@/reel/framing'
import { REEL_CAPTION_STYLE, REEL_CAPTION_Y, type TimedText } from '@/reel/captions'
import type { ReelPlan, ReelSource } from '@/reel/plan'

/** a soft landing instead of an audio click when the Reel loops */
const END_FADE = 0.25
/** captions pop in with a quick zoom */
const CAPTION_POP = 0.12

/**
 * Turn a plan into an ordinary project: a 9:16 canvas, one video track of
 * back-to-back clips and, when there are captions, a text track above it.
 * Everything stays editable afterwards like any hand-made project.
 */
export function buildReelProject(
  name: string,
  sources: ReelSource[],
  plan: ReelPlan,
  captions: TimedText[] = [],
  fps = 30,
): Project {
  const project = createProject(name)
  project.width = REEL_WIDTH
  project.height = REEL_HEIGHT
  project.fps = fps

  const used = new Set(plan.segments.map((s) => s.source))
  project.assets = [...new Map([...used].map((i) => [sources[i].asset.id, sources[i].asset])).values()]

  const video = project.tracks[0]
  video.name = 'Video'
  video.clips = plan.segments.map((seg, i): Clip => {
    const { asset, framing } = sources[seg.source]
    const clip = clipFromAsset(asset, seg.start)
    if (clip.type !== 'video') throw new Error(`${asset.name} is not a video`)
    const last = i === plan.segments.length - 1
    return {
      ...clip,
      ...frameForReel(asset, framing, project.width, project.height),
      sourceIn: seg.sourceIn,
      duration: seg.duration,
      transitionOut: seg.transitionOut,
      fadeOut: last ? Math.min(END_FADE, seg.duration / 2) : 0,
    }
  })

  if (captions.length) {
    project.tracks.push({
      id: nanoid(),
      kind: 'text',
      name: 'Captions',
      muted: false,
      hidden: false,
      clips: captions.map(captionClip),
    })
  }
  return project
}

function captionClip(caption: TimedText): TextClip {
  const clip = newTextClip(caption.start, caption.text)
  const duration = caption.end - caption.start
  return {
    ...clip,
    duration,
    style: { ...REEL_CAPTION_STYLE },
    transform: { ...clip.transform, y: REEL_CAPTION_Y },
    animationIn: { type: 'zoom-in', duration: Math.min(CAPTION_POP, duration / 2) },
  }
}
