import { useEffect, useState } from 'react'
import { Clapperboard, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { createAndOpenProject, useProjectStore } from '@/state/projectStore'
import * as db from '@/media/db'
import { projectDuration, type Project } from '@/schema/project'
import { formatDurationShort, formatRelativeDate } from '@/lib/format'

export function ProjectList() {
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [toDelete, setToDelete] = useState<Project | null>(null)
  const openProject = useProjectStore((s) => s.openProject)

  useEffect(() => {
    void db.listProjects().then(setProjects)
  }, [])

  const handleDelete = async () => {
    if (!toDelete) return
    await db.deleteProject(toDelete.id)
    setProjects((prev) => prev?.filter((p) => p.id !== toDelete.id) ?? null)
    setToDelete(null)
  }

  return (
    <div className="flex h-full flex-col items-center overflow-y-auto bg-background">
      <div className="w-full max-w-4xl px-6 py-14">
        <div className="mb-10 flex items-center gap-3">
          <svg width="34" height="34" viewBox="0 0 32 32" aria-hidden>
            <rect width="32" height="32" rx="7" fill="oklch(0.62 0.21 285)" />
            <path d="M9 10.5 16 22l7-11.5h-4.2L16 15.4l-2.8-4.9Z" fill="#fff" />
          </svg>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Vikado</h1>
            <p className="text-sm text-muted-foreground">
              Free, open-source video editing — right in your browser.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
          <button
            onClick={() => void createAndOpenProject()}
            className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
          >
            <Plus className="size-6" />
            New project
          </button>

          {projects?.map((p) => (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              onClick={() => openProject(p)}
              onKeyDown={(e) => e.key === 'Enter' && openProject(p)}
              className="group relative flex h-40 cursor-pointer flex-col justify-end overflow-hidden rounded-xl border bg-card p-4 transition-colors hover:border-primary/50"
            >
              <Clapperboard className="absolute right-4 top-4 size-5 text-muted-foreground/40" />
              <div className="truncate text-sm font-medium">{p.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {formatDurationShort(projectDuration(p))} · {formatRelativeDate(p.updatedAt)}
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Delete ${p.name}`}
                className="absolute bottom-3 right-3 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation()
                  setToDelete(p)
                }}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>

        {projects && projects.length === 0 && (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Projects are stored locally in your browser — nothing is uploaded until you export.
          </p>
        )}
      </div>

      <Dialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{toDelete?.name}”?</DialogTitle>
            <DialogDescription>
              This permanently removes the project from this browser. Imported media that is not
              used by other projects will be cleaned up.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
