import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Download, Loader2, XCircle } from 'lucide-react'
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
import { useProjectStore } from '@/state/projectStore'
import {
  DEFAULT_RENDER_OPTIONS,
  startExport,
  type ExportHandle,
  type ExportProgress,
} from '@/export/exportClient'
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

export function ExportDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const [options, setOptions] = useState<RenderOptions>(DEFAULT_RENDER_OPTIONS)
  const [state, setState] = useState<ExportProgress | null>(null)
  const [started, setStarted] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const handleRef = useRef<ExportHandle | null>(null)

  useEffect(() => {
    if (!open) {
      handleRef.current?.cancel()
      handleRef.current = null
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
    const handle = startExport(project, setState, options)
    handleRef.current = handle
    handle.downloadUrl
      .then((url) => setDownloadUrl(url))
      .catch((e: Error) => {
        if (e.message !== 'canceled') setError(e.message)
      })
  }

  const project = useProjectStore.getState().project
  const outSize = project
    ? {
        w: Math.max(2, Math.round((project.width * options.scale) / 2) * 2),
        h: Math.max(2, Math.round((project.height * options.scale) / 2) * 2),
      }
    : null

  const phaseLabel =
    state?.phase === 'uploading'
      ? 'Uploading media…'
      : state?.phase === 'rendering'
        ? 'Rendering…'
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
                  ? 'Rendering happens on the Vikado render service.'
                  : 'Choose export settings.'}
          </DialogDescription>
        </DialogHeader>

        {!started ? (
          <div className="space-y-3">
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
              {outSize && (
                <p className="text-[10px] text-muted-foreground">
                  Output: {outSize.w}×{outSize.h} MP4 (H.264 + AAC)
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
