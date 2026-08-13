import { usePlaybackStore } from '@/state/playbackStore'
import { useProjectStore } from '@/state/projectStore'
import { findClip } from '@/lib/timelineOps'
import {
  DEFAULT_CHROMA_KEY,
  FILTER_PRESETS,
  TEXT_ANIMATIONS,
  TEXT_TRANSFORMS,
  TRANSITION_TYPES,
  type AudioClip,
  type Clip,
  type ImageClip,
  type KeyframeProp,
  type TextAnimation,
  type TextClip,
  type Transition,
  type VideoClip,
} from '@/schema/project'
import { fontsByCategory } from '@/schema/fonts'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Diamond,
  FlipHorizontal2,
  FlipVertical2,
  Italic,
  X,
} from 'lucide-react'
import { keyframeAt, sampleTrack } from '@/lib/keyframes'
import { cn } from '@/lib/utils'
import { ColorRow, Section, SliderRow } from '@/editor/inspector/controls'

/** Right column: properties of the current selection. */
export function InspectorPanel() {
  const selection = usePlaybackStore((s) => s.selection)
  const clip = useProjectStore((s) => {
    if (!s.project || selection.length !== 1) return null
    return findClip(s.project, selection[0])?.clip ?? null
  })

  return (
    <aside className="w-64 shrink-0 overflow-y-auto border-l bg-sidebar">
      <div className="px-4 pb-2 pt-4 text-sm font-semibold">Inspector</div>
      {!clip ? (
        <div className="px-4">
          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-center text-xs text-muted-foreground">
            <p className="max-w-40">
              {selection.length > 1 ? `${selection.length} clips selected` : 'Select a clip to edit its properties'}
            </p>
          </div>
        </div>
      ) : (
        <ClipInspector clip={clip} />
      )}
    </aside>
  )
}

function useUpdate(clipId: string) {
  return <T extends Clip>(patch: Partial<T>) =>
    useProjectStore.getState().updateClip<T>(clipId, patch)
}

function ClipInspector({ clip }: { clip: Clip }) {
  switch (clip.type) {
    case 'video':
      return <VideoImageInspector clip={clip} hasAudio />
    case 'image':
      return <VideoImageInspector clip={clip} />
    case 'audio':
      return <AudioInspector clip={clip} />
    case 'text':
      return <TextInspector clip={clip} />
  }
}

/**
 * Transform rows with per-property keyframing (video/image only — text
 * animation isn't supported by the ASS exporter yet, so the toggle is hidden
 * there to keep preview and export identical).
 *
 * A keyframed property samples its value at the playhead and slider edits
 * write a keyframe there instead of the static transform.
 */
function TransformSection({ clip }: { clip: VideoClip | ImageClip | TextClip }) {
  const update = useUpdate(clip.id)
  const t = clip.transform
  const set = (patch: Partial<typeof t>) => update({ transform: { ...t, ...patch } })

  const allowKf = clip.type !== 'text'
  const playhead = usePlaybackStore((s) => s.currentTime)
  const localT = Math.min(Math.max(0, playhead - clip.start), clip.duration)

  const rowProps = (prop: KeyframeProp) => {
    const track = clip.keyframes[prop]
    const animated = track.length > 0
    const value = animated ? sampleTrack(track, localT, t[prop]) : t[prop]
    const onChange = (v: number) => {
      if (animated) useProjectStore.getState().setKeyframe(clip.id, prop, localT, v)
      else set({ [prop]: v })
    }
    const accessory = allowKf ? (
      <KeyframeToggle clip={clip} prop={prop} localT={localT} value={value} />
    ) : undefined
    return { value, onChange, accessory }
  }

  return (
    <Section title="Transform">
      <SliderRow label="Scale" min={0.1} max={4} {...rowProps('scale')} />
      <SliderRow label="Position X" min={-1920} max={1920} step={1} format={(v) => `${v | 0}px`} {...rowProps('x')} />
      <SliderRow label="Position Y" min={-1080} max={1080} step={1} format={(v) => `${v | 0}px`} {...rowProps('y')} />
      <SliderRow label="Rotation" min={-180} max={180} step={1} format={(v) => `${v | 0}°`} {...rowProps('rotation')} />
      <SliderRow label="Opacity" min={0} max={1} {...rowProps('opacity')} />
      {'flipH' in clip && (
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Flip</Label>
          <ToggleGroup
            type="multiple"
            variant="outline"
            size="sm"
            value={[clip.flipH ? 'h' : '', clip.flipV ? 'v' : ''].filter(Boolean)}
            onValueChange={(vals: string[]) =>
              update({ flipH: vals.includes('h'), flipV: vals.includes('v') })
            }
          >
            <ToggleGroupItem value="h" aria-label="Flip horizontal">
              <FlipHorizontal2 />
            </ToggleGroupItem>
            <ToggleGroupItem value="v" aria-label="Flip vertical">
              <FlipVertical2 />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      )}
    </Section>
  )
}

