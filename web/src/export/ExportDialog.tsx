import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Cpu, Download, Loader2, Server, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useProjectStore } from '@/state/projectStore'
import type { Project } from '@/schema/project'
import {
  DEFAULT_RENDER_OPTIONS,
  startExport,
  type ExportHandle,
  type ExportProgress,
} from '@/export/exportClient'
import {
  isLocalExportSupported,
  outputSize,
  startLocalExport,
  type LocalExportHandle,
} from '@/export/localExport'
import type { RenderOptions } from '@/generated/RenderOptions'
import type { RenderQuality } from '@/generated/RenderQuality'

const QUALITY_LABELS: Record<RenderQuality, string> = {
  draft: 'Draft — fast, smaller file',
  standard: 'Standard',
  high: 'High — best quality',
}

const SCALE_OPTIONS = [
  { value: 1, label: 'Full (100%)' },
  { value: 0.75, label: '75%' },
  { value: 0.5, label: '50%' },
]

type Engine = 'local' | 'server'

/**
 * Clip speed is mixed by resampling in the browser (AudioBufferSourceNode has no
 * pitch preservation), while both the preview and ffmpeg's atempo keep pitch.
 * Warn rather than silently hand back chipmunk audio.
 */
function hasPitchShiftedAudio(project: Project | null): boolean {
  if (!project) return false
  return project.tracks.some(
    (track) =>
      !track.muted &&
      track.clips.some((clip) => {
        if (clip.type === 'audio') return clip.speed !== 1 && clip.volume > 0
        if (clip.type === 'video') {
          const asset = project.assets.find((a) => a.id === clip.assetId)
          return clip.speed !== 1 && !clip.muted && clip.volume > 0 && !!asset?.hasAudio
        }
        return false
      }),
  )
}

