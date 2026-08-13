import { create } from 'zustand'
import { temporal } from 'zundo'
import { immer } from 'zustand/middleware/immer'
import {
  clipEnd,
  createProject,
  emptyKeyframes,
  snapToFrame,
  trackAcceptsClip,
  zProject,
  DEFAULT_SUBTITLE_STYLE,
  type Asset,
  type Clip,
  type Project,
  type KeyframeProp,
  type SubtitleCue,
  type SubtitleTrack,
  type TextClip,
  type Track,
} from '@/schema/project'
import * as ops from '@/lib/timelineOps'
import * as db from '@/media/db'
import * as clipboard from '@/lib/clipboard'
import { removeKeyframeAt, sampleTrack, sampleTransform, upsertKeyframe } from '@/lib/keyframes'
import { usePlaybackStore } from '@/state/playbackStore'
import { renderText } from '@/engine/TextRenderer'
import { generateThumbnails } from '@/media/thumbnails'
import { generateWaveform } from '@/media/waveforms'
import { nanoid } from 'nanoid'

interface ProjectState {
  project: Project | null

  // lifecycle
  openProject: (project: Project) => void
  closeProject: () => void
  renameProject: (name: string) => void
  updateSettings: (
    patch: Partial<Pick<Project, 'fps' | 'width' | 'height' | 'canvasBackground'>>,
  ) => void

  // assets
  addAsset: (asset: Asset) => void
  removeAsset: (assetId: string) => void

  // tracks
  addTrack: (kind: Track['kind']) => string
  removeTrack: (trackId: string) => void
  setTrackMuted: (trackId: string, muted: boolean) => void
  setTrackHidden: (trackId: string, hidden: boolean) => void

  // clips
  addClip: (trackId: string, clip: Clip) => void
  deleteClips: (clipIds: string[]) => void
  moveClip: (clipId: string, start: number, toTrackId?: string) => void
  trimClipLeft: (clipId: string, newStart: number) => void
  trimClipRight: (clipId: string, newEnd: number) => void
  /** split a video clip's sound onto an audio track; mutes the video clip */
  detachAudio: (clipId: string) => string | null
  /** ripple-insert a captured still at `at`, pushing later clips right */
  insertFreezeFrame: (clipId: string, at: number, imageAsset: Asset, duration: number) => string | null
  /** upsert a keyframe at clip-local time t (clamped to the clip) */
  setKeyframe: (clipId: string, prop: KeyframeProp, t: number, value: number) => void
  removeKeyframe: (clipId: string, prop: KeyframeProp, t: number) => void
  clearKeyframes: (clipId: string, prop: KeyframeProp) => void
  /** change playback rate keeping the source range; timeline length rescales */
  setClipSpeed: (clipId: string, speed: number) => void
  /** duplicate each clip right after itself on its own track; returns new ids */
  duplicateClips: (clipIds: string[]) => string[]
  /** paste the in-app clipboard at `at`; returns new ids */
  pasteClips: (at: number) => string[]
  splitClip: (clipId: string, at: number) => string | null
  updateClip: <T extends Clip>(clipId: string, patch: Partial<T>) => void

  // subtitles
  setSubtitles: (subtitles: SubtitleTrack | null) => void
  addCue: (cue: SubtitleCue) => void
  /** batched insert — one undo step per call */
  addCues: (cues: SubtitleCue[]) => void
  updateCue: (cueId: string, patch: Partial<SubtitleCue>) => void
  deleteCue: (cueId: string) => void
  updateSubtitleStyle: (patch: Partial<SubtitleTrack['style']>) => void
}

/**
 * Refresh a text clip's measured block size (used by the ASS emitter to anchor
 * left/right alignment). Guarded for non-DOM environments (unit tests).
 */
function measureTextClip(clip: TextClip): void {
  if (typeof document === 'undefined') return
  try {
    const rendered = renderText(clip.text, clip.style)
    clip.measuredWidth = rendered.width
    clip.measuredHeight = rendered.height
  } catch {
    // measurement is best-effort; renderer falls back to centered
  }
}

/** Mutate helper: runs `fn` against the project draft and stamps updatedAt. */
function mutate(
  set: (fn: (state: ProjectState) => void) => void,
  fn: (project: Project) => void,
) {
  set((state) => {
    if (!state.project) return
    fn(state.project)
    state.project.updatedAt = new Date().toISOString()
  })
}

