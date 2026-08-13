import { useState } from 'react'
import { Eye, EyeOff, Trash2, Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { snapToFrame, trackAcceptsClip, type Track } from '@/schema/project'
import { useProjectStore } from '@/state/projectStore'
import { usePlaybackStore } from '@/state/playbackStore'
import { ClipView } from '@/editor/timeline/ClipView'
import { useTimelineCtx } from '@/editor/timeline/gesture'
import { clipFromAsset } from '@/lib/clipFactory'

export const LANE_HEIGHT = 56
export const LANE_GAP = 4

/** dataTransfer type used for media-panel → timeline drags */
export const ASSET_DRAG_TYPE = 'application/x-vikado-asset'

export function TrackHeader({ track }: { track: Track }) {
  const store = useProjectStore

  return (
    <div
      className="flex shrink-0 items-center gap-1 rounded-l-md border-y border-l bg-sidebar px-2"
      style={{ height: LANE_HEIGHT }}
    >
      <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-muted-foreground">
        {track.name}
      </span>
      {track.kind !== 'audio' && (
        <button
          aria-label={track.hidden ? `Show ${track.name}` : `Hide ${track.name}`}
          onClick={() => store.getState().setTrackHidden(track.id, !track.hidden)}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {track.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
      )}
      {track.kind !== 'text' && (
        <button
          aria-label={track.muted ? `Unmute ${track.name}` : `Mute ${track.name}`}
          onClick={() => store.getState().setTrackMuted(track.id, !track.muted)}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {track.muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
        </button>
      )}
      <button
        aria-label={`Delete ${track.name}`}
        onClick={() => store.getState().removeTrack(track.id)}
        className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  )
}

/** Accepts media-panel drags: highlights when the asset kind is compatible. */
export function TrackLane({ track }: { track: Track }) {
  const [dropState, setDropState] = useState<'none' | 'ok'>('none')

  const assetForDrag = (e: React.DragEvent) => {
    const assetId = e.dataTransfer.types.includes(ASSET_DRAG_TYPE)
    if (!assetId) return null
    // dragover can't read data — compatibility is encoded as a type suffix
    const kind = [...e.dataTransfer.types]
      .find((t) => t.startsWith(`${ASSET_DRAG_TYPE}-kind-`))
      ?.slice(`${ASSET_DRAG_TYPE}-kind-`.length)
    if (!kind) return null
    const clipType = kind === 'image' ? 'image' : kind === 'audio' ? 'audio' : 'video'
    return trackAcceptsClip(track, clipType as 'video' | 'image' | 'audio') ? kind : null
  }

  const ctx = useTimelineCtx()

  return (
    <div
      data-track-id={track.id}
      onDragOver={(e) => {
        if (assetForDrag(e)) {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
          setDropState('ok')
        }
      }}
      onDragLeave={() => setDropState('none')}
      onDrop={(e) => {
        setDropState('none')
        const assetId = e.dataTransfer.getData(ASSET_DRAG_TYPE)
        if (!assetId) return
        e.preventDefault()
        const store = useProjectStore.getState()
        const project = store.project
        const asset = project?.assets.find((a) => a.id === assetId)
        if (!project || !asset) return
        const fps = project.fps
        const clip = clipFromAsset(asset, snapToFrame(ctx.timeFromClientX(e.clientX), fps))
        if (!trackAcceptsClip(track, clip.type)) return
        store.addClip(track.id, clip)
        usePlaybackStore.getState().select([clip.id])
      }}
      className={cn(
        'relative rounded-r-md border-y border-r bg-accent/20',
        track.hidden && 'opacity-40',
        dropState === 'ok' && 'ring-1 ring-inset ring-primary/60 bg-primary/10',
      )}
      style={{ height: LANE_HEIGHT }}
    >
      {track.clips.map((clip) => (
        <ClipView key={clip.id} clip={clip} track={track} />
      ))}
    </div>
  )
}
