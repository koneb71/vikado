import { nanoid } from 'nanoid'
import type { SubtitleCue } from '@/schema/project'

/** "00:01:02,345" → seconds. Also accepts '.' as the ms separator. */
function parseTimestamp(ts: string): number | null {
  const m = /^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})$/.exec(ts.trim())
  if (!m) return null
  return (
    Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4].padEnd(3, '0')) / 1000
  )
}

function formatTimestamp(s: number): string {
  const ms = Math.round(s * 1000)
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const sec = Math.floor((ms % 60_000) / 1000)
  const rem = ms % 1000
  const p = (n: number, w: number) => String(n).padStart(w, '0')
  return `${p(h, 2)}:${p(m, 2)}:${p(sec, 2)},${p(rem, 3)}`
}

/** Lenient SRT parser: blank-line separated blocks, optional index line. */
export function parseSrt(content: string): SubtitleCue[] {
  const cues: SubtitleCue[] = []
  const blocks = content.replace(/\r\n/g, '\n').replace(/^﻿/, '').split(/\n\n+/)
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim() !== '')
    if (lines.length === 0) continue
    let i = 0
    if (/^\d+$/.test(lines[0].trim())) i = 1 // index line
    const timing = lines[i]
    if (!timing) continue
    const parts = timing.split('-->')
    if (parts.length !== 2) continue
    const start = parseTimestamp(parts[0])
    const end = parseTimestamp(parts[1])
    if (start === null || end === null || end <= start) continue
    const text = lines
      .slice(i + 1)
      .join('\n')
      .replace(/<[^>]+>/g, '') // strip inline tags
      .trim()
    if (text) cues.push({ id: nanoid(), start, end, text })
  }
  return cues.sort((a, b) => a.start - b.start)
}

export function serializeSrt(cues: SubtitleCue[]): string {
  return [...cues]
    .sort((a, b) => a.start - b.start)
    .map(
      (cue, i) =>
        `${i + 1}\n${formatTimestamp(cue.start)} --> ${formatTimestamp(cue.end)}\n${cue.text}`,
    )
    .join('\n\n')
    .concat('\n')
}
