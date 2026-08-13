/**
 * WebGL2 shader sources.
 *
 * COLOR MATH CONTRACT (mirrored by the Rust renderer's ffmpeg `eq` mapping —
 * keep both in sync):
 *   brightness b ∈ [-1,1]:  out += b                       (ffmpeg eq brightness=b)
 *   contrast   c ∈ [-1,1]:  out = (out-0.5)*(1+c) + 0.5    (ffmpeg eq contrast=1+c)
 *   saturation s ∈ [-1,1]:  mix(luma, out, 1+s)            (ffmpeg eq saturation=1+s)
 *   temperature w ∈ [-1,1]: r += 0.1w, b -= 0.1w           (ffmpeg colorbalance rs/bs)
 *   luma = dot(rgb, (0.299, 0.587, 0.114))                 (BT.601, matches eq)
 *
 * Filter presets are a 4x4 color matrix (column-major) + adjustment overrides,
 * defined once in schema/filters.ts.
 */

export const VERTEX_SRC = `#version 300 es
layout(location = 0) in vec2 a_pos;      // unit quad corners (-0.5..0.5)
uniform mat3 u_transform;                 // quad -> clip space (includes rotation/scale/translate)
uniform bool u_flipY;                     // texture sources are top-left origin
out vec2 v_uv;
void main() {
  v_uv = a_pos + 0.5;
  if (u_flipY) v_uv.y = 1.0 - v_uv.y;
  vec3 pos = u_transform * vec3(a_pos, 1.0);
  gl_Position = vec4(pos.xy, 0.0, 1.0);
}
`

export const LAYER_FRAG_SRC = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_opacity;
uniform float u_brightness;   // -1..1
uniform float u_contrast;     // -1..1
uniform float u_saturation;   // -1..1
uniform float u_temperature;  // -1..1
uniform mat4 u_colorMatrix;   // filter preset matrix (identity when none)
uniform vec4 u_uvRect;        // source crop: x,y,w,h in 0..1 (0,0,1,1 = full)
uniform int u_keyEnabled;     // chroma key on/off
uniform vec3 u_keyColor;      // key color, linear-ish sRGB 0..1
uniform float u_keySimilarity;
uniform float u_keyBlend;
out vec4 fragColor;

void main() {
  vec2 uv = u_uvRect.xy + v_uv * u_uvRect.zw;
  vec4 c = texture(u_tex, uv);

  // CHROMA KEY CONTRACT (mirrors ffmpeg colorkey on decoded RGB, keep in
  // sync with crates/vikado-renderer/src/filtergraph.rs). NOT yuv chromakey:
  // its limited-range plane comparison has a colorspace-dependent threshold
  // offset a browser cannot reproduce.
  //   diff = length(rgb - key) / sqrt(3)
  //   diff < similarity            -> transparent
  //   diff < similarity + blend    -> alpha ramps 0..1
  if (u_keyEnabled == 1) {
    float diff = length(c.rgb - u_keyColor) / sqrt(3.0);
    float keyAlpha = u_keyBlend > 0.0
      ? clamp((diff - u_keySimilarity) / u_keyBlend, 0.0, 1.0)
      : step(u_keySimilarity, diff);
    c.a *= keyAlpha;
  }

  // filter preset matrix first (grayscale/sepia/invert/...)
  c = clamp(u_colorMatrix * vec4(c.rgb, 1.0), 0.0, 1.0) * vec4(1.0, 1.0, 1.0, c.a);

  // temperature
  c.r += 0.1 * u_temperature;
  c.b -= 0.1 * u_temperature;

  // brightness + contrast
  c.rgb += u_brightness;
  c.rgb = (c.rgb - 0.5) * (1.0 + u_contrast) + 0.5;

  // saturation
  float luma = dot(c.rgb, vec3(0.299, 0.587, 0.114));
  c.rgb = mix(vec3(luma), c.rgb, 1.0 + u_saturation);

  fragColor = vec4(clamp(c.rgb, 0.0, 1.0), c.a) * u_opacity;
}
`

/**
 * Transition program: blends textures A (outgoing) and B (incoming) by
 * progress p ∈ [0,1]. Drawn full-stage. Semantics must match the ffmpeg
 * xfade transition of the same name.
 */
export const TRANSITION_FRAG_SRC = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texA;
uniform sampler2D u_texB;
uniform float u_progress;   // 0 -> A, 1 -> B
uniform int u_type;         // 0 crossfade, 1 fade-black, 2 wipe-left, 3 wipe-right, 4 slide-left, 5 slide-right
out vec4 fragColor;

void main() {
  vec4 a = texture(u_texA, v_uv);
  vec4 b = texture(u_texB, v_uv);
  float p = clamp(u_progress, 0.0, 1.0);

  if (u_type == 0) {                    // crossfade
    fragColor = mix(a, b, p);
  } else if (u_type == 1) {             // fade through black
    fragColor = p < 0.5 ? a * (1.0 - p * 2.0) : b * ((p - 0.5) * 2.0);
  } else if (u_type == 2) {             // wipe-left: B reveals from right edge moving left
    fragColor = v_uv.x > 1.0 - p ? b : a;
  } else if (u_type == 3) {             // wipe-right
    fragColor = v_uv.x < p ? b : a;
  } else if (u_type == 4) {             // slide-left: B slides in from the right
    vec2 uvB = v_uv + vec2(1.0 - p, 0.0);
    fragColor = uvB.x <= 1.0 ? texture(u_texB, fract(uvB)) : a;
  } else {                              // slide-right
    vec2 uvB = v_uv - vec2(1.0 - p, 0.0);
    fragColor = uvB.x >= 0.0 ? texture(u_texB, fract(uvB)) : a;
  }
}
`
