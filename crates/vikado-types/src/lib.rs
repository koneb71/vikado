//! The Vikado project schema — the contract between the browser editor and
//! the render service. Mirrors `web/src/schema/project.ts`; the ts-rs export
//! (run `cargo test -p vikado-types` to regenerate `web/src/generated/`) is
//! the drift check between the two.
//!
//! Times are f64 seconds. Positions/sizes are canvas pixels at
//! (`Project::width` × `Project::height`). Track index 0 = bottom layer.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

pub const SCHEMA_VERSION: u32 = 1;

/// serde default for clip playback speed (fields added after 1.0 projects existed)
fn default_speed() -> f64 {
    1.0
}

/// serde default for the project canvas background color
fn default_canvas_background() -> String {
    "#000000".to_string()
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Transform {
    /// center offset from canvas center, canvas px (y down)
    pub x: f64,
    pub y: f64,
    /// 1 = "fit" inside canvas
    pub scale: f64,
    /// degrees, clockwise
    pub rotation: f64,
    /// 0..1
    pub opacity: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ColorAdjustments {
    /// all default 0, range -1..1
    pub brightness: f64,
    pub contrast: f64,
    pub saturation: f64,
    pub temperature: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export)]
pub enum FilterPreset {
    Grayscale,
    Sepia,
    Vintage,
    Cool,
    Warm,
    Invert,
    Noir,
    Vivid,
    Faded,
    Cyberpunk,
    Sunset,
    Mint,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
#[ts(export)]
pub enum TransitionType {
    Crossfade,
    FadeBlack,
    FadeWhite,
    WipeLeft,
    WipeRight,
    WipeUp,
    WipeDown,
    SlideLeft,
    SlideRight,
    SlideUp,
    SlideDown,
}

/// Entrance/exit animation for a text clip. Movement and scale only — opacity
/// is covered by fade_in/fade_out. Every variant is a LINEAR ramp, because ASS
/// \move and \t interpolate linearly and the preview must not drift from them.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
#[ts(export)]
pub enum TextAnimationType {
    SlideUp,
    SlideDown,
    SlideLeft,
    SlideRight,
    ZoomIn,
    ZoomOut,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct TextAnimation {
    #[serde(rename = "type")]
    pub kind: TextAnimationType,
    /// seconds
    pub duration: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Transition {
    #[serde(rename = "type")]
    pub kind: TransitionType,
    /// seconds, window centered on the cut into the next clip
    pub duration: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
#[ts(export)]
pub enum Easing {
    #[default]
    Linear,
    EaseIn,
    EaseOut,
    EaseInOut,
}

fn default_easing() -> Easing {
    Easing::Linear
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Keyframe {
    /// clip-local time (s from clip start)
    pub t: f64,
    pub value: f64,
    /// easing INTO the next keyframe
    #[serde(default = "default_easing")]
    pub easing: Easing,
}

/// Per-property keyframe tracks for Transform fields. A property with
/// keyframes ignores the static transform value; between keyframes the value
/// interpolates, outside the range it clamps to the nearest keyframe.
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Keyframes {
    #[serde(default)]
    pub x: Vec<Keyframe>,
    #[serde(default)]
    pub y: Vec<Keyframe>,
    #[serde(default)]
    pub scale: Vec<Keyframe>,
    #[serde(default)]
    pub rotation: Vec<Keyframe>,
    #[serde(default)]
    pub opacity: Vec<Keyframe>,
}

impl Keyframes {
    pub fn is_empty(&self) -> bool {
        self.x.is_empty()
            && self.y.is_empty()
            && self.scale.is_empty()
            && self.rotation.is_empty()
            && self.opacity.is_empty()
    }
}

/// Green-screen removal, keyed on decoded RGB: a pixel goes transparent when
/// `length(rgb - color) / sqrt(3) < similarity`, ramping to opaque over
/// `blend`. The renderer emits ffmpeg `colorkey` and the preview shader
/// implements the same distance — deliberately NOT ffmpeg's YUV `chromakey`,
/// whose limited-range plane comparison a browser cannot reproduce. See the
/// CHROMA KEY CONTRACT comments in filtergraph.rs and shaders.ts.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ChromaKey {
    /// #rrggbb key color
    pub color: String,
    /// normalized RGB distance below which a pixel keys out (0.01..1)
    pub similarity: f64,
    /// edge softness (0..1)
    pub blend: f64,
}

/// Source crop rect, normalized 0..1 relative to the media frame.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Crop {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export)]
pub enum TextAlign {
    Left,
    Center,
    Right,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export)]
pub enum TextTransform {
    #[default]
    None,
    Uppercase,
    Lowercase,
}

impl TextTransform {
    /// Casing applied before measuring or rasterising, matching
    /// `applyTextTransform` in web/src/schema/project.ts.
    pub fn apply(self, text: &str) -> String {
        match self {
            TextTransform::None => text.to_string(),
            TextTransform::Uppercase => text.to_uppercase(),
            TextTransform::Lowercase => text.to_lowercase(),
        }
    }
}

/// Drop shadow. ASS expresses this as a single \shad depth down-right plus
/// BackColour, so there is one distance rather than separate x/y, and no blur.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct TextShadow {
    /// #rrggbb
    pub color: String,
    /// px, offset applied equally right and down
    pub distance: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct TextStyle {
    /// must be one of the bundled fonts
    pub font_family: String,
    /// px at canvas resolution
    pub font_size: f64,
    /// 400 or 700
    pub font_weight: u32,
    pub italic: bool,
    /// #rrggbb
    pub color: String,
    pub background_color: Option<String>,
    pub outline_color: Option<String>,
    pub outline_width: f64,
    pub align: TextAlign,
    /// px added between glyphs (ASS Spacing)
    #[serde(default)]
    pub letter_spacing: f64,
    /// ASS reuses BackColour for the opaque box AND the shadow, so a style
    /// with a background box cannot also carry a shadow — the box wins.
    #[serde(default)]
    pub shadow: Option<TextShadow>,
    #[serde(default)]
    pub text_transform: TextTransform,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export)]
pub enum AssetKind {
    Video,
    Audio,
    Image,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Asset {
    pub id: String,
    pub kind: AssetKind,
    /// original filename, display only — never used as a path
    pub name: String,
    /// sha-256 hex of file bytes; upload key
    pub hash: String,
    pub duration: Option<f64>,
    pub width: Option<f64>,
    pub height: Option<f64>,
    pub fps: Option<f64>,
    pub has_audio: bool,
    pub mime_type: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(tag = "type", rename_all = "camelCase")]
#[ts(export)]
pub enum Clip {
    #[serde(rename = "video", rename_all = "camelCase")]
    Video {
        id: String,
        start: f64,
        duration: f64,
        asset_id: String,
        source_in: f64,
        /// playback rate 0.25..4; source consumed = duration × speed
        #[serde(default = "default_speed")]
        speed: f64,
        volume: f64,
        muted: bool,
        #[serde(default)]
        flip_h: bool,
        #[serde(default)]
        flip_v: bool,
        #[serde(default)]
        chroma_key: Option<ChromaKey>,
        #[serde(default)]
        background_blur: bool,
        #[serde(default)]
        crop: Option<Crop>,
        transform: Transform,
        #[serde(default)]
        keyframes: Keyframes,
        adjustments: ColorAdjustments,
        filter: Option<FilterPreset>,
        fade_in: f64,
        fade_out: f64,
        transition_out: Option<Transition>,
    },
    #[serde(rename = "image", rename_all = "camelCase")]
    Image {
        id: String,
        start: f64,
        duration: f64,
        asset_id: String,
        #[serde(default)]
        flip_h: bool,
        #[serde(default)]
        flip_v: bool,
        #[serde(default)]
        chroma_key: Option<ChromaKey>,
        #[serde(default)]
        background_blur: bool,
        #[serde(default)]
        crop: Option<Crop>,
        transform: Transform,
        #[serde(default)]
        keyframes: Keyframes,
        adjustments: ColorAdjustments,
        filter: Option<FilterPreset>,
        fade_in: f64,
        fade_out: f64,
        transition_out: Option<Transition>,
    },
    #[serde(rename = "audio", rename_all = "camelCase")]
    Audio {
        id: String,
        start: f64,
        duration: f64,
        asset_id: String,
        source_in: f64,
        /// playback rate 0.25..4; source consumed = duration × speed
        #[serde(default = "default_speed")]
        speed: f64,
        volume: f64,
        fade_in: f64,
        fade_out: f64,
    },
    #[serde(rename = "text", rename_all = "camelCase")]
    Text {
        id: String,
        start: f64,
        duration: f64,
        /// may contain explicit \n line breaks
        text: String,
        style: TextStyle,
        transform: Transform,
        #[serde(default)]
        keyframes: Keyframes,
        /// rendered block size in canvas px, measured by the editor whenever
        /// text/style change; 0 = unknown (renderer falls back to centered)
        #[serde(default)]
        measured_width: f64,
        #[serde(default)]
        measured_height: f64,
        fade_in: f64,
        fade_out: f64,
        #[serde(default)]
        animation_in: Option<TextAnimation>,
        #[serde(default)]
        animation_out: Option<TextAnimation>,
    },
}

/// Offsets and scale an animation contributes at progress `q` (0 = fully away,
/// 1 = at rest). Mirrors `contribution` in web/src/lib/textAnimation.ts.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct TextAnimationState {
    pub offset_x: f64,
    pub offset_y: f64,
    pub scale: f64,
}

impl TextAnimationState {
    pub const NEUTRAL: Self = Self {
        offset_x: 0.0,
        offset_y: 0.0,
        scale: 1.0,
    };
}

impl TextAnimation {
    fn contribution(
        &self,
        q: f64,
        measured_width: f64,
        measured_height: f64,
        canvas_w: f64,
        canvas_h: f64,
    ) -> TextAnimationState {
        let away = 1.0 - q;
        let dist = |horizontal: bool| {
            let measured = if horizontal {
                measured_width
            } else {
                measured_height
            };
            if measured > 0.0 {
                measured
            } else {
                (if horizontal { canvas_w } else { canvas_h }) * 0.1
            }
        };
        let s = |offset_x: f64, offset_y: f64, scale: f64| TextAnimationState {
            offset_x,
            offset_y,
            scale,
        };
        match self.kind {
            TextAnimationType::SlideUp => s(0.0, away * dist(false), 1.0),
            TextAnimationType::SlideDown => s(0.0, -away * dist(false), 1.0),
            TextAnimationType::SlideLeft => s(away * dist(true), 0.0, 1.0),
            TextAnimationType::SlideRight => s(-away * dist(true), 0.0, 1.0),
            TextAnimationType::ZoomIn => s(0.0, 0.0, 0.6 + 0.4 * q),
            TextAnimationType::ZoomOut => s(0.0, 0.0, 1.4 - 0.4 * q),
        }
    }
}

/// Combined animation state `local_time` seconds into a text clip. In and out
/// compose: offsets add, scales multiply. Mirrors `textAnimationState` in
/// web/src/lib/textAnimation.ts — keep both in step.
#[allow(clippy::too_many_arguments)]
pub fn text_animation_state(
    animation_in: Option<&TextAnimation>,
    animation_out: Option<&TextAnimation>,
    duration: f64,
    local_time: f64,
    measured_width: f64,
    measured_height: f64,
    canvas_w: f64,
    canvas_h: f64,
) -> TextAnimationState {
    let mut out = TextAnimationState::NEUTRAL;
    let mut fold = |c: TextAnimationState| {
        out.offset_x += c.offset_x;
        out.offset_y += c.offset_y;
        out.scale *= c.scale;
    };
    if let Some(a) = animation_in {
        let q = (local_time / a.duration).clamp(0.0, 1.0);
        fold(a.contribution(q, measured_width, measured_height, canvas_w, canvas_h));
    }
    if let Some(a) = animation_out {
        let q = ((duration - local_time) / a.duration).clamp(0.0, 1.0);
        fold(a.contribution(q, measured_width, measured_height, canvas_w, canvas_h));
    }
    out
}

/// Clip-local times where a text animation changes slope; each adjacent pair
/// becomes one ASS event carrying a linear \move / \t across it.
pub fn text_animation_segments(
    animation_in: Option<&TextAnimation>,
    animation_out: Option<&TextAnimation>,
    duration: f64,
) -> Vec<f64> {
    let mut bounds = vec![0.0, duration];
    if let Some(a) = animation_in {
        bounds.push(a.duration.min(duration));
    }
    if let Some(a) = animation_out {
        bounds.push((duration - a.duration).max(0.0));
    }
    bounds.sort_by(|a, b| a.total_cmp(b));
    bounds.dedup_by(|a, b| (*a - *b).abs() < 1e-9);
    bounds
}

impl Clip {
    pub fn id(&self) -> &str {
        match self {
            Clip::Video { id, .. }
            | Clip::Image { id, .. }
            | Clip::Audio { id, .. }
            | Clip::Text { id, .. } => id,
        }
    }

    pub fn start(&self) -> f64 {
        match self {
            Clip::Video { start, .. }
            | Clip::Image { start, .. }
            | Clip::Audio { start, .. }
            | Clip::Text { start, .. } => *start,
        }
    }

    pub fn duration(&self) -> f64 {
        match self {
            Clip::Video { duration, .. }
            | Clip::Image { duration, .. }
            | Clip::Audio { duration, .. }
            | Clip::Text { duration, .. } => *duration,
        }
    }

    pub fn end(&self) -> f64 {
        self.start() + self.duration()
    }

    pub fn transition_out(&self) -> Option<&Transition> {
        match self {
            Clip::Video { transition_out, .. } | Clip::Image { transition_out, .. } => {
                transition_out.as_ref()
            }
            _ => None,
        }
    }

    /// Playback rate; 1.0 for clip types without a speed field.
    pub fn speed(&self) -> f64 {
        match self {
            Clip::Video { speed, .. } | Clip::Audio { speed, .. } => *speed,
            _ => 1.0,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export)]
pub enum TrackKind {
    Video,
    Audio,
    Text,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Track {
    pub id: String,
    pub kind: TrackKind,
    pub name: String,
    pub muted: bool,
    pub hidden: bool,
    /// non-overlapping, sorted by start
    pub clips: Vec<Clip>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct SubtitleCue {
    pub id: String,
    pub start: f64,
    pub end: f64,
    pub text: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct SubtitleTrack {
    pub id: String,
    pub style: TextStyle,
    pub cues: Vec<SubtitleCue>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Project {
    pub schema_version: u32,
    pub id: String,
    pub name: String,
    pub fps: f64,
    pub width: u32,
    pub height: u32,
    /// #rrggbb canvas background
    #[serde(default = "default_canvas_background")]
    pub canvas_background: String,
    /// index 0 = bottom layer
    pub tracks: Vec<Track>,
    pub assets: Vec<Asset>,
    pub subtitles: Option<SubtitleTrack>,
    pub created_at: String,
    pub updated_at: String,
}

impl Project {
    pub fn duration(&self) -> f64 {
        let clips = self
            .tracks
            .iter()
            .flat_map(|t| t.clips.iter())
            .map(|c| c.end())
            .fold(0.0, f64::max);
        let cues = self
            .subtitles
            .iter()
            .flat_map(|s| s.cues.iter())
            .map(|c| c.end)
            .fold(0.0, f64::max);
        clips.max(cues)
    }

    pub fn asset(&self, id: &str) -> Option<&Asset> {
        self.assets.iter().find(|a| a.id == id)
    }
}

/// Encoder quality tier — a closed enum so clients can never inject
/// arbitrary encoder arguments.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export)]
pub enum RenderQuality {
    /// crf 28, veryfast — quick previews
    Draft,
    /// crf 23, medium
    Standard,
    /// crf 18, medium (the original fixed settings)
    #[default]
    High,
}

impl RenderQuality {
    pub fn crf(self) -> u8 {
        match self {
            RenderQuality::Draft => 28,
            RenderQuality::Standard => 23,
            RenderQuality::High => 18,
        }
    }

    pub fn preset(self) -> &'static str {
        match self {
            RenderQuality::Draft => "veryfast",
            RenderQuality::Standard | RenderQuality::High => "medium",
        }
    }

    pub fn audio_bitrate_kbps(self) -> u32 {
        match self {
            RenderQuality::Draft => 128,
            RenderQuality::Standard | RenderQuality::High => 192,
        }
    }
}

fn default_render_scale() -> f64 {
    1.0
}

/// Per-export settings sent alongside the project in a render request.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct RenderOptions {
    #[serde(default)]
    pub quality: RenderQuality,
    /// output resolution as a fraction of the canvas (0.25..=1.0)
    #[serde(default = "default_render_scale")]
    pub scale: f64,
}

impl Default for RenderOptions {
    fn default() -> Self {
        Self {
            quality: RenderQuality::default(),
            scale: 1.0,
        }
    }
}

impl RenderOptions {
    /// Output dimensions: canvas × scale, rounded to even (encoder requirement).
    pub fn output_size(&self, project: &Project) -> (u32, u32) {
        let scale = self.scale.clamp(0.25, 1.0);
        let even = |v: f64| (((v * scale / 2.0).round() as u32) * 2).max(2);
        (even(project.width as f64), even(project.height as f64))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The in-browser exporter has its own copy of this in
    /// web/src/export/localExport.ts (`outputSize`), and the two engines must
    /// agree or the same project exports at different sizes depending on which
    /// one the user picked. These cases are mirrored in localExport.test.ts.
    #[test]
    fn output_size_matches_the_browser_exporter() {
        let project = |w: u32, h: u32| {
            let fixture = include_str!("../../../fixtures/minimal-project.json");
            let mut p: Project = serde_json::from_str(fixture).unwrap();
            p.width = w;
            p.height = h;
            p
        };
        let at = |w, h, scale| {
            RenderOptions {
                quality: RenderQuality::High,
                scale,
            }
            .output_size(&project(w, h))
        };

        assert_eq!(at(1920, 1080, 1.0), (1920, 1080));
        assert_eq!(at(1080, 1920, 1.0), (1080, 1920));
        assert_eq!(at(1920, 1080, 0.5), (960, 540));
        assert_eq!(at(1920, 1080, 0.75), (1440, 810));
        // clamped to the supported range
        assert_eq!(at(1920, 1080, 4.0), (1920, 1080));
        assert_eq!(at(1920, 1080, 0.0), (480, 270));
        // never zero, always even
        let (w, h) = at(4, 2, 0.25);
        assert!(w >= 2 && h >= 2);
        for (w, h) in [(1918, 1080), (1280, 722), (1001, 999)] {
            for scale in [1.0, 0.75, 0.5, 0.25] {
                let (ow, oh) = at(w, h, scale);
                assert_eq!(ow % 2, 0, "{w}x{h} @ {scale}");
                assert_eq!(oh % 2, 0, "{w}x{h} @ {scale}");
            }
        }
    }

    /// Round-trip the fixture project to catch schema drift against the
    /// TypeScript side (fixtures are saved by the frontend).
    #[test]
    fn fixture_roundtrip() {
        let fixture = include_str!("../../../fixtures/minimal-project.json");
        let project: Project = serde_json::from_str(fixture).expect("fixture should deserialize");
        assert_eq!(project.schema_version, SCHEMA_VERSION);
        let back = serde_json::to_string(&project).unwrap();
        let again: Project = serde_json::from_str(&back).unwrap();
        assert_eq!(project, again);
    }
}
