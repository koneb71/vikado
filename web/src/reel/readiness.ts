import { REEL_MAX_DURATION } from '@/reel/framing'

export interface ReelCheck {
  label: string
  ok: boolean
}

/** Facebook takes Reels from 3 s long, 540×960 up, at 24–60 fps. */
const MIN_DURATION = 3
const MIN_WIDTH = 540
const MIN_FPS = 24
const MAX_FPS = 60

/**
 * Facebook Reel requirements for an export of `width`×`height` (the output
 * size, after any export scaling). Null when the video isn't vertical at all,
 * i.e. clearly not meant as a Reel.
 */
export function reelReadiness(
  width: number,
  height: number,
  duration: number,
  fps: number,
): ReelCheck[] | null {
  if (height <= width) return null
  return [
    { label: '9:16 vertical', ok: Math.abs((width / height) / (9 / 16) - 1) <= 0.01 },
    { label: `${MIN_WIDTH}×960 or larger`, ok: width >= MIN_WIDTH },
    {
      label: `${MIN_DURATION}–${REEL_MAX_DURATION} s long`,
      ok: duration >= MIN_DURATION && duration <= REEL_MAX_DURATION,
    },
    { label: `${MIN_FPS}–${MAX_FPS} fps`, ok: fps >= MIN_FPS && fps <= MAX_FPS },
  ]
}

/** A download name from the project name: "My Reel!" → "my-reel.mp4". */
export function exportFileName(projectName: string): string {
  const slug = projectName
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${slug || 'vikado-export'}.mp4`
}
