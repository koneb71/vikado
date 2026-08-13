import type { ComponentType } from 'react'
import {
  Clapperboard,
  Type,
  Captions,
  Disc,
  Palette,
  ArrowLeftRight,
  Settings2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { MediaPanel } from '@/editor/sidebar/MediaPanel'
import { RecordPanel } from '@/editor/sidebar/RecordPanel'
import { TextPanel } from '@/editor/sidebar/TextPanel'
import { SubtitlesPanel } from '@/editor/sidebar/SubtitlesPanel'
import { FiltersPanel } from '@/editor/sidebar/FiltersPanel'
import { TransitionsPanel } from '@/editor/sidebar/TransitionsPanel'
import { SettingsPanel } from '@/editor/sidebar/SettingsPanel'
import { recordingSupport } from '@/media/recording'

export type SidebarTab =
  | 'media'
  | 'record'
  | 'text'
  | 'subtitles'
  | 'filters'
  | 'transitions'
  | 'settings'

const CAN_RECORD = (() => {
  const s = recordingSupport()
  return s.screen || s.webcam
})()

const TABS: { id: SidebarTab; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: 'media', label: 'Media', icon: Clapperboard },
  ...(CAN_RECORD ? [{ id: 'record' as const, label: 'Record', icon: Disc }] : []),
  { id: 'text', label: 'Text', icon: Type },
  { id: 'subtitles', label: 'Subtitles', icon: Captions },
  { id: 'filters', label: 'Filters', icon: Palette },
  { id: 'transitions', label: 'Transitions', icon: ArrowLeftRight },
  { id: 'settings', label: 'Settings', icon: Settings2 },
]

const PANELS: Record<SidebarTab, ComponentType> = {
  media: MediaPanel,
  record: RecordPanel,
  text: TextPanel,
  subtitles: SubtitlesPanel,
  filters: FiltersPanel,
  transitions: TransitionsPanel,
  settings: SettingsPanel,
}

export function Sidebar({ tab, onTabChange }: { tab: SidebarTab; onTabChange: (t: SidebarTab) => void }) {
  const Panel = PANELS[tab]
  return (
    <div className="flex shrink-0 border-r bg-sidebar">
      <nav className="flex w-[68px] flex-col items-center gap-1 border-r py-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <Tooltip key={id} delayDuration={400}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onTabChange(id)}
                aria-pressed={tab === id}
                className={cn(
                  'flex w-14 flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-medium transition-colors',
                  tab === id
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                )}
              >
                <Icon className="size-5" />
                {label}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{label}</TooltipContent>
          </Tooltip>
        ))}
      </nav>
      <div className="w-72 overflow-y-auto">
        <Panel />
      </div>
    </div>
  )
}

export function PanelShell({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-2 pt-4 text-sm font-semibold">{title}</div>
      <div className="min-h-0 flex-1 px-4 pb-4">{children}</div>
    </div>
  )
}

export function PanelEmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-center text-xs text-muted-foreground">
      <p className="max-w-48">{message}</p>
    </div>
  )
}
