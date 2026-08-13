import type { Asset } from '@/schema/project'
import { getFile } from '@/media/opfs'

export const WHISPER_SAMPLE_RATE = 16_000

/** Sources longer than this get a warning (decodeAudioData peaks RAM). */
export const PCM_WARN_DURATION_S = 30 * 60

/**
 * Decode an asset's audio to mono 16 kHz PCM and slice [sourceIn, sourceIn +
 * duration] — the range a clip actually plays. Whisper consumes exactly this
 * format. OfflineAudioContext resamples to the context rate during decode.
 */
export async function extractPcm16k(
  asset: Asset,
  sourceIn: number,
  duration: number,
): Promise<Float32Array> {
  const file = await getFile(asset.hash)
  const buf = await file.arrayBuffer()
  const ctx = new OfflineAudioContext(1, 1, WHISPER_SAMPLE_RATE)
  const decoded = await ctx.decodeAudioData(buf)

  // downmix to mono by averaging channels
  const length = decoded.length
  const mono = new Float32Array(length)
  for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
    const data = decoded.getChannelData(ch)
    for (let i = 0; i < length; i++) mono[i] += data[i]
  }
  if (decoded.numberOfChannels > 1) {
    for (let i = 0; i < length; i++) mono[i] /= decoded.numberOfChannels
  }

  const start = Math.max(0, Math.floor(sourceIn * decoded.sampleRate))
  const end = Math.min(length, Math.ceil((sourceIn + duration) * decoded.sampleRate))
  return mono.slice(start, end)
}
