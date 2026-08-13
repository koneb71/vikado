import { useState } from 'react'
import { TopBar } from '@/editor/TopBar'
import { Sidebar, type SidebarTab } from '@/editor/sidebar/Sidebar'
import { PreviewArea } from '@/editor/preview/PreviewArea'
import { InspectorPanel } from '@/editor/inspector/InspectorPanel'
import { TimelinePanel } from '@/editor/timeline/TimelinePanel'
import { useEditorHotkeys } from '@/editor/useEditorHotkeys'
import { ShortcutsDialog } from '@/editor/ShortcutsDialog'

/**
 * VEED-style shell:
 *  ┌──────────────────────── TopBar ────────────────────────┐
 *  │ rail │ panel │        preview        │    inspector    │
 *  │      │       ├──────── transport ────┤                 │
 *  ├──────┴───────┴───────── timeline ────┴─────────────────┤
 */
export function EditorLayout() {
  const [tab, setTab] = useState<SidebarTab>('media')
  useEditorHotkeys()

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar tab={tab} onTabChange={setTab} />
        <main className="flex min-w-0 flex-1 flex-col">
          <PreviewArea />
        </main>
        <InspectorPanel />
      </div>
      <TimelinePanel />
      <ShortcutsDialog />
    </div>
  )
}
