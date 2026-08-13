import { useEffect } from 'react'
import { redo, undo, useProjectStore } from '@/state/projectStore'
import { usePlaybackStore } from '@/state/playbackStore'
import * as clipboard from '@/lib/clipboard'
import { useUiStore } from '@/state/uiStore'
import { toast } from 'sonner'

function isEditableTarget(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable
  )
}

interface Hotkey {
  /** display string for the shortcuts dialog (⌘ shown as Ctrl on non-mac) */
  keys: string
  description: string
  match: (e: KeyboardEvent, mod: boolean) => boolean
  run: () => void
  /** when true the shortcut is listed but the browser default is kept */
  keepDefault?: boolean
}

/** Single source of truth: the handler AND the shortcuts dialog render this. */
export const HOTKEYS: Hotkey[] = [
  {
    keys: 'Space',
    description: 'Play / pause',
    match: (e) => e.key === ' ',
    run: () => usePlaybackStore.getState().togglePlay(),
  },
  {
    keys: '← / →',
    description: 'Step one frame (⇧ = 10 frames)',
    match: (e) => e.key === 'ArrowLeft' || e.key === 'ArrowRight',
    run: () => {},
  },
  {
    keys: 'Home',
    description: 'Jump to start',
    match: (e) => e.key === 'Home',
    run: () => {
      usePlaybackStore.getState().pause()
      usePlaybackStore.getState().seek(0)
    },
  },
  {
    keys: 'S',
    description: 'Split selected clips at playhead',
    match: (e, mod) => e.key.toLowerCase() === 's' && !mod,
    run: () => {
      const pb = usePlaybackStore.getState()
      for (const id of pb.selection) useProjectStore.getState().splitClip(id, pb.currentTime)
    },
  },
  {
    keys: '⌫',
    description: 'Delete selected clips',
    match: (e) => e.key === 'Delete' || e.key === 'Backspace',
    run: () => {
      const pb = usePlaybackStore.getState()
      if (pb.selection.length) {
        useProjectStore.getState().deleteClips(pb.selection)
        pb.clearSelection()
      }
    },
  },
  {
    keys: '⌘Z / ⇧⌘Z',
    description: 'Undo / redo',
    match: (e, mod) => mod && e.key.toLowerCase() === 'z',
    run: () => {},
  },
  {
    keys: '⌘C',
    description: 'Copy selected clips',
    match: (e, mod) => mod && e.key.toLowerCase() === 'c' && !e.shiftKey,
    run: () => {
      const project = useProjectStore.getState().project
      const selection = usePlaybackStore.getState().selection
      if (!project || !selection.length) return
      const n = clipboard.copyClips(project, selection)
      if (n) toast.success(`Copied ${n} clip${n > 1 ? 's' : ''}`)
    },
  },
  {
    keys: '⌘V',
    description: 'Paste clips at playhead',
    match: (e, mod) => mod && e.key.toLowerCase() === 'v' && !e.shiftKey,
    run: () => {
      if (!clipboard.hasClips()) return
      const ids = useProjectStore.getState().pasteClips(usePlaybackStore.getState().currentTime)
      if (ids.length) usePlaybackStore.getState().select(ids)
    },
  },
  {
    keys: '⌘D',
    description: 'Duplicate selected clips',
    match: (e, mod) => mod && e.key.toLowerCase() === 'd',
    run: () => {
      const selection = usePlaybackStore.getState().selection
      if (!selection.length) return
      const ids = useProjectStore.getState().duplicateClips(selection)
      if (ids.length) usePlaybackStore.getState().select(ids)
    },
  },
  {
    keys: 'Esc',
    description: 'Clear selection',
    match: (e) => e.key === 'Escape',
    run: () => usePlaybackStore.getState().clearSelection(),
    keepDefault: true,
  },
]

// registered outside HOTKEYS so the dialog doesn't list itself twice
const shortcutsToggle: Hotkey = {
  keys: '?',
  description: 'Show shortcuts',
  match: (e) => e.key === '?',
  run: () => useUiStore.getState().setShortcutsOpen(!useUiStore.getState().shortcutsOpen),
}

export function useEditorHotkeys(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e)) return
      const mod = e.metaKey || e.ctrlKey

      // undo/redo and frame-step keep bespoke handling (shift variants)
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        const pb = usePlaybackStore.getState()
        const fps = useProjectStore.getState().project?.fps ?? 30
        pb.pause()
        const frames = (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 10 : 1)
        pb.seek(pb.currentTime + frames / fps)
        return
      }

      for (const hotkey of [...HOTKEYS, shortcutsToggle]) {
        if (hotkey.match(e, mod)) {
          if (!hotkey.keepDefault) e.preventDefault()
          hotkey.run()
          return
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
