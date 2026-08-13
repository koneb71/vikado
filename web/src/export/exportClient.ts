import type { Project } from '@/schema/project'
import type { RenderOptions } from '@/generated/RenderOptions'
import { getFile } from '@/media/opfs'

export const DEFAULT_RENDER_OPTIONS: RenderOptions = { quality: 'high', scale: 1 }

/**
 * Talks to the vikado-server render API:
 * create job → upload source files by hash → submit project → SSE progress →
 * download URL. Stateless per export; jobs expire server-side.
 */

const API = '/api/v1'

export interface ExportProgress {
  phase: 'uploading' | 'rendering' | 'done' | 'failed' | 'canceled'
  /** 0..1 within the current phase */
  progress: number
  error?: { code: string; message: string }
}

export interface ExportHandle {
  cancel: () => void
  downloadUrl: Promise<string>
}

interface JobStatus {
  status: 'created' | 'queued' | 'rendering' | 'done' | 'failed' | 'canceled'
  progress: number
  error?: { code: string; message: string }
}

export function startExport(
  project: Project,
  onProgress: (p: ExportProgress) => void,
  options: RenderOptions = DEFAULT_RENDER_OPTIONS,
): ExportHandle {
  let jobId: string | null = null
  let canceled = false
  let eventSource: EventSource | null = null

  const cancel = () => {
    canceled = true
    eventSource?.close()
    if (jobId) void fetch(`${API}/jobs/${jobId}`, { method: 'DELETE' })
    onProgress({ phase: 'canceled', progress: 0 })
  }

  const downloadUrl = (async () => {
    // 1. create job
    const created = await fetch(`${API}/jobs`, { method: 'POST' })
    if (!created.ok) throw new Error(`Render service unreachable (${created.status})`)
    const { job_id } = (await created.json()) as { job_id: string }
    jobId = job_id
    if (canceled) throw new Error('canceled')

    // 2. upload each referenced asset (dedupe by hash)
    const hashes = new Map<string, string>() // hash → asset id (for errors)
    for (const track of project.tracks) {
      for (const clip of track.clips) {
        if ('assetId' in clip) {
          const asset = project.assets.find((a) => a.id === clip.assetId)
          if (asset) hashes.set(asset.hash, asset.id)
        }
      }
    }
    let uploaded = 0
    for (const hash of hashes.keys()) {
      if (canceled) throw new Error('canceled')
      const file = await getFile(hash)
      const form = new FormData()
      form.append(hash, file, hash)
      const res = await fetch(`${API}/jobs/${job_id}/assets`, { method: 'POST', body: form })
      if (!res.ok) throw new Error(`Upload failed (${res.status})`)
      uploaded += 1
      onProgress({ phase: 'uploading', progress: uploaded / Math.max(1, hashes.size) })
    }

    // 3. submit render
    const render = await fetch(`${API}/jobs/${job_id}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project, options }),
    })
    if (!render.ok) {
      const err = (await render.json().catch(() => null)) as { message?: string } | null
      throw new Error(err?.message ?? `Render request failed (${render.status})`)
    }

    // 4. progress via SSE, polling as fallback
    onProgress({ phase: 'rendering', progress: 0 })
    await new Promise<void>((resolve, reject) => {
      const finish = (status: JobStatus) => {
        if (status.status === 'done') {
          onProgress({ phase: 'rendering', progress: 1 })
          resolve()
          return true
        }
        if (status.status === 'failed') {
          reject(
            Object.assign(new Error(status.error?.message ?? 'Render failed'), {
              code: status.error?.code,
            }),
          )
          return true
        }
        if (status.status === 'canceled') {
          reject(new Error('canceled'))
          return true
        }
        onProgress({ phase: 'rendering', progress: status.progress })
        return false
      }

      eventSource = new EventSource(`${API}/jobs/${job_id}/events`)
      eventSource.onmessage = (e) => {
        const status = JSON.parse(e.data) as JobStatus
        if (finish(status)) eventSource?.close()
      }
      eventSource.onerror = () => {
        // SSE dropped — fall back to polling
        eventSource?.close()
        const poll = setInterval(() => {
          void fetch(`${API}/jobs/${job_id}`)
            .then((r) => r.json())
            .then((status: JobStatus) => {
              if (finish(status)) clearInterval(poll)
            })
            .catch(() => {
              clearInterval(poll)
              reject(new Error('Lost connection to render service'))
            })
        }, 1000)
      }
    })

    onProgress({ phase: 'done', progress: 1 })
    return `${API}/jobs/${job_id}/download`
  })()

  downloadUrl.catch(() => {}) // surfaced via onProgress/error in the dialog

  return { cancel, downloadUrl }
}
