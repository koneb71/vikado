import { PanelShell } from '@/editor/sidebar/Sidebar'
import { newTextClip } from '@/lib/clipFactory'
import { useProjectStore } from '@/state/projectStore'
import { usePlaybackStore } from '@/state/playbackStore'
import type { TextStyle } from '@/schema/project'
import { cn } from '@/lib/utils'

/** CapCut-style one-tap text looks (bundled fonts only). */
const TEXT_PRESETS: { name: string; text: string; style: Partial<TextStyle>; swatchClass: string }[] = [
  {
    name: 'Classic',
    text: 'Classic',
    style: { fontFamily: 'Inter', fontSize: 88, fontWeight: 700, color: '#ffffff', outlineColor: '#000000', outlineWidth: 3 },
    swatchClass: 'text-white',
  },
  {
    name: 'Pop',
    text: 'POP!',
    style: { fontFamily: 'Oswald', fontSize: 96, fontWeight: 700, color: '#ffe14d', outlineColor: '#1a1a1a', outlineWidth: 4 },
    swatchClass: 'text-yellow-300',
  },
  {
    name: 'Neon',
    text: 'Neon',
    style: { fontFamily: 'Inter', fontSize: 88, fontWeight: 700, color: '#39ff88', outlineColor: '#0a3320', outlineWidth: 2 },
    swatchClass: 'text-emerald-400',
  },
  {
    name: 'Boxed',
    text: 'Boxed',
    style: { fontFamily: 'Inter', fontSize: 72, fontWeight: 700, color: '#ffffff', backgroundColor: '#e11d48', outlineColor: null, outlineWidth: 0 },
    swatchClass: 'rounded bg-rose-600 px-1.5 text-white',
  },
  {
    name: 'Elegant',
    text: 'Elegant',
    style: { fontFamily: 'Playfair Display', fontSize: 88, fontWeight: 400, italic: true, color: '#f5f0e8', outlineColor: '#2a2118', outlineWidth: 1.5 },
    swatchClass: 'font-serif italic text-amber-50',
  },
  {
    name: 'Mono',
    text: 'mono',
    style: { fontFamily: 'JetBrains Mono', fontSize: 64, fontWeight: 400, color: '#a5f3fc', backgroundColor: '#0e2a30', outlineColor: null, outlineWidth: 0 },
    swatchClass: 'rounded bg-cyan-950 px-1.5 font-mono text-cyan-200',
  },
]

function insertTextClip(mutateClip: (clip: ReturnType<typeof newTextClip>) => void) {
  const store = useProjectStore.getState()
  const project = store.project
  if (!project) return
  const clip = newTextClip(usePlaybackStore.getState().currentTime)
  mutateClip(clip)
  const track = project.tracks.find((t) => t.kind === 'text')
  const trackId = track?.id ?? store.addTrack('text')
  store.addClip(trackId, clip)
  usePlaybackStore.getState().select([clip.id])
}

function addText(preset: 'heading' | 'subheading' | 'body') {
  insertTextClip((clip) => {
    if (preset === 'heading') {
      clip.text = 'Heading'
      clip.style.fontSize = 110
      clip.style.fontWeight = 700
    } else if (preset === 'subheading') {
      clip.text = 'Subheading'
      clip.style.fontSize = 72
      clip.style.fontWeight = 700
    } else {
      clip.text = 'Body text'
      clip.style.fontSize = 48
      clip.style.fontWeight = 400
      clip.style.outlineWidth = 1.5
    }
  })
}

function addPresetText(preset: (typeof TEXT_PRESETS)[number]) {
  insertTextClip((clip) => {
    clip.text = preset.text
    Object.assign(clip.style, preset.style)
  })
}

export function TextPanel() {
  return (
    <PanelShell title="Text">
      <div className="flex flex-col gap-2">
        <button
          onClick={() => addText('heading')}
          className="rounded-lg border bg-card px-3 py-4 text-center text-2xl font-bold transition-colors hover:border-primary/60"
        >
          Heading
        </button>
        <button
          onClick={() => addText('subheading')}
          className="rounded-lg border bg-card px-3 py-3 text-center text-lg font-semibold transition-colors hover:border-primary/60"
        >
          Subheading
        </button>
        <button
          onClick={() => addText('body')}
          className="rounded-lg border bg-card px-3 py-2.5 text-center text-sm transition-colors hover:border-primary/60"
        >
          Body text
        </button>
        <div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">
          Styles
        </div>
        <div className="grid grid-cols-2 gap-2">
          {TEXT_PRESETS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => addPresetText(preset)}
              className="flex h-14 items-center justify-center rounded-lg border bg-black/40 transition-colors hover:border-primary/60"
              aria-label={`Add ${preset.name} text`}
            >
              <span className={cn('text-base font-bold', preset.swatchClass)}>{preset.text}</span>
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          Text is added at the playhead. Style it in the Inspector, drag it in the preview.
        </p>
      </div>
    </PanelShell>
  )
}
