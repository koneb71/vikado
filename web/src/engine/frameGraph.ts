import type { DrawLayer, TexSource } from '@/engine/compositor/Compositor'
import { renderText, textCacheKey } from '@/engine/TextRenderer'
import { activeCueAt, visualLayersAt } from '@/engine/activeClips'
import { sampleTransform } from '@/lib/keyframes'
import {
  DEFAULT_ADJUSTMENTS,
  DEFAULT_TRANSFORM,
  type Clip,
  type ImageClip,
  type Project,
  type Transition,
  type VideoClip,
} from '@/schema/project'

/**
 * Builds the compositor's layer stack for one instant of the timeline.
 *
 * This is the SINGLE description of what a frame looks like. The live preview
 * (PlaybackController) and the in-browser exporter (export/localExport.ts)
 * both call it, so an export can never drift from the preview — they are
 * literally the same code driving the same shaders. The ffmpeg renderer is the
 * third implementation and the one that has to be kept in step by hand; see
 * the contract comments in crates/vikado-renderer/src/filtergraph.rs.
 *
 * Callers differ only in where pixels come from: the preview hands over
 * <video> elements it keeps seeked, the exporter hands over decoded frames.
 */

export type VisualMediaClip = VideoClip | ImageClip

/** Resolve a clip's current pixels. Returns null when nothing is ready yet. */
export type ResolveSource = (clip: VisualMediaClip, sourceTime: number) => TexSource | null

/** Scratch canvases for background-blur backdrops, one pair per clip. */
export type BlurStore = Map<string, { work: HTMLCanvasElement; out: HTMLCanvasElement }>

export function hexToRgb01(hex: string): [number, number, number] {
  const m = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex)
  if (!m) return [0, 1, 0]
  return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255]
}

/** Source time a media clip shows at timeline time `t` (speed-aware). */
export function sourceTimeAt(clip: VisualMediaClip, t: number): number {
  return clip.type === 'video' ? Math.max(0, clip.sourceIn + (t - clip.start) * clip.speed) : 0
}

/**
 * Every media clip contributing pixels at `t`, including the incoming side of
 * a transition. The exporter decodes exactly these before drawing; the preview
 * uses it to decide which elements to keep loaded and seeked.
 */
export function mediaClipsAt(
  project: Project,
  t: number,
): { clip: VisualMediaClip; sourceTime: number }[] {
  const out: { clip: VisualMediaClip; sourceTime: number }[] = []
  for (const layer of visualLayersAt(project, t)) {
    if (layer.clip.type === 'video' || layer.clip.type === 'image') {
      out.push({ clip: layer.clip, sourceTime: sourceTimeAt(layer.clip, t) })
    }
    const b = layer.transition?.clip
    if (b && (b.type === 'video' || b.type === 'image')) {
      out.push({ clip: b, sourceTime: sourceTimeAt(b, t) })
    }
  }
  return out
}

function assetSize(project: Project, clip: VisualMediaClip): { w: number; h: number } | null {
  const asset = project.assets.find((a) => a.id === clip.assetId)
  if (!asset) return null
  return { w: asset.width ?? 1, h: asset.height ?? 1 }
}

/** Crop rect clamped into the frame (schema permits x+w > 1 in hand-edited JSON). */
function clampedCrop(clip: VisualMediaClip) {
  const crop = clip.crop
  if (!crop) return null
  return {
    x: Math.max(0, Math.min(crop.x, 1 - crop.w)),
    y: Math.max(0, Math.min(crop.y, 1 - crop.h)),
    w: crop.w,
    h: crop.h,
  }
}