/**
 * Diamond toggle: click adds/removes a keyframe at the playhead. When the
 * property is animated a small × clears the whole track (freezing the
 * playhead value as the new static value).
 */
function KeyframeToggle({
  clip,
  prop,
  localT,
  value,
}: {
  clip: VideoClip | ImageClip | TextClip
  prop: KeyframeProp
  localT: number
  value: number
}) {
  const track = clip.keyframes[prop]
  const animated = track.length > 0
  const atPlayhead = keyframeAt(track, localT) !== undefined
  const store = useProjectStore

  return (
    <span className="flex items-center gap-0.5">
      <button
        aria-label={atPlayhead ? `Remove ${prop} keyframe` : `Add ${prop} keyframe`}
        title={atPlayhead ? 'Remove keyframe at playhead' : 'Add keyframe at playhead'}
        onClick={() => {
          if (atPlayhead) store.getState().removeKeyframe(clip.id, prop, localT)
          else store.getState().setKeyframe(clip.id, prop, localT, value)
        }}
        className={cn(
          'rounded p-0.5 transition-colors hover:bg-accent',
          animated ? 'text-primary' : 'text-muted-foreground/50 hover:text-foreground',
        )}
      >
        <Diamond className={cn('size-3', atPlayhead && 'fill-current')} />
      </button>
      {animated && (
        <button
          aria-label={`Clear ${prop} keyframes`}
          title="Clear all keyframes"
          onClick={() => store.getState().clearKeyframes(clip.id, prop)}
          className="rounded p-0.5 text-muted-foreground/50 transition-colors hover:bg-accent hover:text-destructive"
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  )
}

const SPEED_STOPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4]

function SpeedSection({ clip }: { clip: VideoClip | AudioClip }) {
  const setClipSpeed = useProjectStore((s) => s.setClipSpeed)
  return (
    <Section title="Speed">
      <Select value={String(clip.speed)} onValueChange={(v) => setClipSpeed(clip.id, Number(v))}>
        <SelectTrigger size="sm" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SPEED_STOPS.map((s) => (
            <SelectItem key={s} value={String(s)}>
              {s}×{s === 1 ? ' (normal)' : ''}
            </SelectItem>
          ))}
          {!SPEED_STOPS.includes(clip.speed) && (
            <SelectItem value={String(clip.speed)}>{clip.speed}×</SelectItem>
          )}
        </SelectContent>
      </Select>
      <p className="text-[10px] leading-snug text-muted-foreground/70">
        Changing speed keeps the source range and rescales the clip's length.
      </p>
    </Section>
  )
}

function FadeSection({ clip }: { clip: VideoClip | ImageClip | AudioClip | TextClip }) {
  const update = useUpdate(clip.id)
  const max = Math.max(0.5, clip.duration / 2)
  return (
    <Section title="Fade">
      <SliderRow label="Fade in" value={clip.fadeIn} min={0} max={max} step={0.05} format={(v) => `${v.toFixed(2)}s`} onChange={(fadeIn) => update({ fadeIn })} />
      <SliderRow label="Fade out" value={clip.fadeOut} min={0} max={max} step={0.05} format={(v) => `${v.toFixed(2)}s`} onChange={(fadeOut) => update({ fadeOut })} />
    </Section>
  )
}

