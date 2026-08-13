/**
 * Compile-time drift check between the hand-written schema
 * (web/src/schema/project.ts, source of the zod validators) and the types
 * generated from the Rust `vikado-types` crate by ts-rs.
 *
 * If `pnpm build` fails here, the Rust and TypeScript schemas diverged —
 * fix whichever side changed, then re-export with:
 *   TS_RS_EXPORT_DIR=../../web/src/generated cargo test -p vikado-types export
 */
import type * as Hand from '@/schema/project'
import type { Project as GenProject } from './Project'
import type { Clip as GenClip } from './Clip'
import type { Asset as GenAsset } from './Asset'
import type { Track as GenTrack } from './Track'
import type { TextStyle as GenTextStyle } from './TextStyle'
import type { Transition as GenTransition } from './Transition'
import type { SubtitleTrack as GenSubtitleTrack } from './SubtitleTrack'

/**
 * Every hand-written value must be a valid value of the generated (Rust)
 * type. The reverse direction is intentionally NOT checked: the TS side
 * narrows some fields to literals (schemaVersion: 1, fontWeight: 400 | 700)
 * that Rust models as plain numbers.
 */
type Assignable<A, B> = A extends B ? true : never

const _project: Assignable<Hand.Project, GenProject> = true
const _clip: Assignable<Hand.Clip, GenClip> = true
const _asset: Assignable<Hand.Asset, GenAsset> = true
const _track: Assignable<Hand.Track, GenTrack> = true
const _textStyle: Assignable<Hand.TextStyle, GenTextStyle> = true
const _transition: Assignable<Hand.Transition, GenTransition> = true
const _subtitles: Assignable<Hand.SubtitleTrack, GenSubtitleTrack> = true

export const DRIFT_CHECKED = [
  _project,
  _clip,
  _asset,
  _track,
  _textStyle,
  _transition,
  _subtitles,
] as const
