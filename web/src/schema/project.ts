import { z } from 'zod'
import { nanoid } from 'nanoid'

/**
 * The Vikado project schema — THE contract between the browser editor and the
 * Rust renderer. All times are seconds (f64); the UI snaps to frame boundaries
 * using `project.fps`, the renderer rounds to frames at render time.
 *
 * Positions/sizes are in canvas pixels at (project.width × project.height).
 * The Rust `vikado-types` crate mirrors these shapes with serde; fixture
 * projects in /fixtures are validated against both sides in CI.
 */

export const SCHEMA_VERSION = 1

export const zTransform = z.object({
  x: z.number(), // center offset from canvas center, canvas px
  y: z.number(),
  scale: z.number().positive(), // 1 = "fit" inside canvas
  rotation: z.number(), // degrees, clockwise
  opacity: z.number().min(0).max(1),
})
export type Transform = z.infer<typeof zTransform>

export const zColorAdjustments = z.object({
  // all default 0, range -1..1
  brightness: z.number().min(-1).max(1),
  contrast: z.number().min(-1).max(1),
  saturation: z.number().min(-1).max(1),
  temperature: z.number().min(-1).max(1),
})
export type ColorAdjustments = z.infer<typeof zColorAdjustments>

export const FILTER_PRESETS = ['grayscale', 'sepia', 'vintage', 'cool', 'warm', 'invert'] as const
export const zFilterPreset = z.enum(FILTER_PRESETS)
export type FilterPreset = z.infer<typeof zFilterPreset>

export const TRANSITION_TYPES = [
  'crossfade',
  'fade-black',
  'wipe-left',
  'wipe-right',
  'slide-left',
  'slide-right',
] as const
export const zTransition = z.object({
  type: z.enum(TRANSITION_TYPES),
  duration: z.number().positive(), // seconds consumed across the cut into the next clip
})
export type Transition = z.infer<typeof zTransition>

export const EASINGS = ['linear', 'ease-in', 'ease-out', 'ease-in-out'] as const
export const zEasing = z.enum(EASINGS)
export type Easing = z.infer<typeof zEasing>

export const zKeyframe = z.object({
  /** clip-local time (s from clip start) — survives moving the clip */
  t: z.number().min(0),
  value: z.number(),
  /** easing INTO the next keyframe */
  easing: zEasing.default('linear'),
})
export type Keyframe = z.infer<typeof zKeyframe>

/**
 * Per-property keyframe tracks for Transform fields. A property with one or
 * more keyframes ignores the static transform value; between keyframes the
 * value interpolates, outside the range it clamps to the nearest keyframe.
 */
export const zKeyframes = z.object({
  x: z.array(zKeyframe).default([]),
  y: z.array(zKeyframe).default([]),
  scale: z.array(zKeyframe).default([]),
  rotation: z.array(zKeyframe).default([]),
  opacity: z.array(zKeyframe).default([]),
})
export type Keyframes = z.infer<typeof zKeyframes>
export type KeyframeProp = keyof Keyframes

export function emptyKeyframes(): Keyframes {
  return { x: [], y: [], scale: [], rotation: [], opacity: [] }
}

const zKeyframesDefault = zKeyframes.default(emptyKeyframes)

/**
 * Green-screen removal on decoded RGB. `similarity` is the normalized RGB
 * distance from `color` below which a pixel keys out (|rgb - key| / sqrt(3));
 * `blend` widens the ramp above it. Semantics mirror ffmpeg's `colorkey`
 * filter — NOT yuv `chromakey`, whose limited-range plane comparison the
 * browser can't reproduce. See the CHROMA KEY CONTRACT comments in
 * web/src/engine/compositor/shaders.ts and
 * crates/vikado-renderer/src/filtergraph.rs.
 */
export const zChromaKey = z.object({
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  similarity: z.number().min(0.01).max(1),
  blend: z.number().min(0).max(1),
})
export type ChromaKey = z.infer<typeof zChromaKey>

