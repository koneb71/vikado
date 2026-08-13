import { PanelShell, PanelEmptyState } from '@/editor/sidebar/Sidebar'
import { FILTER_PRESETS } from '@/schema/project'
import { findClip } from '@/lib/timelineOps'
import { usePlaybackStore } from '@/state/playbackStore'
import { useProjectStore } from '@/state/projectStore'
import { cn } from '@/lib/utils'

export function FiltersPanel() {
  const selection = usePlaybackStore((s) => s.selection)
  const clip = useProjectStore((s) => {
    if (!s.project || selection.length !== 1) return null
    const c = findClip(s.project, selection[0])?.clip
    return c && (c.type === 'video' || c.type === 'image') ? c : null
  })

  if (!clip) {
    return (
      <PanelShell title="Filters">
        <PanelEmptyState message="Select a video or image clip to apply filters." />
      </PanelShell>
    )
  }

  const apply = (filter: (typeof FILTER_PRESETS)[number] | null) =>
    useProjectStore.getState().updateClip(clip.id, { filter })

  return (
    <PanelShell title="Filters">
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => apply(null)}
          className={cn(
            'rounded-lg border px-2 py-4 text-xs capitalize transition-colors hover:border-primary/60',
            clip.filter === null && 'border-primary bg-primary/10',
          )}
        >
          None
        </button>
        {FILTER_PRESETS.map((f) => (
          <button
            key={f}
            onClick={() => apply(f)}
            className={cn(
              'rounded-lg border px-2 py-4 text-xs capitalize transition-colors hover:border-primary/60',
              clip.filter === f && 'border-primary bg-primary/10',
            )}
          >
            {f}
          </button>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
        Fine-tune brightness, contrast, saturation and temperature in the Inspector.
      </p>
    </PanelShell>
  )
}
