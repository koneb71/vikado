import * as db from '@/media/db'
import { getFile } from '@/media/opfs'
import type { Asset } from '@/schema/project'

/**
 * Waveform peaks: min/max pairs at BUCKETS_PER_SECOND, cached by hash.
 * Layout: Float32Array [min0, max0, min1, max1, ...]
 */

export const BUCKETS_PER_SECOND = 50

const memory = new Map<string, Float32Array | 'loading' | 'none'>()
const listeners = new Set<() => void>()

export function onWaveformReady(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function peekWaveform(hash: string): Float32Array | null {
  const hit = memory.get(hash)
  if (hit instanceof Float32Array) return hit
  if (hit === undefined) {
    memory.set(hash, 'loading')
    void loadFromDb(hash)
  }
  return null
}

async function loadFromDb(hash: string): Promise<void> {
  const entry = await db.getWaveform(hash)
  if (!entry) {
    memory.set(hash, 'none')
    return
  }
  memory.set(hash, entry.peaks)
  listeners.forEach((fn) => fn())
}

export async function generateWaveform(asset: Asset): Promise<void> {
  if (!asset.hasAudio && asset.kind !== 'audio') return
  if (await db.getWaveform(asset.hash)) return // cached

  const file = await getFile(asset.hash)
  const buf = await file.arrayBuffer()
  const audioCtx = new OfflineAudioContext(1, 1, 44100)
  let decoded: AudioBuffer
  try {
    decoded = await audioCtx.decodeAudioData(buf)
  } catch {
    return // no decodable audio track
  }

  const channel = decoded.getChannelData(0)
  const bucketSize = Math.floor(decoded.sampleRate / BUCKETS_PER_SECOND)
  const buckets = Math.ceil(channel.length / bucketSize)
  const peaks = new Float32Array(buckets * 2)
  for (let b = 0; b < buckets; b++) {
    let min = 1
    let max = -1
    const end = Math.min(channel.length, (b + 1) * bucketSize)
    for (let i = b * bucketSize; i < end; i++) {
      const v = channel[i]
      if (v < min) min = v
      if (v > max) max = v
    }
    peaks[b * 2] = min
    peaks[b * 2 + 1] = max
  }

  await db.putWaveform({ hash: asset.hash, bucketsPerSecond: BUCKETS_PER_SECOND, peaks })
  memory.set(asset.hash, peaks)
  listeners.forEach((fn) => fn())
}