export const DEFAULT_CHROMA_KEY: ChromaKey = { color: '#00d000', similarity: 0.3, blend: 0.1 }

/** Source crop rect, normalized 0..1 relative to the media frame. */
export const zCrop = z.object({
  x: z.number().min(0).max(0.95),
  y: z.number().min(0).max(0.95),
  w: z.number().min(0.05).max(1),
  h: z.number().min(0.05).max(1),
})
export type Crop = z.infer<typeof zCrop>

export const zTextStyle = z.object({
  fontFamily: z.string(), // must be one of the bundled fonts (see fonts/)
  fontSize: z.number().positive(), // px at canvas resolution
  fontWeight: z.union([z.literal(400), z.literal(700)]),
  italic: z.boolean(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
  outlineColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
  outlineWidth: z.number().min(0),
  align: z.enum(['left', 'center', 'right']),
})
export type TextStyle = z.infer<typeof zTextStyle>

export const zAsset = z.object({
  id: z.string(),
  kind: z.enum(['video', 'audio', 'image']),
  name: z.string(), // original filename, display only
  hash: z.string(), // sha-256 hex of file bytes; OPFS filename & upload key
  duration: z.number().nullable(), // null for images
  width: z.number().nullable(),
  height: z.number().nullable(),
  fps: z.number().nullable(),
  hasAudio: z.boolean(),
  mimeType: z.string(),
})
export type Asset = z.infer<typeof zAsset>

const zClipBase = z.object({
  id: z.string(),
  start: z.number().min(0), // position on timeline (s)
  duration: z.number().positive(), // length on timeline (s)
})

/** Playback-rate bounds shared by the inspector and validation. */
export const MIN_SPEED = 0.25
export const MAX_SPEED = 4

export const zVideoClip = zClipBase.extend({
  type: z.literal('video'),
  assetId: z.string(),
  sourceIn: z.number().min(0), // trim offset into source (s)
  // playback rate; source consumed = duration × speed (defaulted for pre-speed projects)
  speed: z.number().min(MIN_SPEED).max(MAX_SPEED).default(1),
  volume: z.number().min(0).max(2),
  muted: z.boolean(),
  flipH: z.boolean().default(false),
  flipV: z.boolean().default(false),
  chromaKey: zChromaKey.nullable().default(null),
  backgroundBlur: z.boolean().default(false),
  crop: zCrop.nullable().default(null),
  transform: zTransform,
  keyframes: zKeyframesDefault,
  adjustments: zColorAdjustments,
  filter: zFilterPreset.nullable(),
  fadeIn: z.number().min(0), // s, opacity + audio fade
  fadeOut: z.number().min(0),
  transitionOut: zTransition.nullable(), // into the NEXT clip on this track
})
export type VideoClip = z.infer<typeof zVideoClip>

export const zImageClip = zClipBase.extend({
  type: z.literal('image'),
  assetId: z.string(),
  flipH: z.boolean().default(false),
  flipV: z.boolean().default(false),
  chromaKey: zChromaKey.nullable().default(null),
  backgroundBlur: z.boolean().default(false),
  crop: zCrop.nullable().default(null),
  transform: zTransform,
  keyframes: zKeyframesDefault,
  adjustments: zColorAdjustments,
  filter: zFilterPreset.nullable(),
  fadeIn: z.number().min(0),
  fadeOut: z.number().min(0),
  transitionOut: zTransition.nullable(),
})
export type ImageClip = z.infer<typeof zImageClip>

export const zAudioClip = zClipBase.extend({
  type: z.literal('audio'),
  assetId: z.string(),
  sourceIn: z.number().min(0),
  speed: z.number().min(MIN_SPEED).max(MAX_SPEED).default(1),
  volume: z.number().min(0).max(2),
  fadeIn: z.number().min(0),
  fadeOut: z.number().min(0),
})
export type AudioClip = z.infer<typeof zAudioClip>

export const zTextClip = zClipBase.extend({
  type: z.literal('text'),
  text: z.string(), // may contain explicit \n line breaks (preview decides wrapping)
  style: zTextStyle,
  transform: zTransform,
  keyframes: zKeyframesDefault,
  // rendered block size in canvas px, kept up to date by the editor whenever
  // text/style change; the ASS emitter uses it to anchor left/right alignment.
  // 0 = unknown (renderer falls back to centered).
  measuredWidth: z.number().default(0),
  measuredHeight: z.number().default(0),
  fadeIn: z.number().min(0),
  fadeOut: z.number().min(0),
})
export type TextClip = z.infer<typeof zTextClip>

export const zClip = z.discriminatedUnion('type', [zVideoClip, zImageClip, zAudioClip, zTextClip])
export type Clip = z.infer<typeof zClip>

export const zTrack = z.object({
  id: z.string(),
  kind: z.enum(['video', 'audio', 'text']), // 'video' tracks accept video + image clips
  name: z.string(),
  muted: z.boolean(),
  hidden: z.boolean(), // video/text only
  clips: z.array(zClip), // non-overlapping, sorted by start
})
export type Track = z.infer<typeof zTrack>

export const zSubtitleCue = z.object({
  id: z.string(),
  start: z.number().min(0),
  end: z.number().min(0),
  text: z.string(),
})
export type SubtitleCue = z.infer<typeof zSubtitleCue>

export const zSubtitleTrack = z.object({
  id: z.string(),
  style: zTextStyle, // one shared style for all cues
  cues: z.array(zSubtitleCue),
})
export type SubtitleTrack = z.infer<typeof zSubtitleTrack>

export const zProject = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string(),
  name: z.string(),
  fps: z.number().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  canvasBackground: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#000000'),
  tracks: z.array(zTrack), // index 0 = bottom layer
  assets: z.array(zAsset),
  subtitles: zSubtitleTrack.nullable(),
  createdAt: z.string(), // ISO
  updatedAt: z.string(),
})
export type Project = z.infer<typeof zProject>

