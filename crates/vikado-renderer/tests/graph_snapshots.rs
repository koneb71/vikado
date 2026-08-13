//! Snapshot tests of the emitted filtergraph. If a change here is intended,
//! review the new graph carefully and `cargo insta accept` (or delete the
//! .snap and re-run).

use std::path::PathBuf;
use vikado_renderer::filtergraph::emit_graph;
use vikado_renderer::inputs::ClipInput;
use vikado_types::*;

fn transform() -> Transform {
    Transform {
        x: 0.0,
        y: 0.0,
        scale: 1.0,
        rotation: 0.0,
        opacity: 1.0,
    }
}

fn adjustments() -> ColorAdjustments {
    ColorAdjustments {
        brightness: 0.0,
        contrast: 0.0,
        saturation: 0.0,
        temperature: 0.0,
    }
}

fn video_asset(id: &str) -> Asset {
    Asset {
        id: id.into(),
        kind: AssetKind::Video,
        name: format!("{id}.mp4"),
        hash: format!("hash-{id}"),
        duration: Some(10.0),
        width: Some(1280.0),
        height: Some(720.0),
        fps: Some(30.0),
        has_audio: true,
        mime_type: "video/mp4".into(),
    }
}

fn video_clip(id: &str, asset: &str, start: f64, duration: f64) -> Clip {
    Clip::Video {
        id: id.into(),
        start,
        duration,
        asset_id: asset.into(),
        source_in: 0.0,
        speed: 1.0,
        volume: 1.0,
        muted: false,
        flip_h: false,
        flip_v: false,
        chroma_key: None,
        background_blur: false,
        crop: None,
        transform: transform(),
        keyframes: Keyframes::default(),
        adjustments: adjustments(),
        filter: None,
        fade_in: 0.0,
        fade_out: 0.0,
        transition_out: None,
    }
}

fn project(tracks: Vec<Track>, assets: Vec<Asset>) -> Project {
    Project {
        schema_version: 1,
        id: "p".into(),
        name: "Test".into(),
        fps: 30.0,
        width: 1920,
        height: 1080,
        canvas_background: "#000000".into(),
        tracks,
        assets,
        subtitles: None,
        created_at: "2026-01-01T00:00:00Z".into(),
        updated_at: "2026-01-01T00:00:00Z".into(),
    }
}

fn track(kind: TrackKind, clips: Vec<Clip>) -> Track {
    Track {
        id: format!("t-{kind:?}"),
        kind,
        name: "Track".into(),
        muted: false,
        hidden: false,
        clips,
    }
}

/// Inputs without touching the filesystem.
fn fake_inputs(project: &Project) -> Vec<ClipInput> {
    let mut inputs = Vec::new();
    for t in &project.tracks {
        for c in &t.clips {
            let (is_image, asset_id) = match c {
                Clip::Video { asset_id, .. } => (false, asset_id),
                Clip::Image { asset_id, .. } => (true, asset_id),
                Clip::Audio { asset_id, .. } => (false, asset_id),
                Clip::Text { .. } => continue,
            };
            let hash = &project.asset(asset_id).unwrap().hash;
            inputs.push(ClipInput {
                index: inputs.len(),
                clip_id: c.id().to_string(),
                path: PathBuf::from(format!("/assets/{hash}")),
                is_image,
                image_duration: c.duration(),
            });
        }
    }
    inputs
}

#[test]
fn single_clip() {
    let p = project(
        vec![track(
            TrackKind::Video,
            vec![video_clip("c1", "a1", 0.0, 5.0)],
        )],
        vec![video_asset("a1")],
    );
    let g = emit_graph(&p, &fake_inputs(&p), None, None, &RenderOptions::default());
    insta::assert_snapshot!(g.script);
}

