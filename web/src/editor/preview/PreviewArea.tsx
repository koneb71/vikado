import { useEffect, useRef, useState } from 'react'
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PlaybackController } from '@/engine/PlaybackController'
import { PreviewOverlay } from '@/editor/preview/PreviewOverlay'
import { usePlaybackStore } from '@/state/playbackStore'
import { useProjectStore } from '@/state/projectStore'
import { projectDuration } from '@/schema/project'
import { formatTime } from '@/lib/format'

/** Center column: letterboxed preview canvas + transport bar. */
export function PreviewArea() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    setCanvasEl(canvas)
    const controller = new PlaybackController(canvas)
    controller.start()
    if (import.meta.env.DEV) (window as unknown as { __vikadoController?: unknown }).__vikadoController = controller
    return () => controller.dispose()
  }, [])

  const hasContent = useProjectStore((s) =>
    s.project ? s.project.tracks.some((t) => t.clips.length > 0) : false,
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <div className="relative flex max-h-full w-full max-w-4xl items-center justify-center">
          <canvas
            ref={canvasRef}
            className="max-h-[calc(100vh-22rem)] w-full rounded-md bg-black object-contain shadow-lg ring-1 ring-border"
          />
          {!hasContent && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              Import media to get started
            </div>
          )}
          <PreviewOverlay canvas={canvasEl} />
        </div>
      </div>
      <TransportBar />
    </div>
  )
}

function TransportBar() {
  const isPlaying = usePlaybackStore((s) => s.isPlaying)
  const currentTime = usePlaybackStore((s) => s.currentTime)
  const togglePlay = usePlaybackStore((s) => s.togglePlay)
  const seek = usePlaybackStore((s) => s.seek)
  const duration = useProjectStore((s) => (s.project ? projectDuration(s.project) : 0))
  const fps = useProjectStore((s) => s.project?.fps ?? 30)

  const step = (frames: number) => {
    usePlaybackStore.getState().pause()
    seek(usePlaybackStore.getState().currentTime + frames / fps)
  }

  return (
    <div className="flex h-12 shrink-0 items-center justify-center gap-1 border-t bg-sidebar px-4">
      <Button variant="ghost" size="icon-sm" onClick={() => step(-1)} aria-label="Previous frame">
        <SkipBack />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause /> : <Play />}
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={() => step(1)} aria-label="Next frame">
        <SkipForward />
      </Button>
      <span className="ml-3 font-mono text-xs tabular-nums text-muted-foreground">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
    </div>
  )
}
