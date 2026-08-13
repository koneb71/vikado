import type { FilterPreset } from '@/schema/project'

/**
 * Filter presets, defined ONCE as a 4x4 color matrix (row-major here,
 * transposed on GL upload) applied before the per-clip adjustments.
 * The Rust renderer maps each preset to the equivalent ffmpeg filter chain —
 * keep schema/filters.md notes in sync when editing.
 */

// prettier-ignore
export const IDENTITY_MATRIX: number[] = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
]

// prettier-ignore
const GRAYSCALE: number[] = [
  0.299, 0.587, 0.114, 0,
  0.299, 0.587, 0.114, 0,
  0.299, 0.587, 0.114, 0,
  0,     0,     0,     1,
]

// prettier-ignore
const SEPIA: number[] = [
  0.393, 0.769, 0.189, 0,
  0.349, 0.686, 0.168, 0,
  0.272, 0.534, 0.131, 0,
  0,     0,     0,     1,
]

// prettier-ignore
const INVERT: number[] = [
  -1, 0, 0, 1,
  0, -1, 0, 1,
  0, 0, -1, 1,
  0, 0, 0,  1,
]

// vintage: faded sepia-ish with lifted blacks
// prettier-ignore
const VINTAGE: number[] = [
  0.5,  0.35, 0.1,  0.06,
  0.3,  0.55, 0.1,  0.05,
  0.2,  0.25, 0.4,  0.08,
  0,    0,    0,    1,
]

// cool / warm: gentle channel rebalance
// prettier-ignore
const COOL: number[] = [
  0.92, 0,    0,    0,
  0,    1.0,  0,    0.02,
  0,    0,    1.08, 0.03,
  0,    0,    0,    1,
]

// prettier-ignore
const WARM: number[] = [
  1.08, 0,    0,    0.03,
  0,    1.0,  0,    0.02,
  0,    0,    0.92, 0,
  0,    0,    0,    1,
]

// noir: grayscale with contrast 1.5 around mid grey — out = 1.5*(luma-0.5)+0.5
// prettier-ignore
const NOIR: number[] = [
  0.4485, 0.8805, 0.171, -0.25,
  0.4485, 0.8805, 0.171, -0.25,
  0.4485, 0.8805, 0.171, -0.25,
  0,      0,      0,      1,
]

// vivid: saturation x1.4 about the BT.601 luma axis
// prettier-ignore
const VIVID: number[] = [
   1.2804, -0.2348, -0.0456, 0,
  -0.1196,  1.1652, -0.0456, 0,
  -0.1196, -0.2348,  1.3544, 0,
   0,       0,       0,      1,
]

// faded: desaturated (0.85), low contrast (0.82) with lifted, cool blacks
// prettier-ignore
const FADED: number[] = [
  0.7338, 0.0722, 0.014, 0.1,
  0.0368, 0.7692, 0.014, 0.1,
  0.0368, 0.0722, 0.711, 0.12,
  0,      0,      0,     1,
]

// cyberpunk: teal-lifted shadows against hot reds
// prettier-ignore
const CYBERPUNK: number[] = [
   1.15, 0,    -0.05, 0,
  -0.05, 0.95,  0.1,   0,
   0.1,  0.05,  1.2,   0.05,
   0,    0,     0,     1,
]

// sunset: warm highlights, gently crushed blues
// prettier-ignore
const SUNSET: number[] = [
  1.18, 0.06, 0,    0.04,
  0.02, 0.98, 0.02, 0,
  0,    0.04, 0.88, 0.03,
  0,    0,    0,    1,
]

// mint: cool green-cyan wash
// prettier-ignore
const MINT: number[] = [
  0.88, 0.02, 0,    0,
  0,    1.06, 0.04, 0.02,
  0,    0.06, 1.02, 0.03,
  0,    0,    0,    1,
]

export const FILTER_MATRICES: Record<FilterPreset, number[]> = {
  grayscale: GRAYSCALE,
  sepia: SEPIA,
  invert: INVERT,
  vintage: VINTAGE,
  cool: COOL,
  warm: WARM,
  noir: NOIR,
  vivid: VIVID,
  faded: FADED,
  cyberpunk: CYBERPUNK,
  sunset: SUNSET,
  mint: MINT,
}

export function filterMatrix(preset: FilterPreset | null): number[] {
  return preset ? FILTER_MATRICES[preset] : IDENTITY_MATRIX
}
