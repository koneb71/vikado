import { useEffect, useRef, useState } from 'react'
import { Circle, Loader2, Mic, MicOff, Monitor, Square, Webcam } from 'lucide-react'
import { toast } from 'sonner'
import { PanelShell } from '@/editor/sidebar/Sidebar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  recordingSupport,
  startRecording,
  type RecordingSession,
} from '@/media/recording'
import { importFile } from '@/media/importMedia'
import { useProjectStore } from '@/state/projectStore'

type Phase = 'idle' | 'recording' | 'processing'

export function RecordPanel() {
  const support = recordingSupport()
  const [phase, setPhase] = useState<Phase>('idle')
  const [mic, setMic] = useState(true)
  const [elapsed, setElapsed] = useState(0)
  const sessionRef = useRef<RecordingSession | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (phase !== 'recording') return
    const started = performance.now()
    const timer = setInterval(() => setElapsed((performance.now() - started) / 1000), 500)
    return () => clearInterval(timer)
  }, [phase])

  // stop tracks if the panel unmounts mid-recording
  useEffect(() => () => sessionRef.current?.cancel(), [])

  const begin = async (source: 'screen' | 'webcam') => {
    try {
      const session = await startRecording({ source, mic })
      sessionRef.current = session
      session.onEnded(() => void finish()) // browser-side "Stop sharing"
      setPhase('recording')
      setElapsed(0)
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = session.previewStream
          void videoRef.current.play().catch(() => {})
        }
      })
    } catch (err) {
      // permission denied / cancelled picker — stay idle silently unless real error
      if (err instanceof DOMException && err.name === 'NotAllowedError') return
      toast.error('Could not start recording', {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  const finish = async () => {
    const session = sessionRef.current
    if (!session) return
    sessionRef.current = null
    setPhase('processing')
    try {
      const file = await session.stop()
      const asset = await importFile(file)
      useProjectStore.getState().addAsset(asset)
      toast.success('Recording added to media', { description: file.name })
    } catch (err) {
      toast.error('Could not save recording', {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setPhase('idle')
    }
  }

  const cancel = () => {
    sessionRef.current?.cancel()
    sessionRef.current = null
    setPhase('idle')
  }

  if (!support.screen && !support.webcam) {
    return (
      <PanelShell title="Record">
        <p className="text-xs text-muted-foreground">
          Recording isn't supported in this browser.
        </p>
      </PanelShell>
    )
  }

  return (
    <PanelShell title="Record">
      {phase === 'idle' && (
        <div className="flex flex-col gap-2">
          {support.screen && (
            <button
              onClick={() => void begin('screen')}
              className="flex items-center gap-3 rounded-lg border bg-card px-3 py-3 text-sm transition-colors hover:border-primary/60"
            >
              <Monitor className="size-4 text-muted-foreground" /> Record screen
            </button>
          )}
          {support.webcam && (
            <button
              onClick={() => void begin('webcam')}
              className="flex items-center gap-3 rounded-lg border bg-card px-3 py-3 text-sm transition-colors hover:border-primary/60"
            >
              <Webcam className="size-4 text-muted-foreground" /> Record webcam
            </button>
          )}
          <button
            onClick={() => setMic((m) => !m)}
            aria-pressed={mic}
            className={cn(
              'flex items-center gap-3 rounded-lg border px-3 py-2 text-xs transition-colors',
              mic ? 'border-primary/50 text-foreground' : 'text-muted-foreground',
            )}
          >
            {mic ? <Mic className="size-3.5" /> : <MicOff className="size-3.5" />}
            Microphone {mic ? 'on' : 'off'}
          </button>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Recordings are saved straight into your media library — nothing is uploaded.
          </p>
        </div>
      )}

      {phase === 'recording' && (
        <div className="flex flex-col gap-3">
          <video ref={videoRef} muted playsInline className="w-full rounded-lg border bg-black" />
          <div className="flex items-center gap-2">
            <Circle className="size-3 animate-pulse fill-red-500 text-red-500" />
            <span className="font-mono text-xs tabular-nums">
              {Math.floor(elapsed / 60)}:{String(Math.floor(elapsed % 60)).padStart(2, '0')}
            </span>
            <div className="ml-auto flex gap-1.5">
              <Button size="sm" variant="outline" onClick={cancel}>
                Discard
              </Button>
              <Button size="sm" onClick={() => void finish()}>
                <Square className="fill-current" /> Stop
              </Button>
            </div>
          </div>
        </div>
      )}

      {phase === 'processing' && (
        <div className="flex h-28 items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Saving recording…
        </div>
      )}
    </PanelShell>
  )
}