function layerFor(
  project: Project,
  clip: Clip,
  opacity: number,
  localTime: number,
  t: number,
  resolve: ResolveSource,
): DrawLayer | null {
  if (clip.type === 'video' || clip.type === 'image') {
    const size = assetSize(project, clip)
    const source = resolve(clip, sourceTimeAt(clip, t))
    if (!size || !source) return null
    const transform = sampleTransform(clip, localTime)
    const crop = clampedCrop(clip)
    return {
      source,
      width: size.w * (crop?.w ?? 1),
      height: size.h * (crop?.h ?? 1),
      key: clip.assetId,
      // only moving sources need a re-upload per frame; a still image would
      // otherwise push its full-resolution texture to the GPU every frame
      dynamic: clip.type === 'video',
      transform,
      adjustments: clip.adjustments,
      filter: clip.filter,
      flipH: clip.flipH,
      flipV: clip.flipV,
      uvRect: crop ? [crop.x, crop.y, crop.w, crop.h] : undefined,
      chromaKey: clip.chromaKey
        ? {
            rgb: hexToRgb01(clip.chromaKey.color),
            similarity: clip.chromaKey.similarity,
            blend: clip.chromaKey.blend,
          }
        : undefined,
      opacity: transform.opacity * opacity,
    }
  }
  if (clip.type === 'text') {
    const rendered = renderText(clip.text, clip.style)
    const transform = sampleTransform(clip, localTime)
    return {
      source: rendered.canvas,
      width: rendered.width,
      height: rendered.height,
      key: textCacheKey(clip.text, clip.style),
      dynamic: false,
      fitMode: 'none',
      transform,
      adjustments: DEFAULT_ADJUSTMENTS,
      filter: null,
      opacity: transform.opacity * opacity,
    }
  }
  return null
}

/**
 * Blurred, stage-filling copy of a clip's frame ("background blur" fill),
 * matching the renderer's backdrop semantics: the source is cropped, flipped
 * and chroma-keyed like the clip itself, then aspect-preserving cover-cropped
 * to the stage, then blurred. Exact blur-kernel parity (Canvas2D blur vs
 * ffmpeg gblur) is not attempted; geometry and content are.
 */
function backdropLayer(
  clip: VisualMediaClip,
  source: TexSource,
  mediaW: number,
  mediaH: number,
  opacity: number,
  stageW: number,
  stageH: number,
  blurStore: BlurStore,
): DrawLayer {
  const outW = 192
  const outH = Math.max(2, Math.round((outW * stageH) / stageW))
  let pair = blurStore.get(clip.id)
  if (!pair || pair.out.width !== outW || pair.out.height !== outH) {
    const work = document.createElement('canvas')
    const out = document.createElement('canvas')
    work.width = out.width = outW
    work.height = out.height = outH
    pair = { work, out }
    blurStore.set(clip.id, pair)
  }
  const wctx = pair.work.getContext('2d', { willReadFrequently: true })!

  const crop = clampedCrop(clip)
  const rx = (crop?.x ?? 0) * mediaW
  const ry = (crop?.y ?? 0) * mediaH
  const rw = (crop?.w ?? 1) * mediaW
  const rh = (crop?.h ?? 1) * mediaH
  const targetAR = stageW / stageH
  let sx = rx
  let sy = ry
  let sw = rw
  let sh = rh
  if (rw / rh > targetAR) {
    sw = rh * targetAR
    sx = rx + (rw - sw) / 2
  } else {
    sh = rw / targetAR
    sy = ry + (rh - sh) / 2
  }

  try {
    wctx.save()
    wctx.filter = 'none'
    wctx.setTransform(
      clip.flipH ? -1 : 1,
      0,
      0,
      clip.flipV ? -1 : 1,
      clip.flipH ? outW : 0,
      clip.flipV ? outH : 0,
    )
    wctx.drawImage(source as CanvasImageSource, sx, sy, sw, sh, 0, 0, outW, outH)
    wctx.restore()

    if (clip.chromaKey) {
      const [kr, kg, kb] = hexToRgb01(clip.chromaKey.color)
      const { similarity, blend } = clip.chromaKey
      const img = wctx.getImageData(0, 0, outW, outH)
      const d = img.data
      for (let i = 0; i < d.length; i += 4) {
        const dr = d[i] / 255 - kr
        const dg = d[i + 1] / 255 - kg
        const db = d[i + 2] / 255 - kb
        const diff = Math.sqrt(dr * dr + dg * dg + db * db) / Math.sqrt(3)
        const a =
          blend > 0
            ? Math.min(1, Math.max(0, (diff - similarity) / blend))
            : diff < similarity
              ? 0
              : 1
        d[i + 3] = Math.round(d[i + 3] * a)
      }
      wctx.putImageData(img, 0, 0)
    }

    const octx = pair.out.getContext('2d')!
    octx.clearRect(0, 0, outW, outH)
    octx.filter = 'blur(5px)'
    octx.drawImage(pair.work, 0, 0)
    octx.filter = 'none'
  } catch {
    // source not ready — keep previous backdrop contents
  }

  return {
    source: pair.out,
    width: outW,
    height: outH,
    key: `bg:${clip.id}`,
    dynamic: true,
    fitMode: 'cover',
    transform: DEFAULT_TRANSFORM,
    adjustments: DEFAULT_ADJUSTMENTS,
    filter: null,
    opacity,
  }
}