#[test]
fn multi_track_gaps_image_audio() {
    let mut image = video_asset("img");
    image.kind = AssetKind::Image;
    image.duration = None;
    let audio = Asset {
        id: "aud".into(),
        kind: AssetKind::Audio,
        name: "music.mp3".into(),
        hash: "hash-aud".into(),
        duration: Some(30.0),
        width: None,
        height: None,
        fps: None,
        has_audio: true,
        mime_type: "audio/mpeg".into(),
    };
    let p = project(
        vec![
            track(
                TrackKind::Video,
                vec![
                    video_clip("c1", "a1", 0.0, 3.0),
                    // gap 3..4
                    Clip::Image {
                        id: "c2".into(),
                        start: 4.0,
                        duration: 2.0,
                        asset_id: "img".into(),
                        flip_h: false,
                        flip_v: false,
                        chroma_key: None,
                        background_blur: false,
                        crop: None,
                        transform: Transform {
                            x: 100.0,
                            y: -50.0,
                            scale: 0.5,
                            rotation: 15.0,
                            opacity: 0.8,
                        },
                        keyframes: Keyframes::default(),
                        adjustments: adjustments(),
                        filter: Some(FilterPreset::Sepia),
                        fade_in: 0.5,
                        fade_out: 0.5,
                        transition_out: None,
                    },
                ],
            ),
            track(
                TrackKind::Audio,
                vec![Clip::Audio {
                    id: "c3".into(),
                    start: 1.0,
                    duration: 4.0,
                    asset_id: "aud".into(),
                    source_in: 2.0,
                    speed: 1.0,
                    volume: 0.6,
                    fade_in: 1.0,
                    fade_out: 1.0,
                }],
            ),
        ],
        vec![video_asset("a1"), image, audio],
    );
    let g = emit_graph(&p, &fake_inputs(&p), None, None, &RenderOptions::default());
    insta::assert_snapshot!(g.script);
}

#[test]
fn transitions_crossfade_and_slide() {
    let mut c1 = video_clip("c1", "a1", 0.0, 4.0);
    if let Clip::Video { transition_out, .. } = &mut c1 {
        *transition_out = Some(Transition {
            kind: TransitionType::Crossfade,
            duration: 1.0,
        });
    }
    let mut c2 = video_clip("c2", "a1", 4.0, 3.0);
    if let Clip::Video {
        transition_out,
        source_in,
        ..
    } = &mut c2
    {
        *transition_out = Some(Transition {
            kind: TransitionType::SlideLeft,
            duration: 0.6,
        });
        *source_in = 1.0;
    }
    let c3 = video_clip("c3", "a1", 7.0, 2.0);
    let p = project(
        vec![track(TrackKind::Video, vec![c1, c2, c3])],
        vec![video_asset("a1")],
    );
    let g = emit_graph(&p, &fake_inputs(&p), None, None, &RenderOptions::default());
    insta::assert_snapshot!(g.script);
}

#[test]
fn adjustments_and_effects() {
    let mut c1 = video_clip("c1", "a1", 0.0, 5.0);
    if let Clip::Video {
        adjustments,
        filter,
        fade_in,
        fade_out,
        transform,
        ..
    } = &mut c1
    {
        *adjustments = ColorAdjustments {
            brightness: 0.1,
            contrast: 0.2,
            saturation: -0.3,
            temperature: 0.5,
        };
        *filter = Some(FilterPreset::Grayscale);
        *fade_in = 0.5;
        *fade_out = 1.0;
        transform.opacity = 0.9;
        transform.rotation = -10.0;
    }
    let p = project(
        vec![track(TrackKind::Video, vec![c1])],
        vec![video_asset("a1")],
    );
    let g = emit_graph(
        &p,
        &fake_inputs(&p),
        Some("/work/overlays.ass"),
        Some("/fonts"),
        &RenderOptions::default(),
    );
    insta::assert_snapshot!(g.script);
}

#[test]
fn speed_flip_background() {
    let mut c1 = video_clip("c1", "a1", 0.0, 4.0);
    if let Clip::Video {
        speed,
        flip_h,
        source_in,
        ..
    } = &mut c1
    {
        *speed = 2.0; // consumes 8s of source
        *flip_h = true;
        *source_in = 1.0;
    }
    let mut c2 = video_clip("c2", "a1", 4.0, 2.0);
    if let Clip::Video { speed, flip_v, .. } = &mut c2 {
        *speed = 0.25; // atempo must chain 0.5×0.5
        *flip_v = true;
    }
    let mut p = project(
        vec![track(TrackKind::Video, vec![c1, c2])],
        vec![video_asset("a1")],
    );
    p.canvas_background = "#1a2b3c".into();
    let g = emit_graph(&p, &fake_inputs(&p), None, None, &RenderOptions::default());
    insta::assert_snapshot!(g.script);
}

