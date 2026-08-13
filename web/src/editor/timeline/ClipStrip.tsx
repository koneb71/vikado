import { useEffect, useRef } from 'react'
import type { Asset, Clip } from '@/schema/project'
import { useProjectStore } from '@/state/projectStore'
import { onThumbnailsReady, peekThumbnails, thumbnailMeta } from '@/media/thumbnails'
import { BUCKETS_PER_SECOND, onWaveformReady, peekWaveform } from '@/media/waveforms'

/**
 * The filmstrip / waveform inside a clip. Canvas sized to the clip's on-screen
 * box; redrawn on zoom, trim and when async generation completes.
 */
export function ClipStrip({
  clip,
  width,
  height,
}: {
  clip: Clip
  width: number
  height: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const assetId = 'assetId' in clip ? clip.assetId : null
  const asset = useProjectStore((s) =>
    assetId ? (s.project?.assets.find((a) => a.id === assetId) ?? null) : null,
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !asset) return

    const draw = () => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const dpr = window.devicePixelRatio || 1
      const w = Math.max(1, Math.round(width))
      const h = Math.max(1, Math.round(height))
      if (canvas.width !== w * dpr) canvas.width = w * dpr
      if (canvas.height !== h * dpr) canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      if (clip.type === 'video' || clip.type === 'image') drawFilmstrip(ctx, clip, asset, w, h)
      if (clip.type === 'audio' || (clip.type === 'video' && asset.hasAudio)) {
        drawWaveform(ctx, clip, asset, w, h, clip.type === 'video')
      }
    }

    draw()
    const un1 = onThumbnailsReady(draw)
    const un2 = onWaveformReady(draw)
    return () => {
      un1()
      un2()
    }
  }, [clip, asset, width, height])

  return <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-hidden />
}

function drawFilmstrip(
  ctx: CanvasRenderingContext2D,
  clip: Clip,
  asset: Asset,
  w: number,
  h: number,
) {
  const img = peekThumbnails(asset.hash)
  const meta = thumbnailMeta(asset)
  if (!img || !meta) return

  const sourceIn = 'sourceIn' in clip ? clip.sourceIn : 0
  const pps = w / clip.duration // on-screen px per timeline second
  const frameW = meta.frameWidth * (h / 44)

  for (let x = 0; x < w; x += frameW) {
    const t = sourceIn + x / pps
    const frame = Math.min(meta.count - 1, Math.floor(t / meta.intervalS))
    ctx.drawImage(img, frame * meta.frameWidth, 0, meta.frameWidth, 44, x, 0, frameW, h)
  }
}

function drawWaveform(
  ctx: CanvasRenderingContext2D,
  clip: Clip,
  asset: Asset,
  w: number,
  h: number,
  overlay: boolean,
) {
  const peaks = peekWaveform(asset.hash)
  if (!peaks) return
  const buckets = peaks.length / 2
  const sourceIn = 'sourceIn' in clip ? clip.sourceIn : 0

  const yMid = overlay ? h * 0.82 : h / 2
  const amp = overlay ? h * 0.16 : h * 0.42

  ctx.fillStyle = overlay ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.65)'
  ctx.beginPath()
  for (let x = 0; x < w; x++) {
    const t = sourceIn + (x / w) * clip.duration
    const b = Math.floor(t * BUCKETS_PER_SECOND)
    if (b >= buckets) break
    const min = peaks[b * 2]
    const max = peaks[b * 2 + 1]
    ctx.rect(x, yMid + min * amp, 1, Math.max(1, (max - min) * amp))
  }
  ctx.fill()
}