// ---------------------------------------------------------------------------
// Defaults & factories

export const DEFAULT_TRANSFORM: Transform = { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 }

export const DEFAULT_ADJUSTMENTS: ColorAdjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
}

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: 'Inter',
  fontSize: 72,
  fontWeight: 700,
  italic: false,
  color: '#ffffff',
  backgroundColor: null,
  outlineColor: '#000000',
  outlineWidth: 2,
  align: 'center',
}

export const DEFAULT_SUBTITLE_STYLE: TextStyle = {
  ...DEFAULT_TEXT_STYLE,
  fontSize: 48,
  fontWeight: 400,
}

export function createProject(name = 'Untitled project'): Project {
  const now = new Date().toISOString()
  return {
    schemaVersion: SCHEMA_VERSION,
    id: nanoid(),
    name,
    fps: 30,
    width: 1920,
    height: 1080,
    canvasBackground: '#000000',
    tracks: [
      { id: nanoid(), kind: 'video', name: 'Track 1', muted: false, hidden: false, clips: [] },
    ],
    assets: [],
    subtitles: null,
    createdAt: now,
    updatedAt: now,
  }
}

// ---------------------------------------------------------------------------
// Pure helpers shared across the app (and mirrored conceptually in Rust)

export function clipEnd(clip: Clip): number {
  return clip.start + clip.duration
}

export function projectDuration(project: Project): number {
  let end = 0
  for (const track of project.tracks) {
    for (const clip of track.clips) end = Math.max(end, clipEnd(clip))
  }
  if (project.subtitles) {
    for (const cue of project.subtitles.cues) end = Math.max(end, cue.end)
  }
  return end
}

/** Snap a time to the project's frame grid. */
export function snapToFrame(t: number, fps: number): number {
  return Math.round(t * fps) / fps
}

export function trackAcceptsClip(track: Track, clipType: Clip['type']): boolean {
  switch (track.kind) {
    case 'video':
      return clipType === 'video' || clipType === 'image'
    case 'audio':
      return clipType === 'audio'
    case 'text':
      return clipType === 'text'
  }
}