/**
 * Transition blending without an extra render pass:
 *  - crossfade: B drawn over A with opacity p
 *  - fade-black: A fades out, then B fades in
 *  - wipes: B scissored to the revealed region
 *  - slides: B translated in from its edge
 * The ffmpeg output is the reference; these are visually equivalent for
 * full-stage clips (the common case).
 */
function pushTransitionLayers(
  layers: DrawLayer[],
  project: Project,
  a: DrawLayer | null,
  bClip: Clip,
  type: Transition['type'],
  p: number,
  t: number,
  resolve: ResolveSource,
): void {
  const b = layerFor(project, bClip, 1, Math.max(0, t - bClip.start), t, resolve)
  const W = project.width
  const H = project.height
  switch (type) {
    case 'crossfade':
      if (a) layers.push(a)
      if (b) layers.push({ ...b, opacity: b.opacity * p })
      break
    case 'fade-black':
      if (p < 0.5) {
        if (a) layers.push({ ...a, opacity: a.opacity * (1 - p * 2) })
      } else if (b) {
        layers.push({ ...b, opacity: b.opacity * ((p - 0.5) * 2) })
      }
      break
    case 'wipe-left': // reveal B from the right edge moving left
      if (a) layers.push(a)
      if (b) layers.push({ ...b, scissor: [W * (1 - p), 0, W * p, H] })
      break
    case 'wipe-right':
      if (a) layers.push(a)
      if (b) layers.push({ ...b, scissor: [0, 0, W * p, H] })
      break
    case 'slide-left': // B slides in from the right
      if (a) layers.push(a)
      if (b) layers.push({ ...b, offsetX: W * (1 - p) })
      break
    case 'slide-right':
      if (a) layers.push(a)
      if (b) layers.push({ ...b, offsetX: -W * (1 - p) })
      break
  }
}

/** The full layer stack, bottom-up, for timeline time `t`. */
export function buildFrameLayers(
  project: Project,
  t: number,
  resolve: ResolveSource,
  blurStore: BlurStore,
): DrawLayer[] {
  const layers: DrawLayer[] = []

  for (const layer of visualLayersAt(project, t)) {
    if (layer.transition) {
      const a = layerFor(project, layer.clip, 1, layer.localTime, t, resolve)
      pushTransitionLayers(
        layers,
        project,
        a,
        layer.transition.clip,
        layer.transition.type,
        layer.transition.progress,
        t,
        resolve,
      )
    } else {
      const l = layerFor(project, layer.clip, layer.fade, layer.localTime, t, resolve)
      if (l) {
        // blurred fill behind the clip (suppressed inside transition windows,
        // matching the renderer's backdrop enable window)
        if (
          (layer.clip.type === 'video' || layer.clip.type === 'image') &&
          layer.clip.backgroundBlur
        ) {
          const size = assetSize(project, layer.clip)
          layers.push(
            backdropLayer(
              layer.clip,
              l.source,
              size?.w ?? 1,
              size?.h ?? 1,
              layer.fade,
              project.width,
              project.height,
              blurStore,
            ),
          )
        }
        layers.push(l)
      }
    }
  }

  // subtitles: bottom-center with a 5% margin (matches the ASS emitter)
  const cueText = activeCueAt(project, t)
  if (cueText && project.subtitles) {
    const rendered = renderText(cueText, project.subtitles.style)
    layers.push({
      source: rendered.canvas,
      width: rendered.width,
      height: rendered.height,
      key: textCacheKey(cueText, project.subtitles.style),
      dynamic: false,
      fitMode: 'none',
      transform: {
        ...DEFAULT_TRANSFORM,
        y: project.height / 2 - rendered.height / 2 - project.height * 0.05,
      },
      adjustments: DEFAULT_ADJUSTMENTS,
      filter: null,
      opacity: 1,
    })
  }

  return layers
}
