import { useRef } from 'react'
import { cn } from '@/lib/utils'
import { clipEnd, trackAcceptsClip, type Clip, type Track } from '@/schema/project'
import { useProjectStore } from '@/state/projectStore'
import { usePlaybackStore } from '@/state/playbackStore'
import { useUiStore } from '@/state/uiStore'
import { applySnap, collectSnapPoints, SNAP_THRESHOLD_PX } from '@/editor/timeline/snapping'
import { useTimelineCtx } from '@/editor/timeline/gesture'
import { ClipStrip } from '@/editor/timeline/ClipStrip'
import { MIN_CLIP_DURATION } from '@/lib/timelineOps'
import { copyClips } from '@/lib/clipboard'
import { keyframeTimes } from '@/lib/keyframes'
import { captureFreezeFrame } from '@/lib/freezeFrame'
import { toast } from 'sonner'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'

const KIND_CLASSES: Record<Clip['type'], string> = {
  video: 'bg-clip-video/70 border-clip-video',
  image: 'bg-clip-image/70 border-clip-image',
  audio: 'bg-clip-audio/70 border-clip-audio',
  text: 'bg-clip-text/70 border-clip-text',
}

const DRAG_THRESHOLD_PX = 3

export function ClipView({ clip, track }: { clip: Clip; track: Track }) {
  const ctx = useTimelineCtx()
  const selected = usePlaybackStore((s) => s.selection.includes(clip.id))
  const gestureRef = useRef<{ startX: number; startY: number; moved: boolean } | null>(null)

  const isDragging = ctx.gesture?.clipId === clip.id
  const start = isDragging ? ctx.gesture!.start : clip.start
  const duration = isDragging ? ctx.gesture!.duration : clip.duration

  const left = start * ctx.pxPerSecond
  const width = Math.max(4, duration * ctx.pxPerSecond)

  const beginGesture = (
    e: React.PointerEvent,
    type: 'move' | 'trim-left' | 'trim-right',
  ) => {
    e.stopPropagation()
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
    gestureRef.current = { startX: e.clientX, startY: e.clientY, moved: false }

    const project = useProjectStore.getState().project!
    const playhead = usePlaybackStore.getState().currentTime
    const snapping = useUiStore.getState().snapping
    const snapPoints = collectSnapPoints(project, playhead, new Set([clip.id]))
    const thresholdS = SNAP_THRESHOLD_PX / ctx.pxPerSecond
    const grabOffset = ctx.timeFromClientX(e.clientX) - clip.start

    const onMove = (ev: PointerEvent) => {
      const g = gestureRef.current
      if (!g) return
      if (!g.moved) {
        const dist = Math.hypot(ev.clientX - g.startX, ev.clientY - g.startY)
        if (dist < DRAG_THRESHOLD_PX) return
        g.moved = true
      }
      const t = ctx.timeFromClientX(ev.clientX)

      if (type === 'move') {
        const raw = t - grabOffset
        const snap = snapping
          ? applySnap(raw, snapPoints, thresholdS, [0, clip.duration])
          : { time: Math.max(0, raw), snappedTo: null }

        // cross-track: find the lane under the pointer
        let trackId = ctx.gesture?.trackId ?? track.id
        for (const el of document.querySelectorAll<HTMLElement>('[data-track-id]')) {
          const r = el.getBoundingClientRect()
          if (ev.clientY >= r.top && ev.clientY <= r.bottom) {
            const t2 = useProjectStore
              .getState()
              .project!.tracks.find((tr) => tr.id === el.dataset.trackId)
            if (t2 && trackAcceptsClip(t2, clip.type)) trackId = t2.id
          }
        }
        ctx.setGesture({
          type,
          clipId: clip.id,
          start: snap.time,
          duration: clip.duration,
          trackId,
          snapGuide: snap.snappedTo,
        })
      } else if (type === 'trim-left') {
        const maxStart = clipEnd(clip) - MIN_CLIP_DURATION
        const sourceRoom = 'sourceIn' in clip ? clip.sourceIn : Infinity
        const minStart = Math.max(0, clip.start - sourceRoom)
        const raw = Math.min(Math.max(t, minStart), maxStart)
        const snap = snapping
          ? applySnap(raw, snapPoints, thresholdS)
          : { time: raw, snappedTo: null }
        const s = Math.min(Math.max(snap.time, minStart), maxStart)
        ctx.setGesture({
          type,
          clipId: clip.id,
          start: s,
          duration: clipEnd(clip) - s,
          trackId: track.id,
          snapGuide: snap.snappedTo,
        })
      } else {
        const minEnd = clip.start + MIN_CLIP_DURATION
        const raw = Math.max(t, minEnd)
        const snap = snapping
          ? applySnap(raw, snapPoints, thresholdS)
          : { time: raw, snappedTo: null }
        const end = Math.max(snap.time, minEnd)
        ctx.setGesture({
          type,
          clipId: clip.id,
          start: clip.start,
          duration: end - clip.start,
          trackId: track.id,
          snapGuide: snap.snappedTo,
        })
      }
    }

    const onUp = () => {
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onUp)
      const g = gestureRef.current
      gestureRef.current = null
      const gesture = ctxGesture()
      ctx.setGesture(null)

      if (!g?.moved || !gesture) {
        // click: select
        usePlaybackStore.getState().select([clip.id])
        return
      }
      const store = useProjectStore.getState()
      if (type === 'move') {
        store.moveClip(clip.id, gesture.start, gesture.trackId)
      } else if (type === 'trim-left') {
        store.trimClipLeft(clip.id, gesture.start)
      } else {
        store.trimClipRight(clip.id, gesture.start + gesture.duration)
      }
      usePlaybackStore.getState().select([clip.id])
    }

    // read the latest gesture at pointer-up (state updates are async)
    const ctxGesture = () => latestGesture.current

    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
    target.addEventListener('pointercancel', onUp)
  }

  // ref mirror of the context gesture so pointer-up sees the final value
  const latestGesture = useRef(ctx.gesture)
  latestGesture.current = ctx.gesture

  const label = clip.type === 'text' ? clip.text : assetName(clip)

  const menuAction = {
    split: () => {
      const t = usePlaybackStore.getState().currentTime
      useProjectStore.getState().splitClip(clip.id, t)
    },
    duplicate: () => {
      const ids = useProjectStore.getState().duplicateClips([clip.id])
      if (ids.length) usePlaybackStore.getState().select(ids)
    },
    copy: () => {
      const project = useProjectStore.getState().project
      if (project) copyClips(project, [clip.id])
    },
    delete: () => {
      useProjectStore.getState().deleteClips([clip.id])
      usePlaybackStore.getState().clearSelection()
    },
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
    <div
      data-clip-id={clip.id}
      onPointerDown={(e) => beginGesture(e, 'move')}
      className={cn(
        'group absolute top-1 bottom-1 cursor-grab touch-none overflow-hidden rounded-md border text-left select-none',
        KIND_CLASSES[clip.type],
        selected && 'ring-2 ring-ring ring-offset-1 ring-offset-timeline',
        isDragging && 'cursor-grabbing opacity-80',
      )}
      style={{ left, width }}
    >
      <ClipStrip clip={clip} width={width} height={46} />
      <span className="pointer-events-none absolute inset-x-1.5 top-1 truncate text-[10px] font-medium text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
        {label}
      </span>
      {/* keyframe markers */}
      {'keyframes' in clip &&
        keyframeTimes(clip.keyframes).map((kt) => (
          <span
            key={kt}
            className="pointer-events-none absolute bottom-1 size-1.5 rotate-45 border border-white/80 bg-primary"
            style={{ left: (kt / clip.duration) * width - 3 }}
          />
        ))}
      {/* trim handles */}
      <div
        onPointerDown={(e) => beginGesture(e, 'trim-left')}
        className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize bg-white/0 transition-colors group-hover:bg-white/30"
      />
      <div
        onPointerDown={(e) => beginGesture(e, 'trim-right')}
        className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize bg-white/0 transition-colors group-hover:bg-white/30"
      />
    </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={menuAction.split}>
          Split at playhead
          <ContextMenuShortcut>S</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={menuAction.duplicate}>
          Duplicate
          <ContextMenuShortcut>⌘D</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={menuAction.copy}>
          Copy
          <ContextMenuShortcut>⌘C</ContextMenuShortcut>
        </ContextMenuItem>
        {clip.type === 'video' && (
          <>
            <ContextMenuItem
              onClick={() => useProjectStore.getState().updateClip(clip.id, { muted: !clip.muted })}
            >
              {clip.muted ? 'Unmute audio' : 'Mute audio'}
            </ContextMenuItem>
            <ContextMenuItem
              disabled={clip.muted}
              onClick={() => {
                const id = useProjectStore.getState().detachAudio(clip.id)
                if (id) {
                  usePlaybackStore.getState().select([id])
                  toast.success('Audio detached to its own track')
                } else {
                  toast.error('This clip has no audio to detach')
                }
              }}
            >
              Detach audio
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => {
                const project = useProjectStore.getState().project
                if (!project) return
                const t = usePlaybackStore.getState().currentTime
                void captureFreezeFrame(project, clip, t)
                  .then((asset) => {
                    const id = useProjectStore.getState().insertFreezeFrame(clip.id, t, asset, 2)
                    if (id) usePlaybackStore.getState().select([id])
                    toast.success('Freeze frame inserted (2s)')
                  })
                  .catch((err: Error) =>
                    toast.error('Freeze frame failed', { description: err.message }),
                  )
              }}
            >
              Freeze frame
            </ContextMenuItem>
          </>
        )}
        {'transitionOut' in clip && clip.transitionOut && (
          <ContextMenuItem
            onClick={() => useProjectStore.getState().updateClip(clip.id, { transitionOut: null })}
          >
            Remove transition
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={menuAction.delete}>
          Delete
          <ContextMenuShortcut>⌫</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

function assetName(clip: Clip): string {
  if (!('assetId' in clip)) return ''
  const project = useProjectStore.getState().project
  return project?.assets.find((a) => a.id === clip.assetId)?.name ?? ''
}
