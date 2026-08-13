import { createContext, useContext } from 'react'

/**
 * Transient drag state. While a gesture is live the store is untouched —
 * ClipViews render the preview from this context and the store commit happens
 * once on pointer-up (= one undo step).
 */
export interface Gesture {
  type: 'move' | 'trim-left' | 'trim-right'
  clipId: string
  /** preview values (already snapped) */
  start: number
  duration: number
  trackId: string
  /** time of the snap guide line to draw, if snapped */
  snapGuide: number | null
}

export interface TimelineCtx {
  gesture: Gesture | null
  setGesture: (g: Gesture | null) => void
  /** convert a pointer clientX to timeline seconds */
  timeFromClientX: (clientX: number) => number
  pxPerSecond: number
}

export const TimelineContext = createContext<TimelineCtx | null>(null)

export function useTimelineCtx(): TimelineCtx {
  const ctx = useContext(TimelineContext)
  if (!ctx) throw new Error('TimelineContext missing')
  return ctx
}
