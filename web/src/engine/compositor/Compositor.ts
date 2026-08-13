import { LAYER_FRAG_SRC, VERTEX_SRC } from '@/engine/compositor/shaders'
import { layerMatrix } from '@/engine/compositor/geometry'
import { filterMatrix } from '@/schema/filters'
import type { ColorAdjustments, FilterPreset, Transform } from '@/schema/project'

/** Anything WebGL can upload as a texture each frame. */
export type TexSource =
  | HTMLVideoElement
  | HTMLCanvasElement
  | OffscreenCanvas
  | HTMLImageElement
  | ImageBitmap
  | VideoFrame

export interface DrawLayer {
  source: TexSource
  /** intrinsic pixel size of the source */
  width: number
  height: number
  /** cache key: texture is reused (and re-uploaded for videos) per key */
  key: string
  /** true when the source content changes every frame (video) */
  dynamic: boolean
  transform: Transform
  adjustments: ColorAdjustments
  filter: FilterPreset | null
  /** final opacity = transform.opacity × fade envelope */
  opacity: number
  /**
   * 'contain' (default): media is fit inside the stage at scale 1.
   * 'cover': media fills the stage (background-blur backdrops).
   * 'none': source pixels map 1:1 to stage pixels (text, subtitles).
   */
  fitMode?: 'contain' | 'cover' | 'none'
  /** mirror the source horizontally / vertically */
  flipH?: boolean
  flipV?: boolean
  /** source crop rect [x, y, w, h] normalized 0..1 (omit = full frame) */
  uvRect?: [number, number, number, number]
  /** green-screen removal (ffmpeg chromakey semantics) */
  chromaKey?: { rgb: [number, number, number]; similarity: number; blend: number }
  /** extra stage-px translation applied after transform (slide transitions) */
  offsetX?: number
  /** stage-px scissor rect [x, y, w, h] (y from top) — wipe transitions */
  scissor?: [number, number, number, number]
}

const QUAD = new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5])

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, src)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`Shader compile failed: ${gl.getShaderInfoLog(shader)}`)
  }
  return shader
}

