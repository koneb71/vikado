import type { Asset, Transition } from '@/schema/project'
import { REEL_FPS, REEL_MAX_DURATION, type Framing } from '@/reel/framing'
import { totalLength, type Range } from '@/reel/silence'

/** One raw video going into the Reel, with what survives of it. */
export interface ReelSource {
  asset: Asset
  /** source ranges to keep, in order (the whole clip when not trimming) */
  ranges: Range[]
  framing: Framing
  captions: boolean
}

export interface ReelOptions {
  maxDuration: number
  transition: Transition['type'] | null
  transitionDuration: number
  fps: number
}

export const DEFAULT_REEL_OPTIONS: ReelOptions = {
  maxDuration: REEL_MAX_DURATION,
  transition: 'crossfade',
  transitionDuration: 0.4,
  fps: REEL_FPS,
}

/** One clip on the Reel's timeline. */
export interface ReelSegment {
  /** index into the sources array */
  source: number
  sourceIn: number
  start: number
  duration: number
  transitionOut: Transition | null
}

export interface ReelPlan {
  segments: ReelSegment[]
  duration: number
}

/** pieces shorter than this read as glitches, not cuts (s) */
const MIN_PIECE = 0.3

interface Piece {
  source: number
  sourceIn: number
  frames: number
  transitionOut: Transition | null
}

/**
 * Lay the kept ranges of every source back to back, fit them into
 * `maxDuration`, and put a transition at each change of source.
 *
 * Everything is counted in whole frames so the clips land on the frame grid
 * and stay exactly adjacent, which transitions require (A.end == B.start).
 */
export function planReel(sources: ReelSource[], options: Partial<ReelOptions> = {}): ReelPlan {
  const opts = { ...DEFAULT_REEL_OPTIONS, ...options }
  const { fps } = opts
  const kept = sources.map(usableRanges)

  // fit to length: every source shrinks by the same ratio and keeps its
  // opening, so a long Reel stays a sampler of all of its videos
  const total = kept.reduce((sum, ranges) => sum + totalLength(ranges), 0)
  const ratio = total > opts.maxDuration ? opts.maxDuration / total : 1

  const pieces: Piece[] = []
  kept.forEach((ranges, source) => {
    let budget = totalLength(ranges) * ratio
    for (const r of ranges) {
      const len = Math.min(r.end - r.start, budget)
      if (len < MIN_PIECE) break
      // floor keeps the sum of pieces within maxDuration
      pieces.push({ source, sourceIn: r.start, frames: Math.floor(len * fps), transitionOut: null })
      budget -= len
    }
  })

  if (opts.transition) {
    addTransitions(pieces, sources, { type: opts.transition, duration: opts.transitionDuration }, fps)
  }

  let frame = 0
  const segments = pieces.map((p): ReelSegment => {
    const segment = {
      source: p.source,
      sourceIn: p.sourceIn,
      start: frame / fps,
      duration: p.frames / fps,
      transitionOut: p.transitionOut,
    }
    frame += p.frames
    return segment
  })
  return { segments, duration: frame / fps }
}

/** Ranges clamped to the media, falling back to the whole clip. */
function usableRanges({ asset, ranges }: ReelSource): Range[] {
  const end = asset.duration ?? 0
  const clamped = ranges
    .map((r) => ({ start: Math.max(0, r.start), end: Math.min(end, r.end) }))
    .filter((r) => r.end - r.start >= MIN_PIECE)
  return clamped.length ? clamped : end > 0 ? [{ start: 0, end }] : []
}

/**
 * Transitions only where the source changes: jump cuts inside one talking
 * clip stay hard cuts, the Reel idiom. The window is centered on the cut and
 * draws d/2 of source beyond each side's trim, so make that headroom by
 * shortening A's tail or starting B a little later — or skip the transition
 * when a side is too short to give it up.
 */
function addTransitions(
  pieces: Piece[],
  sources: ReelSource[],
  transition: Transition,
  fps: number,
) {
  const d = transition.duration
  const half = d / 2
  const minFrames = Math.ceil(2 * d * fps)

  for (let i = 0; i + 1 < pieces.length; i++) {
    const a = pieces[i]
    const b = pieces[i + 1]
    if (a.source === b.source) continue

    const aDuration = sources[a.source].asset.duration ?? 0
    const aOverrun = a.sourceIn + a.frames / fps + half - aDuration
    const aTrim = Math.max(0, Math.ceil(aOverrun * fps - 1e-9))
    const bShift = Math.max(0, Math.ceil((half - b.sourceIn) * fps - 1e-9))
    if (a.frames - aTrim < minFrames || b.frames - bShift < minFrames) continue

    a.frames -= aTrim
    b.sourceIn += bShift / fps
    b.frames -= bShift
    a.transitionOut = { ...transition }
  }
}
