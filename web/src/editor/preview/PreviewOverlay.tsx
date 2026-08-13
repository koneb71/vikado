import { useRef } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { usePlaybackStore } from '@/state/playbackStore'
import { findClip } from '@/lib/timelineOps'
import { sampleTransform } from '@/lib/keyframes'
import type { Clip, Transform } from '@/schema/project'

/**
 * Gizmo layer over the preview canvas: a selection outline with corner
 * handles (drag = scale), body drag = move, wheel = scale. Coordinates are
 * canvas px mapped to CSS px via the canvas' bounding rect.
 *
 * Undo semantics: temporal tracking is paused during a drag and the final
 * transform is committed as one tracked change, so one gesture = one undo.
 */
export function PreviewOverlay({ canvas }: { canvas: HTMLCanvasElement | null }) {
  const selection = usePlaybackStore((s) => s.selection)
  const clip = useProjectStore((s) => {
    if (!s.project || selection.length !== 1) return null
    const c = findClip(s.project, selection[0])?.clip ?? null
    return c && c.type !== 'audio' ? c : null
  })
  const dragRef = useRef<{
    mode: 'move' | 'scale'
    startX: number
    startY: number
    /** distance from center at gesture start (scale mode) */
    startDist: number
    origin: Transform
  } | null>(null)

  if (!clip || !canvas) return null

  const project = useProjectStore.getState().project!
  const rect = canvas.getBoundingClientRect()
  /** canvas px per CSS px */
  const k = project.width / rect.width

  // clip's drawn size in canvas px (mirrors Compositor.layerMatrix)
  const stageSize = (): { w: number; h: number } | null => {
    if (clip.type === 'text') {
      if (!clip.measuredWidth) return null
      return { w: clip.measuredWidth * clip.transform.scale, h: clip.measuredHeight * clip.transform.scale }
    }
    const asset = project.assets.find((a) => 'assetId' in clip && a.id === clip.assetId)
    if (!asset?.width || !asset.height) return null
    const fit = Math.min(project.width / asset.width, project.height / asset.height)
    return { w: asset.width * fit * clip.transform.scale, h: asset.height * fit * clip.transform.scale }
  }

  const beginDrag = (e: React.PointerEvent, mode: 'move' | 'scale') => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    const centerCss = clipCenterCss()
    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      startDist: Math.max(8, Math.hypot(e.clientX - centerCss.x, e.clientY - centerCss.y)),
      origin: { ...clip.transform },
    }
    useProjectStore.temporal.getState().pause()
  }

  const clipCenterCss = () => ({
    x: rect.left + rect.width / 2 + clip.transform.x / k,
    y: rect.top + rect.height / 2 + clip.transform.y / k,
  })

  /** Route a transform patch per property: keyframed props get a keyframe at
   * the playhead, static props update the transform. */
  const applyPatch = (patch: Partial<Transform>) => {
    const store = useProjectStore.getState()
    const kf = 'keyframes' in clip ? clip.keyframes : undefined
    const localT = Math.min(
      Math.max(0, usePlaybackStore.getState().currentTime - clip.start),
      clip.duration,
    )
    const staticPatch: Partial<Transform> = {}
    for (const [key, value] of Object.entries(patch) as [keyof Transform, number][]) {
      if (kf && kf[key].length > 0) store.setKeyframe(clip.id, key, localT, value)
      else staticPatch[key] = value
    }
    if (Object.keys(staticPatch).length) {
      store.updateClip(clip.id, { transform: { ...clip.transform, ...staticPatch } })
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    if (drag.mode === 'move') {
      applyPatch({
        x: drag.origin.x + (e.clientX - drag.startX) * k,
        y: drag.origin.y + (e.clientY - drag.startY) * k,
      })
    } else {
      const center = {
        x: rect.left + rect.width / 2 + drag.origin.x / k,
        y: rect.top + rect.height / 2 + drag.origin.y / k,
      }
      const dist = Math.hypot(e.clientX - center.x, e.clientY - center.y)
      const factor = dist / drag.startDist
      applyPatch({ scale: Math.min(4, Math.max(0.05, drag.origin.scale * factor)) })
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const drag = dragRef.current
    dragRef.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
    if (!drag) return
    const store = useProjectStore.getState()
    const current = findClip(useProjectStore.getState().project!, clip.id)?.clip
    if (!current || !('transform' in current)) {
      useProjectStore.temporal.getState().resume()
      return
    }
    // commit as ONE tracked change so undo restores the pre-drag state:
    // rewind the static transform while paused, resume, re-apply the final
    // values (keyframed props re-write their playhead keyframe)
    const props: (keyof Transform)[] = drag.mode === 'move' ? ['x', 'y'] : ['scale']
    const localT = Math.min(
      Math.max(0, usePlaybackStore.getState().currentTime - current.start),
      current.duration,
    )
    const finalValues = sampleTransform(current, localT)
    store.updateClip(clip.id, { transform: drag.origin })
    useProjectStore.temporal.getState().resume()
    const patch: Partial<Transform> = {}
    for (const prop of props) patch[prop] = finalValues[prop]
    applyPatch(patch)
  }

  const size = stageSize()
  const outline = size
    ? {
        width: size.w / k,
        height: size.h / k,
        left: rect.width / 2 + clip.transform.x / k - size.w / k / 2,
        top: rect.height / 2 + clip.transform.y / k - size.h / k / 2,
        transform: `rotate(${clip.transform.rotation}deg)`,
      }
    : null

  const HANDLES: { cx: 'left' | 'right'; cy: 'top' | 'bottom' }[] = [
    { cx: 'left', cy: 'top' },
    { cx: 'right', cy: 'top' },
    { cx: 'left', cy: 'bottom' },
    { cx: 'right', cy: 'bottom' },
  ]

  return (
    <div
      className="absolute inset-0 cursor-move"
      onPointerDown={(e) => beginDrag(e, 'move')}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={(e) => {
        const factor = e.deltaY < 0 ? 1.05 : 1 / 1.05
        const localT = Math.min(
          Math.max(0, usePlaybackStore.getState().currentTime - clip.start),
          clip.duration,
        )
        const current = sampleTransform(clip, localT).scale
        applyPatch({ scale: Math.min(4, Math.max(0.05, current * factor)) })
      }}
    >
      {outline && (
        <div
          className="pointer-events-none absolute border border-primary/90"
          style={outline}
        >
          {HANDLES.map(({ cx, cy }) => (
            <div
              key={`${cx}-${cy}`}
              onPointerDown={(e) => beginDrag(e, 'scale')}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              className="pointer-events-auto absolute size-2.5 rounded-full border border-primary bg-background"
              style={{
                [cx]: -5,
                [cy]: -5,
                cursor: (cx === 'left') === (cy === 'top') ? 'nwse-resize' : 'nesw-resize',
              }}
            />
          ))}
        </div>
      )}
      <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/50 px-2 py-0.5 text-[10px] text-white/80">
        Drag to move · handles or scroll to scale
      </div>
    </div>
  )
}

// type guard helper referenced above (keeps the selector readable)
export type SelectableClip = Exclude<Clip, { type: 'audio' }>
