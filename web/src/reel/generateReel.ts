import { toast } from 'sonner'
import type { Project } from '@/schema/project'
import { measureTextClip } from '@/state/projectStore'
import { transcribeSpan, type TranscribeJob } from '@/reel/analyze'
import { buildReelProject } from '@/reel/buildReel'
import { mapCuesToTimeline, toReelCaptions, type TimedText } from '@/reel/captions'
import { DEFAULT_REEL_OPTIONS, planReel, type ReelOptions, type ReelSource } from '@/reel/plan'

export interface GenerateProgress {
  label: string
  /** 0..1, or null while indeterminate */
  fraction: number | null
}

export interface GenerateJob {
  result: Promise<Project>
  cancel: () => void
}

/**
 * Plan the Reel, caption the videos that asked for it, and build the
 * project. Each captioned video is transcribed once, over just the stretch
 * the plan keeps, then its cues are carried onto the Reel's timeline.
 */
export function generateReel(
  name: string,
  sources: ReelSource[],
  options: Partial<ReelOptions>,
  language: string | undefined,
  onProgress: (p: GenerateProgress) => void,
): GenerateJob {
  const opts = { ...DEFAULT_REEL_OPTIONS, ...options }
  let current: TranscribeJob | null = null
  let cancelled = false

  const run = async (): Promise<Project> => {
    const plan = planReel(sources, opts)
    const captioned = sources
      .map((source, index) => ({ source, index }))
      .filter(({ source, index }) => source.captions && plan.segments.some((s) => s.source === index))

    const cues: TimedText[] = []
    for (const [n, { source, index }] of captioned.entries()) {
      if (cancelled) break
      const own = plan.segments.filter((s) => s.source === index)
      // a transition reaches half its window past each side of the cut
      const reach = opts.transition ? opts.transitionDuration / 2 : 0
      const span = {
        start: Math.max(0, Math.min(...own.map((s) => s.sourceIn)) - reach),
        end: Math.min(
          source.asset.duration ?? Infinity,
          Math.max(...own.map((s) => s.sourceIn + s.duration)) + reach,
        ),
      }
      const step = captioned.length > 1 ? ` ${n + 1}/${captioned.length}` : ''
      onProgress({ label: `Transcribing video${step}…`, fraction: 0 })
      current = transcribeSpan(source.asset, span, language, (phase, fraction) =>
        onProgress({
          label: phase === 'downloading' ? 'Downloading caption model…' : `Transcribing video${step}…`,
          fraction,
        }),
      )
      try {
        cues.push(...mapCuesToTimeline(await current.result, plan.segments, index))
      } catch (err) {
        if (cancelled) break
        toast.error(`No captions for ${source.asset.name}`, {
          description: err instanceof Error ? err.message : undefined,
        })
      } finally {
        current = null
      }
    }
    if (cancelled) throw new DOMException('Cancelled', 'AbortError')

    onProgress({ label: 'Building your Reel…', fraction: null })
    const project = buildReelProject(name, sources, plan, toReelCaptions(cues, opts.fps), opts.fps)
    for (const track of project.tracks) {
      for (const clip of track.clips) if (clip.type === 'text') measureTextClip(clip)
    }
    return project
  }

  return {
    result: run(),
    cancel: () => {
      cancelled = true
      current?.cancel()
    },
  }
}
