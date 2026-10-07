import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Captions,
  Download,
  Film,
  Loader2,
  Pencil,
  Upload,
  X,
} from 'lucide-react'
import { nanoid } from 'nanoid'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { CAPTION_LANGUAGES } from '@/captions/transcriber'
import { PCM_WARN_DURATION_S } from '@/captions/pcm'
import { importFile } from '@/media/importMedia'
import { getObjectUrl } from '@/media/opfs'
import * as db from '@/media/db'
import { formatDurationShort } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Asset, Transition } from '@/schema/project'
import { useProjectStore } from '@/state/projectStore'
import { useUiStore } from '@/state/uiStore'
import { analyzeSpeech } from '@/reel/analyze'
import { defaultFraming, matchesCanvas, REEL_MAX_DURATION, type Framing } from '@/reel/framing'
import { generateReel, type GenerateJob, type GenerateProgress } from '@/reel/generateReel'
import { planReel, type ReelSource } from '@/reel/plan'
import { totalLength, type Range } from '@/reel/silence'

interface Item {
  key: string
  name: string
  asset: Asset | null
  /** spoken ranges; null until analyzed */
  speech: Range[] | null
  framing: Framing
  captions: boolean
}

const LENGTHS = [15, 30, 60, REEL_MAX_DURATION]

const TRANSITIONS: { value: Transition['type'] | 'none'; label: string }[] = [
  { value: 'crossfade', label: 'Crossfade' },
  { value: 'fade-black', label: 'Dip to black' },
  { value: 'slide-left', label: 'Slide' },
  { value: 'none', label: 'Hard cut' },
]

function defaultName(): string {
  const date = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return `Reel · ${date}`
}

/**
 * Raw videos in, a Facebook Reel out: import, cut dead air, frame for 9:16,
 * fit the length limit, caption, and open the result as an ordinary project.
 */
