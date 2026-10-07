import { DEFAULT_TEXT_STYLE, snapToFrame, type TextStyle } from '@/schema/project'
import type { ReelSegment } from '@/reel/plan'

/** A line of caption text over a time span. */
export interface TimedText {
  start: number
  end: number
  text: string
}

/** Bold, outlined, uppercase: the look viewers expect on short-form video. */
export const REEL_CAPTION_STYLE: TextStyle = {
  ...DEFAULT_TEXT_STYLE,
  fontFamily: 'Montserrat',
  fontSize: 80,
  fontWeight: 700,
  outlineWidth: 5,
  shadow: { color: '#000000', distance: 3 },
  textTransform: 'uppercase',
}

/**
 * Vertical offset from canvas center (px, +down). Facebook draws the
 * caption, profile and action buttons over the bottom ~35% of a Reel, so
 * captions sit just above that zone instead of at the usual bottom margin.
 */
export const REEL_CAPTION_Y = 240

/** captions shorter than this flash by unread (s) */
const MIN_CAPTION = 0.25
const MAX_WORDS = 4
const MAX_CHARS = 20

/**
 * Move cues from one source's timeline (what whisper heard) onto the Reel's
 * timeline. A cue keeps whatever parts of it survived trimming; the parts of
 * one source are contiguous on the timeline, so a cue that straddled a cut
 * silence simply closes up with it. Cues entirely in cut material vanish.
 */
export function mapCuesToTimeline(
  cues: TimedText[],
  segments: ReelSegment[],
  source: number,
): TimedText[] {
  const own = segments.filter((s) => s.source === source)
  const out: TimedText[] = []
  for (const cue of cues) {
    let start = Infinity
    let end = -Infinity
    let heard = 0
    for (const seg of own) {
      const from = Math.max(cue.start, seg.sourceIn)
      const to = Math.min(cue.end, seg.sourceIn + seg.duration)
      if (to <= from) continue
      heard += to - from
      start = Math.min(start, seg.start + (from - seg.sourceIn))
      end = Math.max(end, seg.start + (to - seg.sourceIn))
    }
    if (heard >= MIN_CAPTION) out.push({ start, end, text: cue.text.trim() })
  }
  return out
}

/**
 * Break sentences into punchy groups of a few words, timed in proportion to
 * their length, then make the result fit one text track: on the frame grid,
 * in order, never overlapping.
 */
export function toReelCaptions(cues: TimedText[], fps: number): TimedText[] {
  const chunks = cues.flatMap(chunkCue).sort((a, b) => a.start - b.start)
  const out: TimedText[] = []
  for (const chunk of chunks) {
    const start = snapToFrame(chunk.start, fps)
    const end = snapToFrame(chunk.end, fps)
    const prev = out[out.length - 1]
    if (prev && prev.end > start) prev.end = start
    if (prev && prev.end - prev.start < MIN_CAPTION) out.pop()
    if (end - start >= MIN_CAPTION) out.push({ start, end, text: chunk.text })
  }
  return out
}

function chunkCue(cue: TimedText): TimedText[] {
  const words = cue.text.split(/\s+/).filter(Boolean)
  const groups: string[][] = []
  for (const word of words) {
    const group = groups[groups.length - 1]
    const length = group ? group.join(' ').length + 1 + word.length : Infinity
    if (group && group.length < MAX_WORDS && length <= MAX_CHARS) group.push(word)
    else groups.push([word])
  }

  // spoken time roughly tracks characters, spaces included
  const weights = groups.map((g) => g.join(' ').length + 1)
  const total = weights.reduce((a, b) => a + b, 0)
  const span = cue.end - cue.start
  let t = cue.start
  return groups.map((g, i) => {
    const start = t
    t += (span * weights[i]) / total
    return { start, end: t, text: g.join(' ') }
  })
}
