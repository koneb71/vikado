import type { Asset } from '@/schema/project'
import { getObjectUrl } from '@/media/opfs'

interface PoolEntry {
  element: HTMLVideoElement | HTMLAudioElement | HTMLImageElement
  ready: Promise<void>
  lastUsed: number
}

const MAX_LIVE_VIDEOS = 6

/**
 * Off-DOM media elements per asset, sourced from OPFS blob URLs.
 * Video elements are LRU-capped; images/audio are cheap and kept.
 */
export class MediaPool {
  private entries = new Map<string, PoolEntry>()
  private onEvict?: (assetId: string) => void

  constructor(opts?: { onEvict?: (assetId: string) => void }) {
    this.onEvict = opts?.onEvict
  }
  private pending = new Map<string, Promise<PoolEntry>>()

  /**
   * `key` defaults to the asset id. Audio-only clips pass their own key so a
   * detached audio clip gets a SEPARATE element from the video clip sharing
   * its asset — one shared element would be seek-fought between the two.
   */
  async acquire(asset: Asset, key: string = asset.id): Promise<PoolEntry['element']> {
    let entry = this.entries.get(key)
    if (!entry) {
      // dedupe concurrent acquires (the render loop retries every tick)
      let creating = this.pending.get(key)
      if (!creating) {
        creating = this.create(asset)
        this.pending.set(key, creating)
        creating
          .then((e) => {
            this.entries.set(key, e)
            this.evictIfNeeded()
          })
          .catch(() => {}) // failed loads retry on a later tick
          .finally(() => this.pending.delete(key))
      }
      entry = await creating
    }
    entry.lastUsed = performance.now()
    await entry.ready
    return entry.element
  }

  /** Synchronous lookup for the render loop (no await in rAF). */
  peek(key: string): PoolEntry['element'] | null {
    const entry = this.entries.get(key)
    if (entry) entry.lastUsed = performance.now()
    return entry?.element ?? null
  }

  private async create(asset: Asset): Promise<PoolEntry> {
    const url = await getObjectUrl(asset.hash)

    if (asset.kind === 'image') {
      const img = new Image()
      const ready = new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error(`Could not load image ${asset.name}`))
      })
      img.src = url
      return { element: img, ready, lastUsed: performance.now() }
    }

    const el = document.createElement(asset.kind === 'video' ? 'video' : 'audio')
    el.preload = 'auto'
    el.crossOrigin = 'anonymous'
    el.muted = false
    const ready = new Promise<void>((resolve, reject) => {
      el.onloadeddata = () => resolve()
      el.onerror = () => reject(new Error(`Could not load ${asset.kind} ${asset.name}`))
    })
    el.src = url
    return { element: el, ready, lastUsed: performance.now() }
  }

  private evictIfNeeded(): void {
    const videos = [...this.entries.entries()].filter(
      ([, e]) => e.element instanceof HTMLVideoElement,
    )
    if (videos.length <= MAX_LIVE_VIDEOS) return
    videos.sort((a, b) => a[1].lastUsed - b[1].lastUsed)
    for (const [id, entry] of videos.slice(0, videos.length - MAX_LIVE_VIDEOS)) {
      const el = entry.element as HTMLVideoElement
      this.onEvict?.(id) // tear down audio-graph nodes before the element dies
      el.pause()
      el.removeAttribute('src')
      el.load()
      this.entries.delete(id)
    }
  }

  /** Iterate audio-capable elements (video/audio) currently in the pool. */
  forEachMedia(fn: (assetId: string, el: HTMLVideoElement | HTMLAudioElement) => void): void {
    for (const [id, { element }] of this.entries) {
      if (element instanceof HTMLVideoElement || element instanceof HTMLAudioElement) {
        fn(id, element)
      }
    }
  }

  pauseAll(): void {
    for (const { element } of this.entries.values()) {
      if (element instanceof HTMLVideoElement || element instanceof HTMLAudioElement) {
        element.pause()
      }
    }
  }

  dispose(): void {
    this.pauseAll()
    this.entries.clear()
  }
}
