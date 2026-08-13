import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'

export function SliderRow({
  label,
  value,
  min,
  max,
  step = 0.01,
  format = (v: number) => v.toFixed(2),
  onChange,
  accessory,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  format?: (v: number) => string
  onChange: (v: number) => void
  /** rendered between label and value — e.g. a keyframe toggle */
  accessory?: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-1">
        <Label className="text-[11px] text-muted-foreground">{label}</Label>
        {accessory}
        <button
          className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground/70 hover:text-foreground"
          onClick={() => onChange(min < 0 ? 0 : min === 0 && max >= 1 ? 1 : min)}
          title="Reset"
        >
          {format(value)}
        </button>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  )
}

export function ColorRow({
  label,
  value,
  onChange,
  allowNone,
}: {
  label: string
  value: string | null
  onChange: (v: string | null) => void
  allowNone?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1.5">
        {allowNone && (
          <button
            className="text-[10px] text-muted-foreground/70 hover:text-foreground"
            onClick={() => onChange(null)}
          >
            none
          </button>
        )}
        <input
          type="color"
          value={value ?? '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-8 cursor-pointer rounded border bg-transparent p-0.5"
          aria-label={label}
        />
      </div>
    </div>
  )
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5 border-b px-4 py-3 last:border-b-0">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">
        {title}
      </div>
      {children}
    </div>
  )
}
