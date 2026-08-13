import { nanoid } from 'nanoid'
import {
  emptyKeyframes,
  DEFAULT_ADJUSTMENTS,
  DEFAULT_TEXT_STYLE,
  DEFAULT_TRANSFORM,
  type Asset,
  type Clip,
  type TextClip,
} from '@/schema/project'

export const DEFAULT_IMAGE_DURATION = 5
export const DEFAULT_TEXT_DURATION = 4

export function clipFromAsset(asset: Asset, start: number): Clip {
  switch (asset.kind) {
    case 'video':
      return {
        type: 'video',
        id: nanoid(),
        start,
        duration: asset.duration ?? DEFAULT_IMAGE_DURATION,
        assetId: asset.id,
        sourceIn: 0,
        speed: 1,
        volume: 1,
        muted: false,
        flipH: false,
        flipV: false,
        chromaKey: null,
        backgroundBlur: false,
        crop: null,
        transform: { ...DEFAULT_TRANSFORM },
        keyframes: emptyKeyframes(),
        adjustments: { ...DEFAULT_ADJUSTMENTS },
        filter: null,
        fadeIn: 0,
        fadeOut: 0,
        transitionOut: null,
      }
    case 'image':
      return {
        type: 'image',
        id: nanoid(),
        start,
        duration: DEFAULT_IMAGE_DURATION,
        assetId: asset.id,
        flipH: false,
        flipV: false,
        chromaKey: null,
        backgroundBlur: false,
        crop: null,
        transform: { ...DEFAULT_TRANSFORM },
        keyframes: emptyKeyframes(),
        adjustments: { ...DEFAULT_ADJUSTMENTS },
        filter: null,
        fadeIn: 0,
        fadeOut: 0,
        transitionOut: null,
      }
    case 'audio':
      return {
        type: 'audio',
        id: nanoid(),
        start,
        duration: asset.duration ?? DEFAULT_IMAGE_DURATION,
        assetId: asset.id,
        sourceIn: 0,
        speed: 1,
        volume: 1,
        fadeIn: 0,
        fadeOut: 0,
      }
  }
}

export function newTextClip(start: number, text = 'Your text here'): TextClip {
  return {
    type: 'text',
    id: nanoid(),
    start,
    duration: DEFAULT_TEXT_DURATION,
    text,
    style: { ...DEFAULT_TEXT_STYLE },
    transform: { ...DEFAULT_TRANSFORM },
    keyframes: emptyKeyframes(),
    measuredWidth: 0,
    measuredHeight: 0,
    fadeIn: 0,
    fadeOut: 0,
  }
}
