import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { HOTKEYS } from '@/editor/useEditorHotkeys'
import { useUiStore } from '@/state/uiStore'

const EXTRA_ROWS: { keys: string; description: string }[] = [
  { keys: '⌘ + scroll', description: 'Zoom the timeline at the cursor' },
  { keys: 'Scroll on preview', description: 'Scale the selected clip' },
  { keys: '?', description: 'Show this dialog' },
]

export function ShortcutsDialog() {
  const open = useUiStore((s) => s.shortcutsOpen)
  const setOpen = useUiStore((s) => s.setShortcutsOpen)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Work faster in the editor.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5">
          {[...HOTKEYS.map(({ keys, description }) => ({ keys, description })), ...EXTRA_ROWS].map(
            (row) => (
              <div key={row.keys} className="contents">
                <kbd className="justify-self-start rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                  {row.keys}
                </kbd>
                <span className="self-center text-xs">{row.description}</span>
              </div>
            ),
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