function VideoImageInspector({ clip, hasAudio }: { clip: VideoClip | ImageClip; hasAudio?: boolean }) {
  const update = useUpdate(clip.id)
  const a = clip.adjustments
  const setAdj = (patch: Partial<typeof a>) => update({ adjustments: { ...a, ...patch } })

  return (
    <div>
      <TransformSection clip={clip} />
      {clip.type === 'video' && <SpeedSection clip={clip} />}
      {hasAudio && clip.type === 'video' && (
        <Section title="Audio">
          <SliderRow label="Volume" value={clip.volume} min={0} max={2} format={(v) => `${Math.round(v * 100)}%`} onChange={(volume) => update<VideoClip>({ volume })} />
          <div className="flex items-center justify-between">
            <Label className="text-[11px] text-muted-foreground">Muted</Label>
            <Switch checked={clip.muted} onCheckedChange={(muted) => update<VideoClip>({ muted })} />
          </div>
        </Section>
      )}
      <Section title="Adjust">
        <SliderRow label="Brightness" value={a.brightness} min={-1} max={1} onChange={(brightness) => setAdj({ brightness })} />
        <SliderRow label="Contrast" value={a.contrast} min={-1} max={1} onChange={(contrast) => setAdj({ contrast })} />
        <SliderRow label="Saturation" value={a.saturation} min={-1} max={1} onChange={(saturation) => setAdj({ saturation })} />
        <SliderRow label="Temperature" value={a.temperature} min={-1} max={1} onChange={(temperature) => setAdj({ temperature })} />
      </Section>
      <Section title="Filter">
        <Select
          value={clip.filter ?? 'none'}
          onValueChange={(v) => update({ filter: v === 'none' ? null : (v as ImageClip['filter']) })}
        >
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {FILTER_PRESETS.map((f) => (
              <SelectItem key={f} value={f} className="capitalize">
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Section>
      <ChromaKeySection clip={clip} />
      <CropSection clip={clip} />
      <Section title="Background">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Blur fill</Label>
          <Switch
            checked={clip.backgroundBlur}
            onCheckedChange={(backgroundBlur) => update({ backgroundBlur })}
          />
        </div>
        <p className="text-[10px] leading-snug text-muted-foreground/70">
          Fills empty canvas space with a blurred copy of this clip.
        </p>
      </Section>
      <TransitionSection clip={clip} />
      <FadeSection clip={clip} />
    </div>
  )
}

function ChromaKeySection({ clip }: { clip: VideoClip | ImageClip }) {
  const update = useUpdate(clip.id)
  const key = clip.chromaKey
  return (
    <Section title="Green screen">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] text-muted-foreground">Remove color</Label>
        <Switch
          checked={key !== null}
          onCheckedChange={(on) => update({ chromaKey: on ? { ...DEFAULT_CHROMA_KEY } : null })}
        />
      </div>
      {key && (
        <>
          <ColorRow
            label="Key color"
            value={key.color}
            onChange={(color) => color && update({ chromaKey: { ...key, color } })}
          />
          <SliderRow
            label="Similarity"
            value={key.similarity}
            min={0.01}
            max={1}
            onChange={(similarity) => update({ chromaKey: { ...key, similarity } })}
          />
          <SliderRow
            label="Smoothness"
            value={key.blend}
            min={0}
            max={1}
            onChange={(blend) => update({ chromaKey: { ...key, blend } })}
          />
        </>
      )}
    </Section>
  )
}

/** Crop expressed as edge insets — friendlier than x/y/w/h sliders. */
function CropSection({ clip }: { clip: VideoClip | ImageClip }) {
  const update = useUpdate(clip.id)
  const crop = clip.crop
  const insets = crop
    ? {
        left: crop.x,
        top: crop.y,
        right: Math.max(0, 1 - crop.x - crop.w),
        bottom: Math.max(0, 1 - crop.y - crop.h),
      }
    : { left: 0, top: 0, right: 0, bottom: 0 }

  const setInset = (patch: Partial<typeof insets>) => {
    const next = { ...insets, ...patch }
    const w = Math.max(0.05, 1 - next.left - next.right)
    const h = Math.max(0.05, 1 - next.top - next.bottom)
    update({ crop: { x: Math.min(next.left, 0.95), y: Math.min(next.top, 0.95), w, h } })
  }

  const pct = (v: number) => `${Math.round(v * 100)}%`

  return (
    <Section title="Crop">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] text-muted-foreground">Enabled</Label>
        <Switch
          checked={crop !== null}
          onCheckedChange={(on) =>
            update({ crop: on ? { x: 0, y: 0, w: 1, h: 1 } : null })
          }
        />
      </div>
      {crop && (
        <>
          <SliderRow label="Left" value={insets.left} min={0} max={0.45} format={pct} onChange={(left) => setInset({ left })} />
          <SliderRow label="Right" value={insets.right} min={0} max={0.45} format={pct} onChange={(right) => setInset({ right })} />
          <SliderRow label="Top" value={insets.top} min={0} max={0.45} format={pct} onChange={(top) => setInset({ top })} />
          <SliderRow label="Bottom" value={insets.bottom} min={0} max={0.45} format={pct} onChange={(bottom) => setInset({ bottom })} />
        </>
      )}
    </Section>
  )
}

function TransitionSection({ clip }: { clip: VideoClip | ImageClip }) {
  const update = useUpdate(clip.id)
  const tr = clip.transitionOut
  return (
    <Section title="Transition to next clip">
      <Select
        value={tr?.type ?? 'none'}
        onValueChange={(v) =>
          update({
            transitionOut:
              v === 'none' ? null : { type: v as Transition['type'], duration: tr?.duration ?? 0.5 },
          })
        }
      >
        <SelectTrigger size="sm" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">None</SelectItem>
          {TRANSITION_TYPES.map((t) => (
            <SelectItem key={t} value={t} className="capitalize">
              {t.replace('-', ' ')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {tr && (
        <SliderRow label="Duration" value={tr.duration} min={0.2} max={2} step={0.1} format={(v) => `${v.toFixed(1)}s`} onChange={(duration) => update({ transitionOut: { ...tr, duration } })} />
      )}
      <p className="text-[10px] leading-snug text-muted-foreground/70">
        Applies when the next clip starts exactly where this one ends.
      </p>
    </Section>
  )
}

function AudioInspector({ clip }: { clip: AudioClip }) {
  const update = useUpdate(clip.id)
  return (
    <div>
      <SpeedSection clip={clip} />
      <Section title="Audio">
        <SliderRow label="Volume" value={clip.volume} min={0} max={2} format={(v) => `${Math.round(v * 100)}%`} onChange={(volume) => update<AudioClip>({ volume })} />
      </Section>
      <FadeSection clip={clip} />
    </div>
  )
}

function TextInspector({ clip }: { clip: TextClip }) {
  const update = useUpdate(clip.id)
  const s = clip.style
  const setStyle = (patch: Partial<typeof s>) => update({ style: { ...s, ...patch } })

  return (
    <div>
      <Section title="Text">
        <textarea
          value={clip.text}
          onChange={(e) => update({ text: e.target.value })}
          rows={3}
          className="w-full resize-none rounded-md border bg-transparent px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring"
        />
        <Select value={s.fontFamily} onValueChange={(fontFamily) => setStyle({ fontFamily })}>
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {fontsByCategory().map((group) => (
              <SelectGroup key={group.category}>
                <SelectLabel className="text-[10px] uppercase tracking-wide">{group.label}</SelectLabel>
                {group.fonts.map((f) => (
                  <SelectItem key={f.family} value={f.family} style={{ fontFamily: f.family }}>
                    {f.family}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
        <SliderRow label="Size" value={s.fontSize} min={16} max={300} step={1} format={(v) => `${v | 0}px`} onChange={(fontSize) => setStyle({ fontSize })} />
        <div className="flex items-center gap-2">
          <ToggleGroup type="multiple" variant="outline" size="sm"
            value={[s.fontWeight === 700 ? 'bold' : '', s.italic ? 'italic' : ''].filter(Boolean)}
            onValueChange={(vals: string[]) =>
              setStyle({ fontWeight: vals.includes('bold') ? 700 : 400, italic: vals.includes('italic') })
            }
          >
            <ToggleGroupItem value="bold" aria-label="Bold"><Bold /></ToggleGroupItem>
            <ToggleGroupItem value="italic" aria-label="Italic"><Italic /></ToggleGroupItem>
          </ToggleGroup>
          <ToggleGroup type="single" variant="outline" size="sm" value={s.align}
            onValueChange={(align) => align && setStyle({ align: align as typeof s.align })}
          >
            <ToggleGroupItem value="left" aria-label="Align left"><AlignLeft /></ToggleGroupItem>
            <ToggleGroupItem value="center" aria-label="Align center"><AlignCenter /></ToggleGroupItem>
            <ToggleGroupItem value="right" aria-label="Align right"><AlignRight /></ToggleGroupItem>
          </ToggleGroup>
        </div>
        <ToggleGroup type="single" variant="outline" size="sm" value={s.textTransform}
          onValueChange={(t) => t && setStyle({ textTransform: t as typeof s.textTransform })}
        >
          {TEXT_TRANSFORMS.map((t) => (
            <ToggleGroupItem key={t} value={t} className="text-[11px] capitalize">
              {t === 'none' ? 'Aa' : t === 'uppercase' ? 'AA' : 'aa'}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <SliderRow label="Letter spacing" value={s.letterSpacing} min={-10} max={40} step={0.5} format={(v) => `${v}px`} onChange={(letterSpacing) => setStyle({ letterSpacing })} />
        <ColorRow label="Color" value={s.color} onChange={(color) => color && setStyle({ color })} />
        <ColorRow label="Background" value={s.backgroundColor} allowNone onChange={(backgroundColor) => setStyle({ backgroundColor })} />
        <ColorRow label="Outline" value={s.outlineColor} allowNone onChange={(outlineColor) => setStyle({ outlineColor })} />
        {s.outlineColor && (
          <SliderRow label="Outline width" value={s.outlineWidth} min={0} max={12} step={0.5} format={(v) => `${v}px`} onChange={(outlineWidth) => setStyle({ outlineWidth })} />
        )}
        <ColorRow
          label="Shadow"
          value={s.shadow?.color ?? null}
          allowNone
          onChange={(color) => setStyle({ shadow: color ? { color, distance: s.shadow?.distance ?? 4 } : null })}
        />
        {s.shadow && !s.backgroundColor && (
          <SliderRow label="Shadow distance" value={s.shadow.distance} min={0} max={30} step={1} format={(v) => `${v}px`}
            onChange={(distance) => setStyle({ shadow: { color: s.shadow!.color, distance } })} />
        )}
        {s.shadow && s.backgroundColor && (
          <p className="text-[11px] leading-snug text-muted-foreground">
            A background box replaces the shadow — subtitles use one colour slot for both.
          </p>
        )}
      </Section>
      <Section title="Animation">
        <AnimationRow label="In" value={clip.animationIn} onChange={(animationIn) => update({ animationIn })} />
        <AnimationRow label="Out" value={clip.animationOut} onChange={(animationOut) => update({ animationOut })} />
      </Section>
      <TransformSection clip={clip} />
      <FadeSection clip={clip} />
    </div>
  )
}

/** Entrance/exit animation picker plus its length. */
function AnimationRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: TextAnimation | null
  onChange: (v: TextAnimation | null) => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="w-8 shrink-0 text-[11px] text-muted-foreground">{label}</span>
        <Select
          value={value?.type ?? 'none'}
          onValueChange={(t) =>
            onChange(t === 'none' ? null : { type: t as TextAnimation['type'], duration: value?.duration ?? 0.5 })
          }
        >
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {TEXT_ANIMATIONS.map((t) => (
              <SelectItem key={t} value={t} className="capitalize">
                {t.replace('-', ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {value && (
        <SliderRow
          label="Length"
          value={value.duration}
          min={0.1}
          max={3}
          step={0.1}
          format={(v) => `${v.toFixed(1)}s`}
          onChange={(duration) => onChange({ ...value, duration })}
        />
      )}
    </div>
  )
}
