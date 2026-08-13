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

export const FILTER_MATRICES: Record<FilterPreset, number[]> = {
  grayscale: GRAYSCALE,
  sepia: SEPIA,
  invert: INVERT,
  vintage: VINTAGE,
  cool: COOL,
  warm: WARM,
}

export function filterMatrix(preset: FilterPreset | null): number[] {
  return preset ? FILTER_MATRICES[preset] : IDENTITY_MATRIX
}
