import { useEffect, useRef } from 'react'
import { usePlaybackStore } from '@/state/playbackStore'

/** Choose a "nice" tick interval so labels sit ≥ ~70px apart. */
function tickInterval(pxPerSecond: number): { major: number; minor: number } {
  const STEPS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600]
  for (const s of STEPS) {
    if (s * pxPerSecond >= 70) return { major: s, minor: s / 5 }
  }
  const last = STEPS[STEPS.length - 1]
  return { major: last, minor: last / 5 }
}

function formatTick(t: number): string {
  const m = Math.floor(t / 60)
  const s = t % 60
  if (t >= 60) return `${m}:${s < 10 ? '0' : ''}${Number.isInteger(s) ? s : s.toFixed(1)}`
  return Number.isInteger(s) ? `${s}s` : `${s.toFixed(1)}s`
}

interface Props {
  pxPerSecond: number
  scrollLeft: number
  width: number
  onScrub: (clientX: number) => void
  onScrubEnd?: () => void
}

export function TimeRuler({ pxPerSecond, scrollLeft, width, onScrub, onScrubEnd }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // playhead is drawn into the ruler; subscribe transiently to avoid re-render
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const draw = () => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const dpr = window.devicePixelRatio || 1
      const h = 24
      if (canvas.width !== width * dpr || canvas.height !== h * dpr) {
        canvas.width = width * dpr
        canvas.height = h * dpr
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, h)

      const { major, minor } = tickInterval(pxPerSecond)
      const t0 = scrollLeft / pxPerSecond
      const t1 = (scrollLeft + width) / pxPerSecond

      ctx.strokeStyle = 'rgba(255,255,255,0.18)'
      ctx.fillStyle = 'rgba(255,255,255,0.45)'
      ctx.font = '9px ui-monospace, monospace'
      ctx.textBaseline = 'top'
      ctx.beginPath()
      for (let t = Math.floor(t0 / minor) * minor; t <= t1; t += minor) {
        const x = Math.round(t * pxPerSecond - scrollLeft) + 0.5
        const isMajor = Math.abs(t / major - Math.round(t / major)) < 1e-6
        ctx.moveTo(x, isMajor ? 8 : 16)
        ctx.lineTo(x, h)
        if (isMajor) ctx.fillText(formatTick(Math.round(t * 1000) / 1000), x + 3, 2)
      }
      ctx.stroke()

      // playhead marker
      const playhead = usePlaybackStore.getState().currentTime
      const px = playhead * pxPerSecond - scrollLeft
      if (px >= 0 && px <= width) {
        ctx.fillStyle = 'oklch(0.62 0.21 285)'
        ctx.beginPath()
        ctx.moveTo(px - 5, 0)
        ctx.lineTo(px + 5, 0)
        ctx.lineTo(px, 8)
        ctx.closePath()
        ctx.fill()
      }
    }

    draw()
    const unsub = usePlaybackStore.subscribe(draw)
    return unsub
  }, [pxPerSecond, scrollLeft, width])

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height: 24 }}
      className="cursor-col-resize select-none"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        onScrub(e.clientX)
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) onScrub(e.clientX)
      }}
      onPointerUp={(e) => {
        e.currentTarget.releasePointerCapture(e.pointerId)
        onScrubEnd?.()
      }}
    />
  )
}
