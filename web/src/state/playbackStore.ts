import { create } from 'zustand'

/**
 * Transient playback + selection state. NOT undoable, NOT persisted.
 * The playback engine writes currentTime at rAF rate via transient access
 * (`usePlaybackStore.setState`); React components subscribe selectively.
 */
interface PlaybackState {
  currentTime: number
  isPlaying: boolean
  /** selected clip ids (timeline selection); cue selection lives in the panel */
  selection: string[]

  play: () => void
  pause: () => void
  togglePlay: () => void
  seek: (t: number) => void
  select: (clipIds: string[]) => void
  clearSelection: () => void
}

export const usePlaybackStore = create<PlaybackState>()((set) => ({
  currentTime: 0,
  isPlaying: false,
  selection: [],

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  seek: (t) => set({ currentTime: Math.max(0, t) }),
  select: (clipIds) => set({ selection: clipIds }),
  clearSelection: () => set({ selection: [] }),
}))
