import { useCallback, useMemo, useRef, useState } from 'react'
import { Magnet, Plus, Scissors, Trash2, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { projectDuration, snapToFrame } from '@/schema/project'
import { useProjectStore } from '@/state/projectStore'
import { usePlaybackStore } from '@/state/playbackStore'
import { useUiStore } from '@/state/uiStore'
import { TimeRuler } from '@/editor/timeline/TimeRuler'
import { TimelineContext, type Gesture } from '@/editor/timeline/gesture'
import { TrackHeader, TrackLane, LANE_GAP } from '@/editor/timeline/TrackLane'

const HEADER_WIDTH = 144

export function TimelinePanel() {
  const project = useProjectStore((s) => s.project)
  const pxPerSecond = useUiStore((s) => s.pxPerSecond)
  const snapping = useUiStore((s) => s.snapping)
  const timelineHeight = useUiStore((s) => s.timelineHeight)
  const selection = usePlaybackStore((s) => s.selection)

  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [viewportWidth, setViewportWidth] = useState(0)
  const [gesture, setGesture] = useState<Gesture | null>(null)

  const duration = project ? projectDuration(project) : 0
  const contentWidth = Math.max((duration + 30) * pxPerSecond, viewportWidth)

  const timeFromClientX = useCallback(
    (clientX: number) => {
      const el = scrollRef.current
      if (!el) return 0
      const rect = el.getBoundingClientRect()
      return Math.max(0, (clientX - rect.left - HEADER_WIDTH + el.scrollLeft) / pxPerSecond)
    },
    [pxPerSecond],
  )

  const ctx = useMemo(
    () => ({ gesture, setGesture, timeFromClientX, pxPerSecond }),
    [gesture, timeFromClientX, pxPerSecond],
  )

  const scrub = useCallback(
    (clientX: number) => {
      const fps = useProjectStore.getState().project?.fps ?? 30
      usePlaybackStore.getState().pause()
      usePlaybackStore.getState().seek(snapToFrame(timeFromClientX(clientX), fps))
    },
    [timeFromClientX],
  )

  const splitSelection = () => {
    const t = usePlaybackStore.getState().currentTime
    const store = useProjectStore.getState()
    for (const id of usePlaybackStore.getState().selection) store.splitClip(id, t)
  }

  const deleteSelection = () => {
    useProjectStore.getState().deleteClips(usePlaybackStore.getState().selection)
    usePlaybackStore.getState().clearSelection()
  }

  const zoom = (factor: number) => {
    const el = scrollRef.current
    const anchor = el
      ? (el.scrollLeft + (el.clientWidth - HEADER_WIDTH) / 2) / pxPerSecond
      : 0
    applyZoom(factor, anchor)
  }

  const applyZoom = (factor: number, anchorTime: number) => {
    const el = scrollRef.current
    const ui = useUiStore.getState()
    const before = ui.pxPerSecond
    ui.setPxPerSecond(before * factor)
    const after = useUiStore.getState().pxPerSecond
    if (el && after !== before) {
      // keep anchorTime at the same screen x
      const screenX = anchorTime * before - el.scrollLeft
      el.scrollLeft = anchorTime * after - screenX
    }
  }

  if (!project) return null

  const hasClips = project.tracks.some((t) => t.clips.length > 0)

  return (
    <TimelineContext.Provider value={ctx}>
      <section
        className="relative flex shrink-0 flex-col border-t bg-timeline"
        style={{ height: timelineHeight }}
      >
        {/* resize handle: drag the top edge */}
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize timeline"
          onPointerDown={(e) => {
            e.preventDefault()
            const startY = e.clientY
            const startH = useUiStore.getState().timelineHeight
            const target = e.currentTarget
            target.setPointerCapture(e.pointerId)
            const onMove = (ev: PointerEvent) =>
              useUiStore.getState().setTimelineHeight(startH + (startY - ev.clientY))
            const onUp = () => {
              target.removeEventListener('pointermove', onMove)
              target.removeEventListener('pointerup', onUp)
            }
            target.addEventListener('pointermove', onMove)
            target.addEventListener('pointerup', onUp)
          }}
          className="absolute -top-1 left-0 right-0 z-30 h-2 cursor-row-resize transition-colors hover:bg-primary/40"
        />
        {/* toolbar */}
        <div className="flex h-9 shrink-0 items-center gap-1 border-b bg-sidebar px-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                disabled={selection.length === 0}
                onClick={splitSelection}
                aria-label="Split clip at playhead"
              >
                <Scissors />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Split at playhead (S)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                disabled={selection.length === 0}
                onClick={deleteSelection}
                aria-label="Delete selection"
              >
                <Trash2 />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete (⌫)</TooltipContent>
          </Tooltip>
          <Separator orientation="vertical" className="mx-1 !h-4" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={snapping ? 'secondary' : 'ghost'}
                size="icon-xs"
                onClick={() => useUiStore.getState().toggleSnapping()}
                aria-label="Toggle snapping"
              >
                <Magnet />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Snapping {snapping ? 'on' : 'off'}</TooltipContent>
          </Tooltip>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon-xs" onClick={() => zoom(1 / 1.4)} aria-label="Zoom out">
              <ZoomOut />
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={() => zoom(1.4)} aria-label="Zoom in">
              <ZoomIn />
            </Button>
          </div>
        </div>

        {/* ruler row */}
        <div className="flex h-6 shrink-0 border-b">
          <div style={{ width: HEADER_WIDTH }} className="shrink-0 border-r bg-sidebar" />
          <div className="min-w-0 flex-1 overflow-hidden">
            <TimeRuler
              pxPerSecond={pxPerSecond}
              scrollLeft={scrollLeft}
              width={Math.max(0, viewportWidth - HEADER_WIDTH)}
              onScrub={scrub}
            />
          </div>
        </div>

        {/* lanes */}
        <div
          ref={(el) => {
            scrollRef.current = el
            if (el && el.clientWidth !== viewportWidth) setViewportWidth(el.clientWidth)
          }}
          onScroll={(e) => setScrollLeft(e.currentTarget.scrollLeft)}
          onWheel={(e) => {
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault()
              applyZoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, timeFromClientX(e.clientX))
            }
          }}
          onPointerDown={(e) => {
            // click on empty lane space = scrub + clear selection
            if ((e.target as HTMLElement).closest('[data-clip-id]')) return
            usePlaybackStore.getState().clearSelection()
            scrub(e.clientX)
          }}
          className="relative min-h-0 flex-1 overflow-auto overscroll-contain"
        >
          <div className="relative flex" style={{ width: contentWidth + HEADER_WIDTH }}>
            {/* sticky header column */}
            <div
              className="sticky left-0 z-20 flex shrink-0 flex-col bg-timeline py-2"
              style={{ width: HEADER_WIDTH, gap: LANE_GAP }}
            >
              {[...project.tracks].reverse().map((track) => (
                <TrackHeader key={track.id} track={track} />
              ))}
              <AddTrackButton />
            </div>

            {/* lanes column */}
            <div className="relative flex min-w-0 flex-1 flex-col py-2" style={{ gap: LANE_GAP }}>
              {[...project.tracks].reverse().map((track) => (
                <TrackLane key={track.id} track={track} />
              ))}
              {!hasClips && (
                <div className="pointer-events-none absolute inset-x-4 top-2 flex h-14 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
                  Add media from the panel on the left to start your timeline
                </div>
              )}
              <Playhead pxPerSecond={pxPerSecond} />
              {gesture?.snapGuide != null && (
                <div
                  className="pointer-events-none absolute inset-y-0 z-10 w-px bg-primary"
                  style={{ left: gesture.snapGuide * pxPerSecond }}
                />
              )}
            </div>
          </div>
        </div>
      </section>
    </TimelineContext.Provider>
  )
}

function Playhead({ pxPerSecond }: { pxPerSecond: number }) {
  const currentTime = usePlaybackStore((s) => s.currentTime)
  return (
    <div
      className="pointer-events-none absolute inset-y-0 z-10 w-px bg-[oklch(0.62_0.21_285)]"
      style={{ left: currentTime * pxPerSecond }}
    />
  )
}

function AddTrackButton() {
  const addTrack = useProjectStore((s) => s.addTrack)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'flex h-7 items-center justify-center gap-1 rounded-md text-[11px] text-muted-foreground',
            'transition-colors hover:bg-accent/40 hover:text-foreground',
          )}
        >
          <Plus className="size-3.5" /> Add track
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => addTrack('video')}>Video track</DropdownMenuItem>
        <DropdownMenuItem onClick={() => addTrack('audio')}>Audio track</DropdownMenuItem>
        <DropdownMenuItem onClick={() => addTrack('text')}>Text track</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