#[test]
fn ass_aligned_text() {
    use vikado_types::{TextAlign, TextStyle};
    let text_clip = |id: &str, align: TextAlign, measured: f64| Clip::Text {
        id: id.into(),
        start: 0.0,
        duration: 3.0,
        text: "Two lines of\ndifferent width".into(),
        style: TextStyle {
            font_family: "Inter".into(),
            font_size: 72.0,
            font_weight: 700,
            italic: false,
            color: "#ffffff".into(),
            background_color: None,
            outline_color: Some("#000000".into()),
            outline_width: 2.0,
            align,
        },
        transform: Transform {
            x: 120.0,
            y: -80.0,
            scale: 1.5,
            rotation: 0.0,
            opacity: 1.0,
        },
        keyframes: Keyframes::default(),
        measured_width: measured,
        measured_height: 200.0,
        fade_in: 0.0,
        fade_out: 0.0,
    };
    let left = text_clip("t-left", TextAlign::Left, 640.0);
    let center = text_clip("t-center", TextAlign::Center, 640.0);
    let right = text_clip("t-right", TextAlign::Right, 640.0);
    // unmeasured clip must fall back to centered anchoring
    let unmeasured = text_clip("t-unmeasured", TextAlign::Left, 0.0);
    let p = project(
        vec![track(
            TrackKind::Text,
            vec![left, center, right, unmeasured],
        )],
        vec![],
    );
    let doc = vikado_renderer::ass::emit_ass(&p);
    insta::assert_snapshot!(doc.content);
}

#[test]
fn export_downscale_appends_final_scale() {
    let p = project(
        vec![track(
            TrackKind::Video,
            vec![video_clip("c1", "a1", 0.0, 5.0)],
        )],
        vec![video_asset("a1")],
    );
    let options = RenderOptions {
        quality: RenderQuality::Draft,
        scale: 0.5,
    };
    let g = emit_graph(&p, &fake_inputs(&p), None, None, &options);
    assert!(g.script.contains("scale=960:540:flags=lanczos"));
    assert_eq!(g.video_out, "vscaled");
    insta::assert_snapshot!(g.script);
}

#[test]
fn keyframe_animation_expressions() {
    let kf = |t: f64, value: f64, easing: Easing| Keyframe { t, value, easing };
    let mut c1 = video_clip("c1", "a1", 2.0, 4.0);
    if let Clip::Video { keyframes, .. } = &mut c1 {
        *keyframes = Keyframes {
            x: vec![
                kf(0.0, -200.0, Easing::Linear),
                kf(4.0, 200.0, Easing::Linear),
            ],
            y: vec![],
            scale: vec![
                kf(0.0, 0.5, Easing::EaseIn),
                kf(2.0, 1.0, Easing::EaseOut),
                kf(4.0, 0.8, Easing::Linear),
            ],
            rotation: vec![
                kf(0.0, 0.0, Easing::EaseInOut),
                kf(4.0, 90.0, Easing::Linear),
            ],
            opacity: vec![kf(3.0, 1.0, Easing::Linear), kf(4.0, 0.0, Easing::Linear)],
        };
    }
    let p = project(
        vec![track(TrackKind::Video, vec![c1])],
        vec![video_asset("a1")],
    );
    let g = emit_graph(&p, &fake_inputs(&p), None, None, &RenderOptions::default());
    // animated scale must evaluate per frame; overlay x is time-based
    assert!(g.script.contains("eval=frame"));
    assert!(g.script.contains("(t-2)"));
    insta::assert_snapshot!(g.script);
}

#[test]
fn capcut_chroma_crop_bgblur() {
    // bottom: full-frame clip with background blur; top: keyed + cropped clip
    let mut c1 = video_clip("c1", "a1", 0.0, 4.0);
    if let Clip::Video {
        background_blur,
        transform,
        ..
    } = &mut c1
    {
        *background_blur = true;
        transform.scale = 0.7;
    }
    let mut c2 = video_clip("c2", "a2", 0.5, 3.0);
    if let Clip::Video {
        chroma_key, crop, ..
    } = &mut c2
    {
        *chroma_key = Some(ChromaKey {
            color: "#00d000".into(),
            similarity: 0.3,
            blend: 0.1,
        });
        *crop = Some(Crop {
            x: 0.1,
            y: 0.05,
            w: 0.8,
            h: 0.9,
        });
    }
    let p = project(
        vec![
            track(TrackKind::Video, vec![c1]),
            Track {
                id: "t2".into(),
                kind: TrackKind::Video,
                name: "Track 2".into(),
                muted: false,
                hidden: false,
                clips: vec![c2],
            },
        ],
        vec![video_asset("a1"), video_asset("a2")],
    );
    let g = emit_graph(&p, &fake_inputs(&p), None, None, &RenderOptions::default());
    assert!(g.script.contains("split"));
    assert!(g.script.contains("gblur"));
    assert!(g.script.contains("colorkey=color=0x00d000"));
    assert!(g.script.contains("crop=w='iw*0.8'"));
    insta::assert_snapshot!(g.script);
}