function link(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const program = gl.createProgram()!
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vs))
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fs))
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Program link failed: ${gl.getProgramInfoLog(program)}`)
  }
  return program
}

/**
 * WebGL2 layer compositor. Stage coordinates are project pixels
 * (project.width × project.height); the canvas backing store matches that
 * and CSS scales it to fit the preview area.
 */
export class Compositor {
  private gl: WebGL2RenderingContext
  private canvas: HTMLCanvasElement
  private layerProgram: WebGLProgram
  private textures = new Map<string, WebGLTexture>()
  private stageWidth = 1920
  private stageHeight = 1080
  private background: [number, number, number] = [0, 0, 0]

  private uniforms: {
    transform: WebGLUniformLocation
    flipY: WebGLUniformLocation
    tex: WebGLUniformLocation
    opacity: WebGLUniformLocation
    brightness: WebGLUniformLocation
    contrast: WebGLUniformLocation
    saturation: WebGLUniformLocation
    temperature: WebGLUniformLocation
    colorMatrix: WebGLUniformLocation
    uvRect: WebGLUniformLocation
    keyEnabled: WebGLUniformLocation
    keyColor: WebGLUniformLocation
    keySimilarity: WebGLUniformLocation
    keyBlend: WebGLUniformLocation
  }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: true, // allows canvas capture for thumbnails
    })
    if (!gl) throw new Error('WebGL2 is not supported in this browser')
    this.gl = gl

    this.layerProgram = link(gl, VERTEX_SRC, LAYER_FRAG_SRC)
    // the transition program (shaders.TRANSITION_FRAG_SRC) is linked when
    // transitions land alongside the track render-to-texture pass

    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)
    const vbo = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
    gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

    gl.enable(gl.BLEND)
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

    const u = (name: string) => {
      const loc = gl.getUniformLocation(this.layerProgram, name)
      if (!loc) throw new Error(`Missing uniform ${name}`)
      return loc
    }
    this.uniforms = {
      transform: u('u_transform'),
      flipY: u('u_flipY'),
      tex: u('u_tex'),
      opacity: u('u_opacity'),
      brightness: u('u_brightness'),
      contrast: u('u_contrast'),
      saturation: u('u_saturation'),
      temperature: u('u_temperature'),
      colorMatrix: u('u_colorMatrix'),
      uvRect: u('u_uvRect'),
      keyEnabled: u('u_keyEnabled'),
      keyColor: u('u_keyColor'),
      keySimilarity: u('u_keySimilarity'),
      keyBlend: u('u_keyBlend'),
    }
  }

  /** Canvas background color, '#rrggbb'. */
  setBackground(hex: string): void {
    const m = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex)
    if (m) this.background = [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255]
  }

  setStageSize(width: number, height: number): void {
    this.stageWidth = width
    this.stageHeight = height
    if (this.canvas.width !== width) this.canvas.width = width
    if (this.canvas.height !== height) this.canvas.height = height
  }

  private texture(layer: DrawLayer): WebGLTexture {
    const { gl } = this
    let tex = this.textures.get(layer.key)
    const isNew = !tex
    if (!tex) {
      tex = gl.createTexture()!
      this.textures.set(layer.key, tex)
    }
    gl.bindTexture(gl.TEXTURE_2D, tex)
    if (isNew || layer.dynamic) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, layer.source)
      } catch {
        // video element not ready yet — keep previous texture contents
      }
    }
    return tex
  }

  releaseTexture(key: string): void {
    const tex = this.textures.get(key)
    if (tex) {
      this.gl.deleteTexture(tex)
      this.textures.delete(key)
    }
  }


  /** Composite the given layers bottom-up onto the stage. */
  draw(layers: DrawLayer[]): void {
    const { gl } = this
    gl.viewport(0, 0, this.stageWidth, this.stageHeight)
    gl.clearColor(this.background[0], this.background[1], this.background[2], 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.useProgram(this.layerProgram)
    for (const layer of layers) {
      if (layer.scissor) {
        const [x, y, w, h] = layer.scissor
        gl.enable(gl.SCISSOR_TEST)
        // GL scissor origin is bottom-left
        gl.scissor(Math.round(x), Math.round(this.stageHeight - y - h), Math.round(w), Math.round(h))
      } else {
        gl.disable(gl.SCISSOR_TEST)
      }
      const tex = this.texture(layer)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.uniform1i(this.uniforms.tex, 0)
      gl.uniformMatrix3fv(
        this.uniforms.transform,
        false,
        layerMatrix(layer, this.stageWidth, this.stageHeight),
      )
      gl.uniform1i(this.uniforms.flipY, 1)
      gl.uniform1f(this.uniforms.opacity, layer.opacity)
      gl.uniform1f(this.uniforms.brightness, layer.adjustments.brightness)
      gl.uniform1f(this.uniforms.contrast, layer.adjustments.contrast)
      gl.uniform1f(this.uniforms.saturation, layer.adjustments.saturation)
      gl.uniform1f(this.uniforms.temperature, layer.adjustments.temperature)
      const rect = layer.uvRect ?? [0, 0, 1, 1]
      gl.uniform4f(this.uniforms.uvRect, rect[0], rect[1], rect[2], rect[3])
      if (layer.chromaKey) {
        gl.uniform1i(this.uniforms.keyEnabled, 1)
        gl.uniform3f(this.uniforms.keyColor, ...layer.chromaKey.rgb)
        gl.uniform1f(this.uniforms.keySimilarity, layer.chromaKey.similarity)
        gl.uniform1f(this.uniforms.keyBlend, layer.chromaKey.blend)
      } else {
        gl.uniform1i(this.uniforms.keyEnabled, 0)
      }
      // row-major source, transpose=false requires column-major: transpose on upload
      gl.uniformMatrix4fv(this.uniforms.colorMatrix, true, new Float32Array(filterMatrix(layer.filter)))
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
    gl.disable(gl.SCISSOR_TEST)
  }

  /**
   * @param releaseContext force the WebGL2 context to be dropped as well.
   *   Browsers cap live contexts (~16) and evict the oldest on overflow, and
   *   each export builds a throwaway context, so the exporter asks for this to
   *   avoid eventually evicting the preview's. The preview must NOT: its
   *   canvas outlives the controller (a StrictMode remount reuses the node),
   *   and getContext on a lost canvas hands back the lost context.
   */
  dispose(releaseContext = false): void {
    for (const key of [...this.textures.keys()]) this.releaseTexture(key)
    if (releaseContext) this.gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
}
