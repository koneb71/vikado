import { useEffect, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { Download, Loader2, Plus, Sparkles, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { PanelShell } from '@/editor/sidebar/Sidebar'
import { Button } from '@/components/ui/button'
import { usePlaybackStore } from '@/state/playbackStore'
import { useProjectStore } from '@/state/projectStore'
import { parseSrt, serializeSrt } from '@/lib/srt'
import { formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { findClip } from '@/lib/timelineOps'
import { CAPTION_LANGUAGES, transcribeClip, type TranscribeHandle } from '@/captions/transcriber'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { SubtitleCue } from '@/schema/project'

export function SubtitlesPanel() {
  const subtitles = useProjectStore((s) => s.project?.subtitles ?? null)
  const currentTime = usePlaybackStore((s) => s.currentTime)
  const fileRef = useRef<HTMLInputElement>(null)

  const addCue = () => {
    const t = usePlaybackStore.getState().currentTime
    useProjectStore.getState().addCue({
      id: nanoid(),
      start: t,
      end: t + 2,
      text: 'New subtitle',
    })
  }

  const importSrt = async (file: File) => {
    const cues = parseSrt(await file.text())
    if (cues.length === 0) {
      toast.error('No subtitles found in that file')
      return
    }
    useProjectStore.getState().addCues(cues) // batched: one undo step
    toast.success(`Imported ${cues.length} subtitles`)
  }

  const exportSrt = () => {
    const cues = useProjectStore.getState().project?.subtitles?.cues ?? []
    const blob = new Blob([serializeSrt(cues)], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${useProjectStore.getState().project?.name ?? 'subtitles'}.srt`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <PanelShell title="Subtitles">
      <input
        ref={fileRef}
        type="file"
        accept=".srt"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void importSrt(f)
        }}
      />
      <div className="mb-3 flex gap-1.5">
        <Button size="sm" variant="outline" onClick={addCue}>
          <Plus /> Add
        </Button>
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload /> SRT
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!subtitles?.cues.length}
          onClick={exportSrt}
        >
          <Download /> SRT
        </Button>
      </div>

      <AutoCaptionSection />

      <div className="flex flex-col gap-1.5">
        {subtitles?.cues.map((cue) => (
          <CueRow key={cue.id} cue={cue} active={currentTime >= cue.start && currentTime < cue.end} />
        ))}
        {!subtitles?.cues.length && (
          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-center text-xs text-muted-foreground">
            <p className="max-w-44">Add a subtitle at the playhead or import an SRT file.</p>
          </div>
        )}
      </div>
    </PanelShell>
  )
}

type CaptionPhase =
  | { name: 'idle' }
  | { name: 'downloading'; fraction: number }
  | { name: 'transcribing'; fraction: number }

/**
 * "Auto subtitles": Whisper running fully in the browser. The model (fp32,
 * ~300 MB) downloads once from the Hugging Face hub and is cached; audio
 * never leaves the machine.
 */
function AutoCaptionSection() {
  const [phase, setPhase] = useState<CaptionPhase>({ name: 'idle' })
  const [language, setLanguage] = useState<string>('auto')
  const handleRef = useRef<TranscribeHandle | null>(null)
  const cueCount = useRef(0)

  const selectedClip = useProjectStore((s) => {
    const selection = usePlaybackStore.getState().selection
    if (!s.project || selection.length !== 1) return null
    const clip = findClip(s.project, selection[0])?.clip
    if (!clip) return null
    if (clip.type === 'audio') return clip
    if (clip.type === 'video' && !clip.muted) {
      const asset = s.project.assets.find((a) => a.id === clip.assetId)
      return asset?.hasAudio ? clip : null
    }
    return null
  })
  // re-render when selection changes (selector above reads it transiently)
  usePlaybackStore((s) => s.selection)

  useEffect(() => () => handleRef.current?.cancel(), [])

  const start = () => {
    const project = useProjectStore.getState().project
    if (!project || !selectedClip) return
    cueCount.current = 0
    setPhase({ name: 'transcribing', fraction: 0 })
    handleRef.current = transcribeClip(project, selectedClip, {
      modelProgress: (fraction) => setPhase({ name: 'downloading', fraction }),
      segments: (cues) => {
        if (cues.length) {
          useProjectStore.getState().addCues(cues)
          cueCount.current += cues.length
        }
      },
      progress: (fraction) => setPhase({ name: 'transcribing', fraction }),
      done: () => {
        setPhase({ name: 'idle' })
        toast.success(
          cueCount.current
            ? `Added ${cueCount.current} subtitles`
            : 'No speech detected in the clip',
        )
      },
      error: (message) => {
        setPhase({ name: 'idle' })
        toast.error('Auto-subtitles failed', { description: message })
      },
      cancelled: () => setPhase({ name: 'idle' }),
    }, language === 'auto' ? undefined : language)
  }

  return (
    <div className="mb-3 rounded-lg border p-2.5">
      {phase.name === 'idle' ? (
        <>
          <div className="mb-1.5 flex gap-1.5">
            <Button size="sm" className="min-w-0 flex-1" disabled={!selectedClip} onClick={start}>
              <Sparkles /> Auto subtitles
            </Button>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger size="sm" className="w-24 shrink-0" aria-label="Speech language">
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
          <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
            {selectedClip
              ? 'Transcribes the selected clip on your device — nothing is uploaded.'
              : 'Select a clip with audio on the timeline first.'}
          </p>
        </>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              {phase.name === 'downloading'
                ? `Downloading model ${Math.round(phase.fraction * 100)}%`
                : `Transcribing ${Math.round(phase.fraction * 100)}%`}
            </span>
            <button
              className="text-muted-foreground hover:text-foreground"
              onClick={() => handleRef.current?.cancel()}
            >
              Cancel
            </button>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-accent">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.round(phase.fraction * 100)}%` }}
            />
          </div>
          {phase.name === 'downloading' && (
            <p className="text-[10px] text-muted-foreground">One-time download (~300 MB), cached for next time.</p>
          )}
        </div>
      )}
    </div>
  )
}

