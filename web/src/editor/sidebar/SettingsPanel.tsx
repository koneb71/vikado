import { PanelShell } from '@/editor/sidebar/Sidebar'
import { useProjectStore } from '@/state/projectStore'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const RESOLUTIONS = [
  { label: 'Landscape 1080p (1920×1080)', width: 1920, height: 1080 },
  { label: 'Landscape 720p (1280×720)', width: 1280, height: 720 },
  { label: 'Portrait (1080×1920)', width: 1080, height: 1920 },
  { label: 'Square (1080×1080)', width: 1080, height: 1080 },
]

const FRAMERATES = [24, 25, 30, 50, 60]

export function SettingsPanel() {
  const project = useProjectStore((s) => s.project)
  const updateSettings = useProjectStore((s) => s.updateSettings)
  if (!project) return null

  const resValue = `${project.width}x${project.height}`

  return (
    <PanelShell title="Project settings">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">Canvas size</Label>
          <Select
            value={resValue}
            onValueChange={(v) => {
              const [w, h] = v.split('x').map(Number)
              updateSettings({ width: w, height: h })
            }}
          >
            <SelectTrigger size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RESOLUTIONS.map((r) => (
                <SelectItem key={r.label} value={`${r.width}x${r.height}`}>
                  {r.label}
                </SelectItem>
              ))}
              {!RESOLUTIONS.some((r) => `${r.width}x${r.height}` === resValue) && (
                <SelectItem value={resValue}>
                  Custom ({project.width}×{project.height})
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">Frame rate</Label>
          <Select
            value={String(project.fps)}
            onValueChange={(v) => updateSettings({ fps: Number(v) })}
          >
            <SelectTrigger size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FRAMERATES.map((f) => (
                <SelectItem key={f} value={String(f)}>
                  {f} fps
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Background</Label>
          <input
            type="color"
            value={project.canvasBackground}
            onChange={(e) => updateSettings({ canvasBackground: e.target.value })}
            className="h-6 w-8 cursor-pointer rounded border bg-transparent p-0.5"
            aria-label="Canvas background color"
          />
        </div>

        <p className="text-[11px] leading-snug text-muted-foreground">
          Exports render at the canvas size. Position and text sizes are defined in canvas pixels.
        </p>
      </div>
    </PanelShell>
  )
}
