import type { TextStyle } from '@/schema/project'

/**
 * Rasterizes text to a 2D canvas for texture upload. Results are cached by
 * (text, style) so playback doesn't re-render every frame.
 *
 * Line breaks are explicit (\n) — the same lines are sent to the renderer,
 * which sidesteps browser-vs-libass wrapping differences.
 */

const PADDING = 0.25 // × fontSize, canvas padding for outline/background bleed

export interface RenderedText {
  canvas: HTMLCanvasElement
  width: number
  height: number
}

const cache = new Map<string, RenderedText>()
const MAX_CACHE = 100

export function renderText(text: string, style: TextStyle): RenderedText {
  const key = JSON.stringify([text, style])
  const hit = cache.get(key)
  if (hit) return hit

  const lines = text.split('\n')
  const pad = style.fontSize * PADDING
  const lineHeight = style.fontSize * 1.25

  const measure = document.createElement('canvas').getContext('2d')!
  measure.font = fontString(style)
  const widths = lines.map((l) => measure.measureText(l).width)
  const textWidth = Math.max(1, ...widths)

  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(textWidth + pad * 2)
  canvas.height = Math.ceil(lineHeight * lines.length + pad * 2)
  const ctx = canvas.getContext('2d')!
  ctx.font = fontString(style)
  ctx.textBaseline = 'middle'

  if (style.backgroundColor) {
    ctx.fillStyle = style.backgroundColor
    ctx.beginPath()
    ctx.roundRect(0, 0, canvas.width, canvas.height, style.fontSize * 0.15)
    ctx.fill()
  }

  lines.forEach((line, i) => {
    const w = widths[i]
    const x =
      style.align === 'left' ? pad : style.align === 'right' ? canvas.width - pad - w : (canvas.width - w) / 2
    const y = pad + lineHeight * (i + 0.5)

    if (style.outlineColor && style.outlineWidth > 0) {
      ctx.strokeStyle = style.outlineColor
      ctx.lineWidth = style.outlineWidth * 2
      ctx.lineJoin = 'round'
      ctx.strokeText(line, x, y)
    }
    ctx.fillStyle = style.color
    ctx.fillText(line, x, y)
  })

  const rendered: RenderedText = { canvas, width: canvas.width, height: canvas.height }
  if (cache.size >= MAX_CACHE) {
    const firstKey = cache.keys().next().value
    if (firstKey !== undefined) cache.delete(firstKey)
  }
  cache.set(key, rendered)
  return rendered
}

export function textCacheKey(text: string, style: TextStyle): string {
  return `text:${JSON.stringify([text, style])}`
}

function fontString(style: TextStyle): string {
  const italic = style.italic ? 'italic ' : ''
  return `${italic}${style.fontWeight} ${style.fontSize}px "${style.fontFamily}", sans-serif`
}
