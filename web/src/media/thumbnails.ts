import * as db from '@/media/db'
import { getObjectUrl } from '@/media/opfs'
import type { Asset } from '@/schema/project'

/**
 * Filmstrip generation: seek a hidden video through the source and tile
 * frames horizontally into one JPEG strip, cached in IndexedDB by hash.
 */

const FRAME_HEIGHT = 44
const MAX_FRAMES = 30

const memory = new Map<string, HTMLImageElement | 'loading' | 'none'>()
const listeners = new Set<() => void>()

export function onThumbnailsReady(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Synchronous lookup for render code; kicks off loading when missing. */
export function peekThumbnails(hash: string): HTMLImageElement | null {
  const hit = memory.get(hash)
  if (hit instanceof HTMLImageElement) return hit
  if (hit === undefined) {
    memory.set(hash, 'loading')
    void loadFromDb(hash)
  }
  return null
}

async function loadFromDb(hash: string): Promise<void> {
  const entry = await db.getThumbnails(hash)
  if (!entry) {
    memory.set(hash, 'none')
    return
  }
  const img = new Image()
  img.onload = () => {
    memory.set(hash, img)
    listeners.forEach((fn) => fn())
  }
  img.src = URL.createObjectURL(entry.blob)
}

export interface ThumbnailMeta {
  frameWidth: number
  intervalS: number
  count: number
}

export function thumbnailMeta(asset: Asset): ThumbnailMeta | null {
  if (!asset.duration || !asset.width || !asset.height) return null
  const count = Math.min(MAX_FRAMES, Math.max(4, Math.ceil(asset.duration / 2)))
  return {
    frameWidth: Math.round((asset.width / asset.height) * FRAME_HEIGHT),
    intervalS: asset.duration / count,
    count,
  }
}

export async function generateThumbnails(asset: Asset): Promise<void> {
  if (asset.kind !== 'video') return
  const meta = thumbnailMeta(asset)
  if (!meta) return
  if (await db.getThumbnails(asset.hash)) return // cached

  const url = await getObjectUrl(asset.hash)
  const video = document.createElement('video')
  video.preload = 'auto'
  video.muted = true
  video.src = url
  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve()
    video.onerror = () => reject(new Error('thumbnail decode failed'))
  })

  const canvas = document.createElement('canvas')
  canvas.width = meta.frameWidth * meta.count
  canvas.height = FRAME_HEIGHT
  const ctx = canvas.getContext('2d')!

  for (let i = 0; i < meta.count; i++) {
    const t = (i + 0.5) * meta.intervalS
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve()
      video.currentTime = Math.min(t, (asset.duration ?? t) - 0.05)
    })
    ctx.drawImage(video, i * meta.frameWidth, 0, meta.frameWidth, FRAME_HEIGHT)
  }

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.7))
  video.removeAttribute('src')
  video.load()
  if (!blob) return
  await db.putThumbnails({
    hash: asset.hash,
    frameWidth: meta.frameWidth,
    frameHeight: FRAME_HEIGHT,
    intervalS: meta.intervalS,
    blob,
  })
  memory.delete(asset.hash) // force reload from db
  peekThumbnails(asset.hash)
}
