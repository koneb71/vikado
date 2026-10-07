import { describe, expect, it } from 'vitest'
import type { Asset } from '@/schema/project'
import { planReel, type ReelPlan, type ReelSource } from '@/reel/plan'

function source(id: string, duration: number, ranges = [{ start: 0, end: duration }]): ReelSource {
  const asset: Asset = {
    id,
    kind: 'video',
    name: `${id}.mp4`,
    hash: id,
    duration,
    width: 1080,
    height: 1920,
    fps: 30,
    hasAudio: true,
    mimeType: 'video/mp4',
  }
  return { asset, ranges, framing: 'fill', captions: false }
}

const onGrid = (t: number) => Math.abs(t * 30 - Math.round(t * 30)) < 1e-6

function expectContiguous(plan: ReelPlan) {
  plan.segments.forEach((seg, i) => {
    expect(onGrid(seg.start) && onGrid(seg.duration)).toBe(true)
    const next = plan.segments[i + 1]
    if (next) expect(Math.abs(seg.start + seg.duration - next.start)).toBeLessThan(1e-6)
  })
}

/** every transition has d/2 of source beyond both sides of the cut */
function expectHeadroom(plan: ReelPlan, sources: ReelSource[]) {
  plan.segments.forEach((a, i) => {
    if (!a.transitionOut) return
    const b = plan.segments[i + 1]
    const half = a.transitionOut.duration / 2
    expect(a.sourceIn + a.duration + half).toBeLessThanOrEqual(sources[a.source].asset.duration! + 1e-9)
    expect(b.sourceIn).toBeGreaterThanOrEqual(half - 1e-9)
  })
}

describe('planReel', () => {
  it('lays kept ranges back to back, hard cuts within a source', () => {
    const sources = [source('a', 10, [{ start: 1, end: 3 }, { start: 5, end: 9 }])]
    const plan = planReel(sources)
    expect(plan.segments.map((s) => [s.sourceIn, s.start, s.duration])).toEqual([
      [1, 0, 2],
      [5, 2, 4],
    ])
    expect(plan.segments.every((s) => s.transitionOut === null)).toBe(true)
    expect(plan.duration).toBe(6)
  })

  it('fits to the length limit, sampling every source from its opening', () => {
    const sources = [source('a', 60), source('b', 30), source('c', 90)]
    const plan = planReel(sources, { maxDuration: 30, transition: null })
    expect(plan.duration).toBeLessThanOrEqual(30)
    expect(plan.duration).toBeGreaterThan(29.9)
    const bySource = [0, 1, 2].map((i) =>
      plan.segments.filter((s) => s.source === i).reduce((n, s) => n + s.duration, 0),
    )
    expect(bySource[0]).toBeCloseTo(10, 1)
    expect(bySource[1]).toBeCloseTo(5, 1)
    expect(bySource[2]).toBeCloseTo(15, 1)
    expect(plan.segments.every((s) => s.sourceIn === 0)).toBe(true)
    expectContiguous(plan)
  })

  it('makes headroom for transitions between sources', () => {
    // a plays to its very end, b starts at 0: neither side has headroom
    const sources = [source('a', 5), source('b', 5)]
    const plan = planReel(sources, { transition: 'crossfade', transitionDuration: 0.4 })
    const [a, b] = plan.segments
    expect(a.transitionOut).toEqual({ type: 'crossfade', duration: 0.4 })
    expect(a.duration).toBeCloseTo(4.8)
    expect(b.sourceIn).toBeCloseTo(0.2)
    expect(b.duration).toBeCloseTo(4.8)
    expectContiguous(plan)
    expectHeadroom(plan, sources)
  })

  it('takes nothing from sides that already have headroom', () => {
    const sources = [source('a', 10, [{ start: 0, end: 5 }]), source('b', 10, [{ start: 2, end: 6 }])]
    const plan = planReel(sources)
    expect(plan.segments.map((s) => s.duration)).toEqual([5, 4])
    expect(plan.segments[1].sourceIn).toBe(2)
    expectHeadroom(plan, sources)
  })

  it('skips the transition when a side is too short to give up headroom', () => {
    const sources = [source('a', 0.5), source('b', 5)]
    const plan = planReel(sources)
    expect(plan.segments[0].transitionOut).toBeNull()
    expect(plan.segments[1].sourceIn).toBe(0)
  })

  it('stays valid with transitions after fitting to length', () => {
    const sources = [source('a', 50), source('b', 70, [{ start: 0, end: 30 }, { start: 35, end: 70 }]), source('c', 40)]
    const plan = planReel(sources, { maxDuration: 60 })
    expect(plan.duration).toBeLessThanOrEqual(60)
    expect(plan.segments.filter((s) => s.transitionOut)).toHaveLength(2)
    expectContiguous(plan)
    expectHeadroom(plan, sources)
  })

  it('falls back to the whole clip when no range survives', () => {
    const plan = planReel([source('a', 4, [{ start: 1, end: 1.1 }])])
    expect(plan.segments).toEqual([
      { source: 0, sourceIn: 0, start: 0, duration: 4, transitionOut: null },
    ])
  })
})
