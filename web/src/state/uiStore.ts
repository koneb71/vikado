import { create } from 'zustand'

/** Editor UI state: zoom, scrolling, snapping. Not persisted. */
interface UiState {
  /** timeline zoom: horizontal pixels per second */
  pxPerSecond: number
  /** timeline horizontal scroll, in seconds at the left edge */
  scrollTime: number
  snapping: boolean
  /** timeline dock height in px (drag-resizable) */
  timelineHeight: number
  shortcutsOpen: boolean

  setPxPerSecond: (v: number) => void
  setScrollTime: (v: number) => void
  toggleSnapping: () => void
  setTimelineHeight: (v: number) => void
  setShortcutsOpen: (open: boolean) => void
  /** zoom keeping `anchorTime` fixed at the same screen x */
  zoomAt: (factor: number, anchorTime: number) => void
}

export const MIN_PX_PER_SECOND = 2
export const MAX_PX_PER_SECOND = 500
export const MIN_TIMELINE_HEIGHT = 180
export const MAX_TIMELINE_HEIGHT = 560

export const useUiStore = create<UiState>()((set) => ({
  pxPerSecond: 60,
  scrollTime: 0,
  snapping: true,
  timelineHeight: 256,
  shortcutsOpen: false,

  setPxPerSecond: (v) =>
    set({ pxPerSecond: Math.min(MAX_PX_PER_SECOND, Math.max(MIN_PX_PER_SECOND, v)) }),
  setScrollTime: (v) => set({ scrollTime: Math.max(0, v) }),
  toggleSnapping: () => set((s) => ({ snapping: !s.snapping })),
  setTimelineHeight: (v) =>
    set({ timelineHeight: Math.min(MAX_TIMELINE_HEIGHT, Math.max(MIN_TIMELINE_HEIGHT, v)) }),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  zoomAt: (factor, anchorTime) =>
    set((s) => {
      const next = Math.min(MAX_PX_PER_SECOND, Math.max(MIN_PX_PER_SECOND, s.pxPerSecond * factor))
      // keep anchorTime at the same screen position: (anchor - scroll) * px is invariant
      const screenX = (anchorTime - s.scrollTime) * s.pxPerSecond
      const scrollTime = Math.max(0, anchorTime - screenX / next)
      return { pxPerSecond: next, scrollTime }
    }),
}))
