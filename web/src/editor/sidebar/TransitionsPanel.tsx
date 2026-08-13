import { PanelShell, PanelEmptyState } from '@/editor/sidebar/Sidebar'
import { TRANSITION_TYPES, type Transition } from '@/schema/project'
import { findClip } from '@/lib/timelineOps'
import { usePlaybackStore } from '@/state/playbackStore'
import { useProjectStore } from '@/state/projectStore'
import { cn } from '@/lib/utils'

export function TransitionsPanel() {
  const selection = usePlaybackStore((s) => s.selection)
  const clip = useProjectStore((s) => {
    if (!s.project || selection.length !== 1) return null
    const c = findClip(s.project, selection[0])?.clip
    return c && (c.type === 'video' || c.type === 'image') ? c : null
  })

  if (!clip) {
    return (
      <PanelShell title="Transitions">
        <PanelEmptyState message="Select the clip the transition should start from." />
      </PanelShell>
    )
  }

  const apply = (type: Transition['type'] | null) =>
    useProjectStore.getState().updateClip(clip.id, {
      transitionOut: type ? { type, duration: clip.transitionOut?.duration ?? 0.5 } : null,
    })

  return (
    <PanelShell title="Transitions">
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => apply(null)}
          className={cn(
            'rounded-lg border px-2 py-4 text-xs transition-colors hover:border-primary/60',
            !clip.transitionOut && 'border-primary bg-primary/10',
          )}
        >
          None
        </button>
        {TRANSITION_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => apply(t)}
            className={cn(
              'rounded-lg border px-2 py-4 text-xs capitalize transition-colors hover:border-primary/60',
              clip.transitionOut?.type === t && 'border-primary bg-primary/10',
            )}
          >
            {t.replace('-', ' ')}
          </button>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
        The transition plays into the next clip on the same track. Set its length in the Inspector.
      </p>
    </PanelShell>
  )
}
