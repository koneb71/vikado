import fixWebmDuration from 'fix-webm-duration'

/**
 * Screen / webcam capture into the media library via MediaRecorder.
 *
 * The recorded File flows through the normal importFile() pipeline. Chrome's
 * WebM output carries no Duration header — fixed post-hoc with
 * fix-webm-duration (probe.ts additionally has a seek-to-end backstop for any
 * streamed WebM). Frame-accurate Cues are not written; seeking relies on the
 * browser's demuxer, which is fine at recording lengths.
 */

export interface RecordingOptions {
  source: 'screen' | 'webcam'
  /** mix a microphone track in */
  mic: boolean
}

export interface RecordingSession {
  /** live stream for the panel's preview <video> (muted!) */
  previewStream: MediaStream
  mimeType: string
  /** fires when the user stops sharing from the browser UI */
  onEnded: (cb: () => void) => void
  /** stop and produce the final file */
  stop: () => Promise<File>
  /** discard everything */
  cancel: () => void
}

export function recordingSupport(): { screen: boolean; webcam: boolean } {
  const hasRecorder = typeof MediaRecorder !== 'undefined'
  return {
    screen: hasRecorder && !!navigator.mediaDevices?.getDisplayMedia,
    webcam: hasRecorder && !!navigator.mediaDevices?.getUserMedia,
  }
}

const CODEC_PREFERENCE = [
  'video/mp4;codecs=avc1',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
]

function pickMimeType(): string {
  for (const t of CODEC_PREFERENCE) {
    if (MediaRecorder.isTypeSupported(t)) return t
  }
  return '' // let the browser decide
}

/** container mime without codec params — what the File/Asset carries */
function baseMime(mimeType: string): string {
  const base = mimeType.split(';')[0]
  return base || 'video/webm'
}

export async function startRecording(opts: RecordingOptions): Promise<RecordingSession> {
  // capture streams
  let capture: MediaStream
  if (opts.source === 'screen') {
    capture = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
  } else {
    capture = await navigator.mediaDevices.getUserMedia({ video: true, audio: !opts.mic })
  }

  let micStream: MediaStream | null = null
  if (opts.mic) {
    micStream = await navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      .catch(() => null)
  }

  // mix audio when we have more than one source; pass through when 0/1
  const videoTrack = capture.getVideoTracks()[0]
  const audioTracks = [...capture.getAudioTracks(), ...(micStream?.getAudioTracks() ?? [])]
  let mixCtx: AudioContext | null = null
  let recordedAudio: MediaStreamTrack[] = audioTracks

  if (audioTracks.length > 1) {
    mixCtx = new AudioContext()
    const dest = mixCtx.createMediaStreamDestination()
    for (const track of audioTracks) {
      mixCtx.createMediaStreamSource(new MediaStream([track])).connect(dest)
    }
    recordedAudio = dest.stream.getAudioTracks()
  }

  const recorderStream = new MediaStream([videoTrack, ...recordedAudio])
  const mimeType = pickMimeType()
  const recorder = new MediaRecorder(recorderStream, mimeType ? { mimeType } : undefined)
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  const startedAt = performance.now()
  recorder.start(1000) // 1s timeslice: a crash loses at most a second

  const releaseTracks = () => {
    for (const t of [...capture.getTracks(), ...(micStream?.getTracks() ?? [])]) t.stop()
    void mixCtx?.close().catch(() => {})
  }

  const stopRecorder = () =>
    new Promise<void>((resolve) => {
      if (recorder.state === 'inactive') return resolve()
      recorder.onstop = () => resolve()
      recorder.stop()
    })

  return {
    previewStream: new MediaStream([videoTrack]),
    mimeType: baseMime(recorder.mimeType || mimeType),
    onEnded: (cb) => {
      videoTrack.addEventListener('ended', cb)
    },
    stop: async () => {
      await stopRecorder()
      const durationMs = performance.now() - startedAt
      releaseTracks()
      const type = baseMime(recorder.mimeType || mimeType)
      let blob = new Blob(chunks, { type })
      if (type === 'video/webm') {
        // patch the missing Duration header (Chrome/Firefox MediaRecorder)
        blob = await fixWebmDuration(blob, durationMs, { logger: false }).catch(() => blob)
      }
      const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)
      const ext = type === 'video/mp4' ? 'mp4' : 'webm'
      const name = `${opts.source === 'screen' ? 'Screen' : 'Webcam'} recording ${stamp}.${ext}`
      return new File([blob], name, { type })
    },
    cancel: () => {
      void stopRecorder().then(releaseTracks)
    },
  }
}
