import { describe, expect, it } from 'vitest'
import { parseSrt, serializeSrt } from '@/lib/srt'

const SAMPLE = `1
00:00:01,000 --> 00:00:03,500
Hello world

2
00:00:04,000 --> 00:00:06,000
Second line
with a break
`

describe('parseSrt', () => {
  it('parses blocks with index lines', () => {
    const cues = parseSrt(SAMPLE)
    expect(cues).toHaveLength(2)
    expect(cues[0].start).toBe(1)
    expect(cues[0].end).toBe(3.5)
    expect(cues[0].text).toBe('Hello world')
    expect(cues[1].text).toBe('Second line\nwith a break')
  })

  it('tolerates missing index lines, CRLF and dot separators', () => {
    const cues = parseSrt('00:00:00.500 --> 00:00:02.000\r\nHi\r\n\r\n')
    expect(cues).toHaveLength(1)
    expect(cues[0].start).toBe(0.5)
  })

  it('skips invalid blocks', () => {
    expect(parseSrt('garbage\nno timing here\n\n')).toHaveLength(0)
    expect(parseSrt('00:00:05,000 --> 00:00:03,000\nBackwards\n')).toHaveLength(0)
  })

  it('strips markup tags', () => {
    const cues = parseSrt('00:00:00,000 --> 00:00:01,000\n<i>Italic</i> text\n')
    expect(cues[0].text).toBe('Italic text')
  })
})

describe('serializeSrt', () => {
  it('round-trips', () => {
    const cues = parseSrt(SAMPLE)
    const out = serializeSrt(cues)
    const again = parseSrt(out)
    expect(again.map((c) => [c.start, c.end, c.text])).toEqual(
      cues.map((c) => [c.start, c.end, c.text]),
    )
  })
})
