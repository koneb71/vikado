import { describe, expect, it } from 'vitest'
import { outputSize } from '@/export/localExport'
import { createProject, type Project } from '@/schema/project'

/**
 * outputSize mirrors RenderOptions::output_size in crates/vikado-types. Both
 * exports must agree on dimensions or the same project renders at different
 * sizes depending on which engine the user picked, so the cases below are the
 * ones where rounding could diverge.
 */

function project(width: number, height: number): Project {
  const p = createProject()
  p.width = width
  p.height = height
  return p
}

const high = (scale: number) => ({ quality: 'high' as const, scale })

describe('outputSize', () => {
  it('passes the canvas through at full scale', () => {
    expect(outputSize(project(1920, 1080), high(1))).toEqual([1920, 1080])
    expect(outputSize(project(1080, 1920), high(1))).toEqual([1080, 1920])
  })

  it('halves and three-quarters cleanly', () => {
    expect(outputSize(project(1920, 1080), high(0.5))).toEqual([960, 540])
    expect(outputSize(project(1920, 1080), high(0.75))).toEqual([1440, 810])
  })

  it('always returns even dimensions, which the encoder requires', () => {
    // 1080 * 0.75 = 810 (even); 1918 * 0.75 = 1438.5 -> rounds to an even number
    for (const [w, h] of [
      [1918, 1080],
      [1280, 722],
      [1001, 999],
    ]) {
      for (const scale of [1, 0.75, 0.5, 0.25]) {
        const [ow, oh] = outputSize(project(w, h), high(scale))
        expect(ow % 2).toBe(0)
        expect(oh % 2).toBe(0)
      }
    }
  })

  it('clamps the scale to the range the schema allows', () => {
    expect(outputSize(project(1920, 1080), high(4))).toEqual([1920, 1080])
    expect(outputSize(project(1920, 1080), high(0))).toEqual([480, 270])
  })

  it('never collapses a dimension to zero', () => {
    const [w, h] = outputSize(project(4, 2), high(0.25))
    expect(w).toBeGreaterThanOrEqual(2)
    expect(h).toBeGreaterThanOrEqual(2)
  })
})
