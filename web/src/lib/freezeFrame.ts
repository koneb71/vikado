import type { Project, VideoClip } from '@/schema/project'
import { getObjectUrl } from '@/media/opfs'
import { importFile } from '@/media/importMedia'
import type { Asset } from '@/schema/project'

/**
 * Capture the frame a video clip shows at timeline time `t` as a PNG asset.
 * Uses a fresh off-DOM element (not the playback pool) so it works even for
 * clips that aren't loaded, and never disturbs playback.
 */
export async function captureFreezeFrame(
  project: Project,
  clip: VideoClip,
  t: number,
): Promise<Asset> {
  const asset = project.assets.find((a) => a.id === clip.assetId)
  if (!asset) throw new Error('Asset not found')

  const url = await getObjectUrl(asset.hash)
  const video = document.createElement('video')
  video.preload = 'auto'
  video.muted = true
  video.src = url
  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve()
    video.onerror = () => reject(new Error('Could not load video for freeze frame'))
  })

  const localT = Math.min(Math.max(0, t - clip.start), clip.duration)
  const sourceT = clip.sourceIn + localT * clip.speed
  video.currentTime = Math.min(sourceT, Math.max(0, (asset.duration ?? sourceT) - 0.01))
  await new Promise<void>((resolve, reject) => {
    video.onseeked = () => resolve()
    video.onerror = () => reject(new Error('Seek failed'))
  })

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  canvas.getContext('2d')!.drawImage(video, 0, 0)
  video.removeAttribute('src')
  video.load()

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Frame capture failed'))), 'image/png')
  })
  const file = new File([blob], `Freeze frame ${asset.name}.png`, { type: 'image/png' })
  return importFile(file)
}