export function ExportDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const [options, setOptions] = useState<RenderOptions>(DEFAULT_RENDER_OPTIONS)
  const [engine, setEngine] = useState<Engine>('local')
  const [localAvailable, setLocalAvailable] = useState<boolean | null>(null)
  const [state, setState] = useState<ExportProgress | null>(null)
  const [started, setStarted] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const handleRef = useRef<ExportHandle | LocalExportHandle | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  // capability probe: an older browser without WebCodecs falls back to the service
  useEffect(() => {
    let alive = true
    void isLocalExportSupported().then((ok) => {
      if (!alive) return
      setLocalAvailable(ok)
      if (!ok) setEngine('server')
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!open) {
      handleRef.current?.cancel()
      handleRef.current = null
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
      setState(null)
      setStarted(false)
      setDownloadUrl(null)
      setError(null)
    }
  }, [open])

  const begin = () => {
    const project = useProjectStore.getState().project
    if (!project) return
    setStarted(true)

    if (engine === 'local') {
      const handle = startLocalExport(project, options, (p) =>
        setState({
          phase: p.phase === 'finalizing' ? 'rendering' : p.phase === 'preparing' ? 'uploading' : 'rendering',
          progress: p.progress,
        }),
      )
      handleRef.current = handle
      handle.result
        .then((blob) => {
          const url = URL.createObjectURL(blob)
          // cancel and close both clear handleRef; an export that resolves
          // after either would otherwise leak this URL and resurrect the
          // finished state in a dialog the user already dismissed
          if (handleRef.current !== handle) {
            URL.revokeObjectURL(url)
            return
          }
          objectUrlRef.current = url
          setDownloadUrl(url)
        })
        .catch((e: Error) => {
          if (handleRef.current !== handle) return
          if (e.message !== 'canceled') setError(e.message)
        })
      return
    }

    const handle = startExport(project, setState, options)
    handleRef.current = handle
    handle.downloadUrl
      .then((url) => setDownloadUrl(url))
      .catch((e: Error) => {
        if (e.message !== 'canceled') setError(e.message)
      })
  }

  const project = useProjectStore.getState().project
  const size = project ? outputSize(project, options) : null
  const pitchWarning = hasPitchShiftedAudio(project)

  const phaseLabel =
    state?.phase === 'uploading'
      ? engine === 'local'
        ? 'Preparing…'
        : 'Uploading media…'
      : state?.phase === 'rendering'
        ? engine === 'local'
          ? 'Rendering on this device…'
          : 'Rendering…'
        : null
  const percent = Math.round((state?.progress ?? 0) * 100)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-sm"
        onInteractOutside={(e) => {
          if (started && !downloadUrl && !error) e.preventDefault() // don't cancel by accident
        }}
      >
        <DialogHeader>
          <DialogTitle>Export video</DialogTitle>
          <DialogDescription>
            {downloadUrl
              ? 'Your video is ready.'
              : error
                ? 'The export failed.'
                : started
                  ? engine === 'local'
                    ? 'Encoding with your GPU. Keep this tab open.'
                    : 'Rendering on the Vikado render service.'
                  : 'Choose export settings.'}
          </DialogDescription>
        </DialogHeader>

        {!started ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Render with</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={localAvailable === false}
                  onClick={() => setEngine('local')}
                  className={cn(
                    'flex flex-col items-start gap-0.5 rounded-lg border p-2.5 text-left transition-colors',
                    engine === 'local'
                      ? 'border-primary bg-primary/10'
                      : 'hover:border-primary/50',
                    localAvailable === false && 'cursor-not-allowed opacity-40',
                  )}
                >
                  <span className="flex items-center gap-1.5 text-xs font-medium">
                    <Cpu className="size-3.5" /> This device
                  </span>
                  <span className="text-[10px] leading-snug text-muted-foreground">
                    {localAvailable === false
                      ? 'Not supported by this browser'
                      : 'GPU encode, nothing uploaded'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setEngine('server')}
                  className={cn(
                    'flex flex-col items-start gap-0.5 rounded-lg border p-2.5 text-left transition-colors',
                    engine === 'server'
                      ? 'border-primary bg-primary/10'
                      : 'hover:border-primary/50',
                  )}
                >
                  <span className="flex items-center gap-1.5 text-xs font-medium">
                    <Server className="size-3.5" /> Render service
                  </span>
                  <span className="text-[10px] leading-snug text-muted-foreground">
                    ffmpeg, uploads your media
                  </span>
                </button>
              </div>
              {engine === 'local' && pitchWarning && (
                <p className="flex gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-[10px] leading-snug text-amber-200">
                  <AlertTriangle className="mt-px size-3 shrink-0" />
                  <span>
                    This project speeds up audio. Encoding here resamples it, so the pitch
                    rises; the render service keeps the pitch unchanged.
                  </span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Quality</Label>
              <Select
                value={options.quality}
                onValueChange={(quality) =>
                  setOptions((o) => ({ ...o, quality: quality as RenderQuality }))
                }
              >
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(QUALITY_LABELS) as RenderQuality[]).map((q) => (
                    <SelectItem key={q} value={q}>
                      {QUALITY_LABELS[q]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Resolution</Label>
              <Select
                value={String(options.scale)}
                onValueChange={(v) => setOptions((o) => ({ ...o, scale: Number(v) }))}
              >
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCALE_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={String(s.value)}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {size && (
                <p className="text-[10px] text-muted-foreground">
                  Output: {size[0]}×{size[1]} MP4 (H.264 + AAC)
                </p>
              )}
            </div>
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs">
            <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div className="whitespace-pre-wrap break-words">{error}</div>
          </div>
        ) : downloadUrl ? (
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="size-5 text-green-500" />
            Export complete
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {phaseLabel ?? 'Starting…'}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-accent">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="text-right font-mono text-[10px] tabular-nums text-muted-foreground">
              {percent}%
            </div>
          </div>
        )}

        <DialogFooter>
          {!started ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={begin}>
                <Download /> Export
              </Button>
            </>
          ) : downloadUrl ? (
            <Button asChild>
              <a href={downloadUrl} download="vikado-export.mp4">
                <Download /> Download MP4
              </a>
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