export function ReelWizardDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [items, setItems] = useState<Item[]>([])
  const [name, setName] = useState(defaultName)
  const [maxDuration, setMaxDuration] = useState(REEL_MAX_DURATION)
  const [trimSilence, setTrimSilence] = useState(true)
  const [transition, setTransition] = useState<Transition['type'] | 'none'>('crossfade')
  const [language, setLanguage] = useState('auto')
  const [dragOver, setDragOver] = useState(false)
  const [progress, setProgress] = useState<GenerateProgress | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const jobRef = useRef<GenerateJob | null>(null)

  useEffect(() => {
    if (open) return
    jobRef.current?.cancel()
    jobRef.current = null
    setItems([])
    setName(defaultName())
    setProgress(null)
  }, [open])

  const patch = useCallback(
    (key: string, p: Partial<Item>) =>
      setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...p } : it))),
    [],
  )

  const addFiles = useCallback(async (files: File[]) => {
    const videos = files.filter((f) => f.type.startsWith('video/'))
    if (videos.length < files.length) toast.error('Only video files can go into a Reel')
    const added = videos.map((file) => ({ file, key: nanoid() }))
    setItems((prev) => [
      ...prev,
      ...added.map(({ file, key }) => ({
        key,
        name: file.name,
        asset: null,
        speech: null,
        framing: 'fill' as const,
        captions: false,
      })),
    ])
    for (const { file, key } of added) {
      try {
        const asset = await importFile(file)
        if (asset.kind !== 'video') throw new Error('Not a video')
        patch(key, { asset, framing: defaultFraming(asset) })
        patch(key, { speech: await analyzeSpeech(asset) })
      } catch (err) {
        setItems((prev) => prev.filter((it) => it.key !== key))
        toast.error(`Could not import ${file.name}`, {
          description: err instanceof Error ? err.message : undefined,
        })
      }
    }
  }, [patch])

  const move = (index: number, by: number) =>
    setItems((prev) => {
      const next = [...prev]
      const [it] = next.splice(index, 1)
      next.splice(index + by, 0, it)
      return next
    })

  const ready = items.every((it) => it.asset && it.speech)
  const sources = useMemo<ReelSource[]>(
    () =>
      items.flatMap((it) =>
        it.asset && it.speech
          ? [
              {
                asset: it.asset,
                ranges: trimSilence ? it.speech : [{ start: 0, end: it.asset.duration ?? 0 }],
                framing: it.framing,
                captions: it.captions,
              },
            ]
          : [],
      ),
    [items, trimSilence],
  )
  const options = useMemo(
    () => ({ maxDuration, transition: transition === 'none' ? null : transition }),
    [maxDuration, transition],
  )
  const estimate = useMemo(
    () => (sources.length ? planReel(sources, options).duration : 0),
    [sources, options],
  )
  const footage = items.reduce((sum, it) => sum + (it.asset?.duration ?? 0), 0)
  const kept = sources.reduce((sum, s) => sum + totalLength(s.ranges), 0)
  const anyCaptions = items.some((it) => it.captions)
  const longCaptions = items.some(
    (it) => it.captions && (it.asset?.duration ?? 0) > PCM_WARN_DURATION_S,
  )

  const generate = (then: 'edit' | 'export') => {
    const job = generateReel(
      name.trim() || defaultName(),
      sources,
      options,
      language === 'auto' ? undefined : language,
      setProgress,
    )
    jobRef.current = job
    setProgress({ label: 'Planning…', fraction: null })
    job.result
      .then(async (project) => {
        if (jobRef.current !== job) return
        await db.saveProject(project)
        useProjectStore.getState().openProject(project)
        if (then === 'export') useUiStore.getState().setExportOpen(true)
      })
      .catch((err: Error) => {
        if (jobRef.current !== job) return
        jobRef.current = null
        setProgress(null)
        if (err.name !== 'AbortError') toast.error('Could not create the Reel', { description: err.message })
      })
  }

  const busy = progress !== null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        onInteractOutside={(e) => busy && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Create a Facebook Reel</DialogTitle>
          <DialogDescription>
            Drop in raw videos. Vikado cuts the dead air, frames them for 9:16 and keeps it
            under {REEL_MAX_DURATION} seconds. Everything stays editable afterwards.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          multiple
          hidden
          onChange={(e) => {
            // snapshot: the FileList is live and clearing value empties it
            const files = e.target.files ? [...e.target.files] : []
            e.target.value = ''
            if (files.length) void addFiles(files)
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            if (e.dataTransfer.files.length) void addFiles([...e.dataTransfer.files])
          }}
          className={cn(
            'flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed text-xs text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground',
            items.length ? 'h-14 flex-row' : 'h-32',
            dragOver && 'border-primary bg-primary/10 text-foreground',
          )}
        >
          <Upload className="size-4" />
          {items.length ? 'Add more videos' : 'Drop videos here, or click to choose'}
        </button>

        {items.length > 0 && (
          <ul className="-mx-1 flex max-h-64 flex-col gap-1 overflow-y-auto px-1">
            {items.map((it, i) => (
              <ItemRow
                key={it.key}
                item={it}
                disabled={busy}
                onChange={(p) => patch(it.key, p)}
                onUp={i > 0 ? () => move(i, -1) : undefined}
                onDown={i < items.length - 1 ? () => move(i, 1) : undefined}
                onRemove={() => setItems((prev) => prev.filter((x) => x.key !== it.key))}
              />
            ))}
          </ul>
        )}

        {items.length > 0 && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Name</Label>
              <Input value={name} disabled={busy} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Max length</Label>
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                disabled={busy}
                value={String(maxDuration)}
                onValueChange={(v: string) => v && setMaxDuration(Number(v))}
              >
                {LENGTHS.map((s) => (
                  <ToggleGroupItem key={s} value={String(s)} className="px-2 text-xs">
                    {s}s
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Between videos</Label>
              <Select
                value={transition}
                disabled={busy}
                onValueChange={(v) => setTransition(v as typeof transition)}
              >
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSITIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-[11px] text-muted-foreground">Cut silences</Label>
              <Switch checked={trimSilence} disabled={busy} onCheckedChange={setTrimSilence} />
            </div>
            {anyCaptions && (
              <div className="flex items-center justify-between gap-2">
                <Label className="text-[11px] text-muted-foreground">Caption language</Label>
                <Select value={language} disabled={busy} onValueChange={setLanguage}>
                  <SelectTrigger size="sm" className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CAPTION_LANGUAGES.map((l) => (
                      <SelectItem key={l.code ?? 'auto'} value={l.code ?? 'auto'}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {busy ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              {progress.label}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-accent">
              <div
                className={cn(
                  'h-full rounded-full bg-primary transition-[width] duration-300',
                  progress.fraction === null && 'w-1/3 animate-pulse',
                )}
                style={progress.fraction === null ? undefined : { width: `${progress.fraction * 100}%` }}
              />
            </div>
          </div>
        ) : (
          sources.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {formatDurationShort(footage)} of footage
              {trimSilence && kept < footage - 0.5 && <> → {formatDurationShort(kept)} without silences</>}
              {' → '}
              <span className="font-medium text-foreground">
                {formatDurationShort(estimate)} Reel
              </span>
              {kept > maxDuration && <> (trimmed to fit {maxDuration}s)</>}
              {longCaptions && <> · long videos take a while to caption</>}
            </p>
          )
        )}

        <DialogFooter>
          {busy ? (
            <Button
              variant="outline"
              onClick={() => {
                jobRef.current?.cancel()
              }}
            >
              Cancel
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                disabled={!sources.length || !ready}
                onClick={() => generate('edit')}
              >
                <Pencil /> Create & edit
              </Button>
              <Button disabled={!sources.length || !ready} onClick={() => generate('export')}>
                <Download /> Create & export
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ItemRow({
  item,
  disabled,
  onChange,
  onUp,
  onDown,
  onRemove,
}: {
  item: Item
  disabled: boolean
  onChange: (p: Partial<Item>) => void
  onUp?: () => void
  onDown?: () => void
  onRemove: () => void
}) {
  const { asset } = item
  const status = !asset ? 'Importing…' : !item.speech ? 'Finding speech…' : null
  const needsFraming = asset ? !matchesCanvas(asset) : false

  return (
    <li className="flex items-center gap-2.5 rounded-lg border p-1.5">
      <FramePreview asset={asset} framing={item.framing} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium">{item.name}</div>
        <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
          {status ? (
            <>
              <Loader2 className="size-3 animate-spin" /> {status}
            </>
          ) : (
            <>
              {formatDurationShort(asset!.duration ?? 0)}
              {asset!.width && asset!.height && (
                <> · {asset!.width}×{asset!.height}</>
              )}
              {!asset!.hasAudio && <> · no audio</>}
            </>
          )}
        </div>
        {asset && (
          <div className="mt-1.5 flex items-center gap-1.5">
            {needsFraming && (
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                disabled={disabled}
                value={item.framing}
                onValueChange={(v: string) => v && onChange({ framing: v as Framing })}
              >
                <ToggleGroupItem value="fill" className="h-6 px-2 text-[10px]">
                  Fill
                </ToggleGroupItem>
                <ToggleGroupItem value="blur" className="h-6 px-2 text-[10px]">
                  Blur fit
                </ToggleGroupItem>
              </ToggleGroup>
            )}
            <Button
              variant={item.captions ? 'secondary' : 'ghost'}
              size="xs"
              disabled={disabled || !asset.hasAudio}
              aria-pressed={item.captions}
              onClick={() => onChange({ captions: !item.captions })}
              className={cn('text-[10px]', item.captions && 'text-primary')}
            >
              <Captions /> {item.captions ? 'Captions on' : 'Captions'}
            </Button>
          </div>
        )}
      </div>
      <div className="flex flex-col">
        <Button variant="ghost" size="icon-xs" aria-label="Move up" disabled={disabled || !onUp} onClick={onUp}>
          <ArrowUp />
        </Button>
        <Button variant="ghost" size="icon-xs" aria-label="Move down" disabled={disabled || !onDown} onClick={onDown}>
          <ArrowDown />
        </Button>
      </div>
      <Button variant="ghost" size="icon-xs" aria-label={`Remove ${item.name}`} disabled={disabled} onClick={onRemove}>
        <X />
      </Button>
    </li>
  )
}

/** A 9:16 thumbnail that shows how the video will sit in the Reel. */
function FramePreview({ asset, framing }: { asset: Asset | null; framing: Framing }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!asset) return
    let alive = true
    void getObjectUrl(asset.hash).then((u) => alive && setUrl(`${u}#t=0.5`))
    return () => {
      alive = false
    }
  }, [asset])

  const blur = asset && framing === 'blur' && !matchesCanvas(asset)
  return (
    <div className="relative h-16 w-9 shrink-0 overflow-hidden rounded-md bg-muted">
      {url ? (
        <>
          {blur && (
            <video src={url} muted preload="metadata" className="absolute inset-0 size-full scale-125 object-cover blur-sm" />
          )}
          <video
            src={url}
            muted
            preload="metadata"
            className={cn('absolute inset-0 size-full', blur ? 'object-contain' : 'object-cover')}
          />
        </>
      ) : (
        <Film className="absolute inset-0 m-auto size-4 text-muted-foreground/50" />
      )}
    </div>
  )
}
