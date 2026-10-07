import { describe, expect, it } from 'vitest'
import { exportFileName, reelReadiness } from '@/reel/readiness'

describe('reelReadiness', () => {
  it('passes a 1080×1920, 30 fps, 45 s video', () => {
    expect(reelReadiness(1080, 1920, 45, 30)!.every((c) => c.ok)).toBe(true)
  })

  it('flags what fails', () => {
    const failed = (checks: ReturnType<typeof reelReadiness>) =>
      checks!.filter((c) => !c.ok).map((c) => c.label)
    expect(failed(reelReadiness(1080, 1920, 120, 30))).toEqual(['3–90 s long'])
    expect(failed(reelReadiness(1080, 1350, 30, 30))).toEqual(['9:16 vertical'])
    expect(failed(reelReadiness(270, 480, 30, 60))).toEqual(['540×960 or larger'])
  })

  it('stays out of the way for landscape projects', () => {
    expect(reelReadiness(1920, 1080, 30, 30)).toBeNull()
  })
})

describe('exportFileName', () => {
  it('slugs the project name', () => {
    expect(exportFileName('My Reel!')).toBe('my-reel.mp4')
    expect(exportFileName('Café — été 2026')).toBe('cafe-ete-2026.mp4')
    expect(exportFileName('   ')).toBe('vikado-export.mp4')
  })
})