function CueRow({ cue, active }: { cue: SubtitleCue; active: boolean }) {
  const store = useProjectStore

  return (
    <div
      className={cn(
        'group rounded-md border p-2 transition-colors',
        active ? 'border-primary/60 bg-primary/10' : 'hover:bg-accent/30',
      )}
    >
      <div className="mb-1 flex items-center justify-between">
        <button
          className="font-mono text-[10px] tabular-nums text-muted-foreground hover:text-foreground"
          onClick={() => usePlaybackStore.getState().seek(cue.start)}
          title="Jump to subtitle"
        >
          {formatTime(cue.start)} → {formatTime(cue.end)}
        </button>
        <button
          aria-label="Delete subtitle"
          className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
          onClick={() => store.getState().deleteCue(cue.id)}
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      <textarea
        value={cue.text}
        rows={Math.min(3, cue.text.split('\n').length)}
        onChange={(e) => store.getState().updateCue(cue.id, { text: e.target.value })}
        className="w-full resize-none rounded bg-transparent text-xs outline-none"
      />
      <div className="flex gap-1 text-[10px] text-muted-foreground">
        <TimeField value={cue.start} onChange={(start) => store.getState().updateCue(cue.id, { start })} />
        <span>→</span>
        <TimeField value={cue.end} onChange={(end) => store.getState().updateCue(cue.id, { end })} />
      </div>
    </div>
  )
}

function TimeField({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      step={0.1}
      min={0}
      value={Number(value.toFixed(2))}
      onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
      className="w-14 rounded border bg-transparent px-1 py-0.5 font-mono tabular-nums outline-none focus:ring-1 focus:ring-ring"
      aria-label="Time in seconds"
    />
  )
}
