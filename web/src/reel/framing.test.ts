import { describe, expect, it } from 'vitest'
import { defaultFraming, frameForReel, matchesCanvas } from '@/reel/framing'

const dims = (width: number, height: number) => ({ width, height })

describe('framing', () => {
  it('leaves 9:16 footage alone', () => {
    expect(matchesCanvas(dims(1080, 1920))).toBe(true)
    expect(matchesCanvas(dims(720, 1280))).toBe(true)
    expect(frameForReel(dims(1080, 1920), 'fill')).toEqual({ crop: null, backgroundBlur: false })
    expect(frameForReel(dims(1080, 1920), 'blur')).toEqual({ crop: null, backgroundBlur: false })
  })

  it('crops landscape to a centered 9:16 slice', () => {
    const { crop, backgroundBlur } = frameForReel(dims(1920, 1080), 'fill')
    expect(backgroundBlur).toBe(false)
    // cropped region: 0.3164 × 1920 = 607.5 px wide, 1080 tall → 9:16
    expect(crop!.w).toBeCloseTo((9 / 16) / (16 / 9))
    expect(crop!.h).toBe(1)
    expect(crop!.x + crop!.w / 2).toBeCloseTo(0.5)
    expect((crop!.w * 1920) / (crop!.h * 1080)).toBeCloseTo(9 / 16)
  })

  it('crops portrait taller than 9:16 top and bottom', () => {
    const { crop } = frameForReel(dims(1080, 2400), 'fill') // 9:20
    expect(crop!.w).toBe(1)
    expect((crop!.w * 1080) / (crop!.h * 2400)).toBeCloseTo(9 / 16)
    expect(crop!.y + crop!.h / 2).toBeCloseTo(0.5)
  })

  it('blur keeps the whole frame over a blurred backdrop', () => {
    expect(frameForReel(dims(1920, 1080), 'blur')).toEqual({ crop: null, backgroundBlur: true })
  })

  it('defaults: portrait fills, square and landscape blur', () => {
    expect(defaultFraming(dims(1080, 1920))).toBe('fill')
    expect(defaultFraming(dims(1440, 1920))).toBe('fill') // 3:4
    expect(defaultFraming(dims(1080, 1080))).toBe('blur')
    expect(defaultFraming(dims(1920, 1080))).toBe('blur')
  })
})
