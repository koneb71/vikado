import { nanoid } from 'nanoid'
import type { Asset } from '@/schema/project'
import { getObjectUrl, requestPersistence, storeFile } from '@/media/opfs'
import { probeFile } from '@/media/probe'
import { generateThumbnails } from '@/media/thumbnails'
import { generateWaveform } from '@/media/waveforms'

/**
 * Import a file: content-hash → OPFS → probe metadata → Asset.
 * Throws with a user-facing message for unsupported/undecodable files.
 */
export async function importFile(file: File): Promise<Asset> {
  await requestPersistence()
  const { hash } = await storeFile(file)
  const url = await getObjectUrl(hash)
  const probe = await probeFile(file, url)

  const asset: Asset = {
    id: nanoid(),
    kind: probe.kind,
    name: file.name,
    hash,
    duration: probe.duration,
    width: probe.width,
    height: probe.height,
    fps: probe.fps,
    hasAudio: probe.hasAudio,
    mimeType: file.type,
  }

  // fire-and-forget: clip strips fill in as these complete
  void generateThumbnails(asset).catch(() => {})
  void generateWaveform(asset).catch(() => {})

  return asset
}

export const ACCEPTED_MIME = 'video/*,audio/*,image/*'
