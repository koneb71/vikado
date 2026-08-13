import { useState } from 'react'
import { useStore } from 'zustand'
import { Undo2, Redo2, Download, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { redo, undo, useProjectStore } from '@/state/projectStore'
import { ExportDialog } from '@/export/ExportDialog'

function Logo() {
  return (
    <div className="flex items-center gap-2 px-1">
      <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="7" fill="oklch(0.62 0.21 285)" />
        <path d="M9 10.5 16 22l7-11.5h-4.2L16 15.4l-2.8-4.9Z" fill="#fff" />
      </svg>
      <span className="text-sm font-semibold tracking-tight">Vikado</span>
    </div>
  )
}

export function TopBar() {
  const [exportOpen, setExportOpen] = useState(false)
  const name = useProjectStore((s) => s.project?.name ?? '')
  const hasClips = useProjectStore((s) =>
    s.project ? s.project.tracks.some((t) => t.clips.length > 0) : false,
  )
  const renameProject = useProjectStore((s) => s.renameProject)
  const closeProject = useProjectStore((s) => s.closeProject)
  const canUndo = useStore(useProjectStore.temporal, (s) => s.pastStates.length > 0)
  const canRedo = useStore(useProjectStore.temporal, (s) => s.futureStates.length > 0)

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-sidebar px-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Back to projects" onClick={closeProject}>
            <ChevronLeft />
          </Button>
        </TooltipTrigger>
        <TooltipContent>All projects</TooltipContent>
      </Tooltip>
      <Logo />
      <Separator orientation="vertical" className="mx-1 !h-5" />
      <input
        value={name}
        onChange={(e) => renameProject(e.target.value)}
        aria-label="Project name"
        className="w-48 truncate rounded-md bg-transparent px-2 py-1 text-sm text-muted-foreground outline-none transition-colors hover:bg-accent/40 focus:bg-accent/40 focus:text-foreground"
      />
      <div className="mx-auto flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" disabled={!canUndo} onClick={undo} aria-label="Undo">
              <Undo2 />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Undo (⌘Z)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" disabled={!canRedo} onClick={redo} aria-label="Redo">
              <Redo2 />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Redo (⇧⌘Z)</TooltipContent>
        </Tooltip>
      </div>
      <Button size="sm" disabled={!hasClips} onClick={() => setExportOpen(true)}>
        <Download />
        Export
      </Button>
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
    </header>
  )
}
