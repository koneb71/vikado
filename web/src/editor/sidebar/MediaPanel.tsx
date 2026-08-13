import { useCallback, useRef, useState } from 'react'
import { FileAudio, FileImage, FileVideo, Loader2, Plus, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { PanelShell } from '@/editor/sidebar/Sidebar'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ACCEPTED_MIME, importFile } from '@/media/importMedia'
import { useProjectStore } from '@/state/projectStore'
import { usePlaybackStore } from '@/state/playbackStore'
import { clipFromAsset } from '@/lib/clipFactory'
import { ASSET_DRAG_TYPE } from '@/editor/timeline/TrackLane'
import { trackAcceptsClip, type Asset } from '@/schema/project'
import { formatDurationShort } from '@/lib/format'
import { cn } from '@/lib/utils'

const KIND_ICONS = { video: FileVideo, audio: FileAudio, image: FileImage } as const

export function MediaPanel() {
  const assets = useProjectStore((s) => s.project?.assets ?? [])
  const [importing, setImporting] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setImporting(true)
    for (const file of files) {
      try {
        const asset = await importFile(file)
        useProjectStore.getState().addAsset(asset)
      } catch (err) {
        toast.error(`Could not import ${file.name}`, {
          description: err instanceof Error ? err.message : undefined,
        })
      }
    }
    setImporting(false)
  }, [])

  return (
    <PanelShell title="Media">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_MIME}
        multiple
        hidden
        onChange={(e) => {
          // snapshot: the FileList is live and clearing value empties it
          const files = e.target.files ? [...e.target.files] : []
          e.target.value = ''
          if (files.length) void handleFiles(files)
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          if (e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files)
        }}
        className={cn(
          'flex h-28 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-xs text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground',
          dragOver && 'border-primary bg-primary/10 text-foreground',
        )}
      >
        {importing ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
        {importing ? 'Importing…' : 'Upload video, audio or images'}
      </button>

      <div className="mt-3 flex flex-col gap-1">
        {assets.map((asset) => (
          <AssetRow key={asset.id} asset={asset} />
        ))}
      </div>
    </PanelShell>
  )
}

function AssetRow({ asset }: { asset: Asset }) {
  const Icon = KIND_ICONS[asset.kind]

  const addToTimeline = () => {
    const store = useProjectStore.getState()
    const project = store.project
    if (!project) return
    const clip = clipFromAsset(asset, usePlaybackStore.getState().currentTime)
    let track = project.tracks.find((t) => trackAcceptsClip(t, clip.type))
    const trackId = track?.id ?? store.addTrack(asset.kind === 'audio' ? 'audio' : 'video')
    store.addClip(trackId, clip)
  }

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(ASSET_DRAG_TYPE, asset.id)
        // lanes need the kind during dragover (data is unreadable then) —
        // encode it as an extra type
        e.dataTransfer.setData(`${ASSET_DRAG_TYPE}-kind-${asset.kind}`, '1')
        e.dataTransfer.effectAllowed = 'copy'
      }}
      className="group flex cursor-grab items-center gap-2 rounded-md p-2 transition-colors hover:bg-accent/40">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent/60">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium">{asset.name}</div>
        <div className="text-[10px] text-muted-foreground">
          {asset.duration != null ? formatDurationShort(asset.duration) : 'Image'}
          {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ''}
        </div>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            className="opacity-0 transition-opacity group-hover:opacity-100"
            onClick={addToTimeline}
            aria-label={`Add ${asset.name} to timeline`}
          >
            <Plus />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Add to timeline at playhead</TooltipContent>
      </Tooltip>
    </div>
  )
}
