import { applyTextTransform, type TextStyle } from '@/schema/project'

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

  const lines = applyTextTransform(text, style.textTransform).split('\n')
  const pad = style.fontSize * PADDING
  const lineHeight = style.fontSize * 1.25
  // ASS reuses BackColour for both, and the box wins there, so it wins here
  const shadow = style.backgroundColor ? null : style.shadow

  const measure = document.createElement('canvas').getContext('2d')!
  measure.font = fontString(style)
  measure.letterSpacing = `${style.letterSpacing}px`
  const widths = lines.map((l) => measure.measureText(l).width)
  const textWidth = Math.max(1, ...widths)

  const canvas = document.createElement('canvas')
  // the shadow falls down-right, so the canvas needs room for it
  const shadowRoom = shadow ? shadow.distance : 0
  canvas.width = Math.ceil(textWidth + pad * 2 + shadowRoom)
  canvas.height = Math.ceil(lineHeight * lines.length + pad * 2 + shadowRoom)
  const ctx = canvas.getContext('2d')!
  ctx.font = fontString(style)
  ctx.letterSpacing = `${style.letterSpacing}px`
  ctx.textBaseline = 'middle'

  if (style.backgroundColor) {
    ctx.fillStyle = style.backgroundColor
    ctx.beginPath()
    ctx.roundRect(0, 0, canvas.width, canvas.height, style.fontSize * 0.15)
    ctx.fill()
  }

  const boxWidth = canvas.width - shadowRoom
  lines.forEach((line, i) => {
    const w = widths[i]
    const x =
      style.align === 'left' ? pad : style.align === 'right' ? boxWidth - pad - w : (boxWidth - w) / 2
    const y = pad + lineHeight * (i + 0.5)

    if (shadow) {
      // drawn as a real offset copy rather than ctx.shadow*, so it lands in
      // exactly the place libass puts \shad: down and right by `distance`
      ctx.fillStyle = shadow.color
      ctx.fillText(line, x + shadow.distance, y + shadow.distance)
    }
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