export const useProjectStore = create<ProjectState>()(
  temporal(
    immer((set) => ({
      project: null,

      openProject: (project) => {
        // re-parse through zod so projects saved before newer schema fields
        // existed pick up their defaults (cheap forward-migration)
        let migrated = project
        try {
          migrated = zProject.parse(project)
        } catch (err) {
          console.error('Project failed schema validation; opening as-is', err)
        }
        set({ project: migrated })
        useProjectStore.temporal.getState().clear()
        // backfill missing thumbnail/waveform caches (both no-op when cached)
        for (const asset of migrated.assets) {
          void generateThumbnails(asset).catch(() => {})
          void generateWaveform(asset).catch(() => {})
        }
      },
      closeProject: () => set({ project: null }),
      renameProject: (name) => mutate(set, (p) => void (p.name = name)),
      updateSettings: (patch) => mutate(set, (p) => Object.assign(p, patch)),

      addAsset: (asset) =>
        mutate(set, (p) => {
          if (!p.assets.some((a) => a.id === asset.id)) p.assets.push(asset)
        }),
      removeAsset: (assetId) =>
        mutate(set, (p) => {
          p.assets = p.assets.filter((a) => a.id !== assetId)
          for (const track of p.tracks) {
            track.clips = track.clips.filter((c) => !('assetId' in c) || c.assetId !== assetId)
          }
        }),

      addTrack: (kind) => {
        const id = nanoid()
        mutate(set, (p) => {
          const count = p.tracks.filter((t) => t.kind === kind).length
          const label = kind === 'video' ? 'Track' : kind === 'audio' ? 'Audio' : 'Text'
          p.tracks.push({
            id,
            kind,
            name: `${label} ${count + 1}`,
            muted: false,
            hidden: false,
            clips: [],
          })
        })
        return id
      },
      removeTrack: (trackId) =>
        mutate(set, (p) => {
          p.tracks = p.tracks.filter((t) => t.id !== trackId)
        }),
      setTrackMuted: (trackId, muted) =>
        mutate(set, (p) => {
          const t = p.tracks.find((t) => t.id === trackId)
          if (t) t.muted = muted
        }),
      setTrackHidden: (trackId, hidden) =>
        mutate(set, (p) => {
          const t = p.tracks.find((t) => t.id === trackId)
          if (t) t.hidden = hidden
        }),

      addClip: (trackId, clip) =>
        mutate(set, (p) => {
          clip.start = snapToFrame(clip.start, p.fps)
          if (clip.type === 'text') measureTextClip(clip)
          ops.addClip(p, trackId, clip)
        }),
      deleteClips: (clipIds) =>
        mutate(set, (p) => {
          for (const id of clipIds) ops.deleteClip(p, id)
        }),
      moveClip: (clipId, start, toTrackId) =>
        mutate(set, (p) => ops.moveClip(p, clipId, snapToFrame(start, p.fps), toTrackId)),
      trimClipLeft: (clipId, newStart) =>
        mutate(set, (p) => ops.trimClipLeft(p, clipId, snapToFrame(newStart, p.fps))),
      trimClipRight: (clipId, newEnd) =>
        mutate(set, (p) => ops.trimClipRight(p, clipId, snapToFrame(newEnd, p.fps))),
      detachAudio: (clipId) => {
        let newId: string | null = null
        mutate(set, (p) => {
          const loc = ops.findClip(p, clipId)
          if (!loc || loc.clip.type !== 'video') return
          const clip = loc.clip
          // a muted clip has no audible sound to detach (also makes the
          // action idempotent — detaching mutes the clip)
          if (clip.muted) return
          const asset = p.assets.find((a) => a.id === clip.assetId)
          if (!asset?.hasAudio) return
          const audio: Clip = {
            type: 'audio',
            id: nanoid(),
            start: clip.start,
            duration: clip.duration,
            assetId: clip.assetId,
            sourceIn: clip.sourceIn,
            speed: clip.speed,
            volume: clip.volume,
            fadeIn: clip.fadeIn,
            fadeOut: clip.fadeOut,
          }
          // the audio must land EXACTLY under its video — pick an audio track
          // with a free slot there, else create a new one (never relocate)
          let target = p.tracks.find(
            (t) =>
              t.kind === 'audio' &&
              ops.clampStart(t, audio.id, clip.start, clip.duration) === clip.start,
          )
          if (!target) {
            target = {
              id: nanoid(),
              kind: 'audio',
              name: `Audio ${p.tracks.filter((t) => t.kind === 'audio').length + 1}`,
              muted: false,
              hidden: false,
              clips: [],
            }
            p.tracks.push(target)
          }
          ops.addClip(p, target.id, audio)
          clip.muted = true // video keeps playing silently; the audio clip owns sound
          newId = audio.id
        })
        return newId
      },
      insertFreezeFrame: (clipId, at, imageAsset, duration) => {
        let newId: string | null = null
        mutate(set, (p) => {
          const loc = ops.findClip(p, clipId)
          if (!loc || loc.clip.type !== 'video') return
          const clip = loc.clip
          if (!p.assets.some((a) => a.id === imageAsset.id)) p.assets.push(imageAsset)
          // clamp the insert point INTO the clip; near an edge the split
          // no-ops and the still goes before/after the whole clip instead
          let t = snapToFrame(at, p.fps)
          if (t <= clip.start + ops.MIN_CLIP_DURATION) t = clip.start
          else if (t >= clipEnd(clip) - ops.MIN_CLIP_DURATION) t = clipEnd(clip)
          else ops.splitClip(p, clipId, t)
          // ripple EVERY track (and subtitle cues) so detached audio, overlays
          // and captions stay in sync with the pushed-out picture
          for (const track of p.tracks) ops.rippleShift(track, t, duration)
          if (p.subtitles) {
            for (const cue of p.subtitles.cues) {
              if (cue.start >= t - 1e-6) {
                cue.start += duration
                cue.end += duration
              }
            }
          }
          const frame: Clip = {
            type: 'image',
            id: nanoid(),
            start: t,
            duration,
            assetId: imageAsset.id,
            // carry the clip's full look so the still doesn't visibly jump
            flipH: clip.flipH,
            flipV: clip.flipV,
            chromaKey: clip.chromaKey ? { ...clip.chromaKey } : null,
            backgroundBlur: clip.backgroundBlur,
            crop: clip.crop ? { ...clip.crop } : null,
            // keyframed clips freeze at the pose the playhead showed
            transform: { ...sampleTransform(clip, Math.max(0, at - clip.start)) },
            keyframes: emptyKeyframes(),
            adjustments: { ...clip.adjustments },
            filter: clip.filter,
            fadeIn: 0,
            fadeOut: 0,
            transitionOut: null,
          }
          ops.addClip(p, loc.track.id, frame)
          newId = frame.id
        })
        return newId
      },
      setKeyframe: (clipId, prop, t, value) =>
        mutate(set, (p) => {
          const loc = ops.findClip(p, clipId)
          if (!loc || !('keyframes' in loc.clip)) return
          const clamped = Math.min(Math.max(0, t), loc.clip.duration)
          loc.clip.keyframes[prop] = upsertKeyframe(loc.clip.keyframes[prop], clamped, value)
        }),
      removeKeyframe: (clipId, prop, t) =>
        mutate(set, (p) => {
          const loc = ops.findClip(p, clipId)
          if (!loc || !('keyframes' in loc.clip)) return
          loc.clip.keyframes[prop] = removeKeyframeAt(loc.clip.keyframes[prop], t)
        }),
      clearKeyframes: (clipId, prop) =>
        mutate(set, (p) => {
          const loc = ops.findClip(p, clipId)
          if (!loc || !('keyframes' in loc.clip)) return
          // freeze the playhead value as the new static value so clearing
          // doesn't visibly jump
          const localT = usePlaybackStore.getState().currentTime - loc.clip.start
          const frozen = sampleTrack(
            loc.clip.keyframes[prop],
            localT,
            loc.clip.transform[prop],
          )
          loc.clip.keyframes[prop] = []
          loc.clip.transform[prop] = frozen
        }),
      setClipSpeed: (clipId, speed) =>
        mutate(set, (p) => {
          const loc = ops.findClip(p, clipId)
          if (!loc || !('speed' in loc.clip)) return
          const clip = loc.clip
          // keep the same source range: timeline length rescales with rate
          const sourceSpan = clip.duration * clip.speed
          let duration = sourceSpan / speed
          const next = loc.track.clips
            .filter((c) => c.id !== clipId && c.start >= clipEnd(clip) - 1e-9)
            .reduce<number>((min, c) => Math.min(min, c.start), Infinity)
          duration = Math.min(duration, next - clip.start)
          clip.speed = speed
          clip.duration = Math.max(ops.MIN_CLIP_DURATION, duration)
        }),
      duplicateClips: (clipIds) => {
        const newIds: string[] = []
        mutate(set, (p) => {
          for (const id of clipIds) {
            const loc = ops.findClip(p, id)
            if (!loc) continue
            const copy = JSON.parse(JSON.stringify(loc.clip)) as Clip
            copy.id = nanoid()
            copy.start = clipEnd(loc.clip) // right after the source; addClip clamps
            if ('transitionOut' in copy) copy.transitionOut = null
            ops.addClip(p, loc.track.id, copy)
            newIds.push(copy.id)
          }
        })
        return newIds
      },
      pasteClips: (at) => {
        const entries = clipboard.clipsForPaste(at)
        const newIds: string[] = []
        mutate(set, (p) => {
          for (const { clip, trackId } of entries) {
            clip.start = snapToFrame(clip.start, p.fps)
            // prefer the original track; fall back to the first compatible one
            let target = p.tracks.find((t) => t.id === trackId)
            if (!target || !trackAcceptsClip(target, clip.type)) {
              target = p.tracks.find((t) => trackAcceptsClip(t, clip.type))
            }
            if (!target) continue
            ops.addClip(p, target.id, clip)
            newIds.push(clip.id)
          }
        })
        return newIds
      },
      splitClip: (clipId, at) => {
        let newId: string | null = null
        mutate(set, (p) => {
          newId = ops.splitClip(p, clipId, snapToFrame(at, p.fps))
        })
        return newId
      },
      updateClip: (clipId, patch) =>
        mutate(set, (p) => {
          const loc = ops.findClip(p, clipId)
          if (!loc) return
          Object.assign(loc.clip, patch)
          // keep the measured block size in sync for the renderer's alignment
          if (loc.clip.type === 'text' && ('text' in patch || 'style' in patch)) {
            measureTextClip(loc.clip)
          }
        }),

      setSubtitles: (subtitles) => mutate(set, (p) => void (p.subtitles = subtitles)),
      addCue: (cue) =>
        mutate(set, (p) => {
          p.subtitles ??= {
            id: nanoid(),
            style: { ...DEFAULT_SUBTITLE_STYLE },
            cues: [],
          }
          p.subtitles.cues.push(cue)
          p.subtitles.cues.sort((a, b) => a.start - b.start)
        }),
      addCues: (cues) =>
        mutate(set, (p) => {
          p.subtitles ??= {
            id: nanoid(),
            style: { ...DEFAULT_SUBTITLE_STYLE },
            cues: [],
          }
          p.subtitles.cues.push(...cues)
          p.subtitles.cues.sort((a, b) => a.start - b.start)
        }),
      updateCue: (cueId, patch) =>
        mutate(set, (p) => {
          const cue = p.subtitles?.cues.find((c) => c.id === cueId)
          if (cue) Object.assign(cue, patch)
          p.subtitles?.cues.sort((a, b) => a.start - b.start)
        }),
      deleteCue: (cueId) =>
        mutate(set, (p) => {
          if (p.subtitles) p.subtitles.cues = p.subtitles.cues.filter((c) => c.id !== cueId)
        }),
      updateSubtitleStyle: (patch) =>
        mutate(set, (p) => {
          if (p.subtitles) Object.assign(p.subtitles.style, patch)
        }),
    })),
    {
      // undo/redo tracks the document only
      partialize: (state) => ({ project: state.project }),
      limit: 200,
    },
  ),
)

// ---------------------------------------------------------------------------
// Persistence: debounced autosave of the open project

let saveTimer: ReturnType<typeof setTimeout> | null = null
useProjectStore.subscribe((state, prev) => {
  if (!state.project || state.project === prev.project) return
  if (saveTimer) clearTimeout(saveTimer)
  const snapshot = state.project
  saveTimer = setTimeout(() => {
    void db.saveProject(snapshot)
  }, 500)
})

export const undo = () => useProjectStore.temporal.getState().undo()
export const redo = () => useProjectStore.temporal.getState().redo()

export async function createAndOpenProject(name?: string): Promise<Project> {
  const project = createProject(name)
  await db.saveProject(project)
  useProjectStore.getState().openProject(project)
  useProjectStore.temporal.getState().clear()
  return project
}
