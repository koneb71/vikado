//! Golden render tests: run real ffmpeg over the fixture media and assert
//! the output's shape with ffprobe. Requires ffmpeg/ffprobe on PATH and the
//! fixture media in /fixtures — run with:
//!   cargo test -p vikado-renderer --test golden_render -- --ignored

use std::path::{Path, PathBuf};
use std::process::Command;
use vikado_renderer::{render, CancellationToken, RenderRequest};
use vikado_types::*;

const BARS_HASH: &str = "0c02e486f1f11f52366e6d1ae0bba2b70108d03b9feb512cd882920c18425571";
const COUNTDOWN_HASH: &str = "9481f3fd1efab428b122b3dd55dcf64f8b956d628ff8470b69a3c122c92a59ca";

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

/// Stage fixture media under hash names in a temp dir.
fn stage_assets(dir: &Path) {
    std::fs::create_dir_all(dir).unwrap();
    let media = repo_root().join("fixtures/media");
    for (file, hash) in [("bars.mp4", BARS_HASH), ("countdown.mp4", COUNTDOWN_HASH)] {
        std::fs::copy(media.join(file), dir.join(hash)).unwrap();
    }
}

fn probe_duration(path: &Path) -> f64 {
    let out = Command::new("ffprobe")
        .args([
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "csv=p=0",
        ])
        .arg(path)
        .output()
        .unwrap();
    String::from_utf8_lossy(&out.stdout).trim().parse().unwrap()
}

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

fn asset(id: &str, name: &str, hash: &str, duration: f64) -> Asset {
    Asset {
        id: id.into(),
        kind: AssetKind::Video,
        name: name.into(),
        hash: hash.into(),
        duration: Some(duration),
        width: Some(1280.0),
        height: Some(720.0),
        fps: Some(30.0),
        has_audio: true,
        mime_type: "video/mp4".into(),
    }
}

#[tokio::test]
#[ignore = "requires ffmpeg + fixture media"]
async fn transitions_filters_golden() {
    let tmp = std::env::temp_dir().join("vikado-golden");
    let assets_dir = tmp.join("assets");
    stage_assets(&assets_dir);

    let mut c1 = Clip::Video {
        id: "c1".into(),
        start: 0.0,
        duration: 3.0,
        asset_id: "countdown".into(),
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
        adjustments: ColorAdjustments {
            brightness: 0.1,
            contrast: 0.1,
            saturation: 0.2,
            temperature: -0.3,
        },
        filter: Some(FilterPreset::Warm),
        fade_in: 0.3,
        fade_out: 0.0,
        transition_out: Some(Transition {
            kind: TransitionType::Crossfade,
            duration: 1.0,
        }),
    };
    // keep c1's fields exercised
    if let Clip::Video { .. } = &mut c1 {}
    let c2 = Clip::Video {
        id: "c2".into(),
        start: 3.0,
        duration: 3.0,
        asset_id: "bars".into(),
        source_in: 0.5,
        // slow-motion leg: exercises setpts/speed + atempo in a real render
        speed: 0.5,
        volume: 0.5,
        muted: false,
        flip_h: true,
        flip_v: false,
        chroma_key: None,
        background_blur: false,
        crop: None,
        transform: Transform {
            x: 0.0,
            y: 0.0,
            scale: 1.0,
            rotation: 0.0,
            opacity: 1.0,
        },
        keyframes: Keyframes::default(),
        adjustments: adjustments(),
        filter: Some(FilterPreset::Grayscale),
        fade_in: 0.0,
        fade_out: 0.5,
        transition_out: None,
    };

    let project = Project {
        schema_version: 1,
        id: "golden".into(),
        name: "Golden".into(),
        fps: 30.0,
        width: 1280,
        height: 720,
        canvas_background: "#101020".into(),
        tracks: vec![Track {
            id: "t1".into(),
            kind: TrackKind::Video,
            name: "Track 1".into(),
            muted: false,
            hidden: false,
            clips: vec![c1, c2],
        }],
        assets: vec![
            asset("countdown", "countdown.mp4", COUNTDOWN_HASH, 5.0),
            asset("bars", "bars.mp4", BARS_HASH, 4.0),
        ],
        subtitles: Some(SubtitleTrack {
            id: "subs".into(),
            style: TextStyle {
                font_family: "Inter".into(),
                font_size: 40.0,
                font_weight: 700,
                italic: false,
                color: "#ffff00".into(),
                background_color: None,
                outline_color: Some("#000000".into()),
                outline_width: 2.0,
                align: TextAlign::Center,
                letter_spacing: 0.0,
                shadow: None,
                text_transform: TextTransform::None,
            },
            cues: vec![SubtitleCue {
                id: "q1".into(),
                start: 0.5,
                end: 5.5,
                text: "Golden test".into(),
            }],
        }),
        created_at: "2026-01-01T00:00:00Z".into(),
        updated_at: "2026-01-01T00:00:00Z".into(),
    };

    let out = tmp.join("golden.mp4");
    let fonts = repo_root().join("web/public/fonts");
    render(
        RenderRequest {
            project: &project,
            assets_dir: &assets_dir,
            work_dir: &tmp.join("work"),
            fonts_dir: Some(&fonts),
            out_path: &out,
            options: RenderOptions {
                quality: RenderQuality::Draft, // exercise the options path; draft keeps CI fast
                scale: 0.5,
            },
        },
        |_| {},
        &CancellationToken::new(),
    )
    .await
    .expect("render should succeed");

    let duration = probe_duration(&out);
    assert!((duration - 6.0).abs() < 0.2, "expected ~6s, got {duration}");
}

/// Every filter preset is authored ONCE as a 4x4 colour matrix in
/// web/src/schema/filters.ts (the shader applies it with a single clamp at the
/// end) and mirrored here as an ffmpeg chain. The two can silently diverge:
/// `colorchannelmixer` clamps to [0,255] BEFORE a following `lutrgb` applies
/// its constant, so a preset with a NEGATIVE offset reads back wrong wherever
/// the mixer saturates — noir was 64/255 off in the highlights that way, which
/// is why it uses `eq=contrast` instead.
///
/// This pushes solid colours (including the saturating extremes) through real
/// ffmpeg and compares against the matrix the shader uses.
#[test]
#[ignore = "requires ffmpeg"]
fn filter_presets_match_the_shader_matrices() {
    // rows of [r, g, b, offset], exactly as in web/src/schema/filters.ts
    let presets: &[(FilterPreset, [f64; 12])] = &[
        (
            FilterPreset::Grayscale,
            [
                0.299, 0.587, 0.114, 0.0, 0.299, 0.587, 0.114, 0.0, 0.299, 0.587, 0.114, 0.0,
            ],
        ),
        (
            FilterPreset::Sepia,
            [
                0.393, 0.769, 0.189, 0.0, 0.349, 0.686, 0.168, 0.0, 0.272, 0.534, 0.131, 0.0,
            ],
        ),
        (
            FilterPreset::Vintage,
            [
                0.5, 0.35, 0.1, 0.06, 0.3, 0.55, 0.1, 0.05, 0.2, 0.25, 0.4, 0.08,
            ],
        ),
        (
            FilterPreset::Cool,
            [
                0.92, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.02, 0.0, 0.0, 1.08, 0.03,
            ],
        ),
        (
            FilterPreset::Warm,
            [
                1.08, 0.0, 0.0, 0.03, 0.0, 1.0, 0.0, 0.02, 0.0, 0.0, 0.92, 0.0,
            ],
        ),
        (
            FilterPreset::Noir,
            [
                0.4485, 0.8805, 0.171, -0.25, 0.4485, 0.8805, 0.171, -0.25, 0.4485, 0.8805, 0.171,
                -0.25,
            ],
        ),
        (
            FilterPreset::Vivid,
            [
                1.2804, -0.2348, -0.0456, 0.0, -0.1196, 1.1652, -0.0456, 0.0, -0.1196, -0.2348,
                1.3544, 0.0,
            ],
        ),
        (
            FilterPreset::Faded,
            [
                0.7338, 0.0722, 0.014, 0.1, 0.0368, 0.7692, 0.014, 0.1, 0.0368, 0.0722, 0.711, 0.12,
            ],
        ),
        (
            FilterPreset::Cyberpunk,
            [
                1.15, 0.0, -0.05, 0.0, -0.05, 0.95, 0.1, 0.0, 0.1, 0.05, 1.2, 0.05,
            ],
        ),
        (
            FilterPreset::Sunset,
            [
                1.18, 0.06, 0.0, 0.04, 0.02, 0.98, 0.02, 0.0, 0.0, 0.04, 0.88, 0.03,
            ],
        ),
        (
            FilterPreset::Mint,
            [
                0.88, 0.02, 0.0, 0.0, 0.0, 1.06, 0.04, 0.02, 0.0, 0.06, 1.02, 0.03,
            ],
        ),
    ];
    // mid tones plus the extremes, where clamp ORDER shows up
    let samples = [
        (64u8, 128u8, 192u8),
        (200, 60, 30),
        (20, 20, 20),
        (240, 240, 240),
        (255, 255, 255),
        (0, 0, 0),
        (255, 0, 0),
        (0, 255, 0),
        (0, 0, 255),
    ];
    // BT.601 round trips through YUV inside ffmpeg, so a couple of levels of
    // slack is expected; anything larger is a real mismatch in the chain.
    const TOLERANCE: i32 = 8;

    let mut failures = Vec::new();
    for (preset, m) in presets {
        let chain = vikado_renderer::filtergraph::preset_chain_for_test(*preset).join(",");
        // the emitted chain escapes commas for filter_complex; undo that here
        let chain = chain.replace("\\,", ",");
        for (r, g, b) in samples {
            let expect: Vec<i32> = (0..3)
                .map(|i| {
                    let v = m[i * 4] * r as f64 / 255.0
                        + m[i * 4 + 1] * g as f64 / 255.0
                        + m[i * 4 + 2] * b as f64 / 255.0
                        + m[i * 4 + 3];
                    (v.clamp(0.0, 1.0) * 255.0).round() as i32
                })
                .collect();
            let got = run_chain(&chain, (r, g, b));
            let diff = (0..3).map(|i| (expect[i] - got[i]).abs()).max().unwrap();
            if diff > TOLERANCE {
                failures.push(format!(
                    "{preset:?} on rgb({r},{g},{b}): shader {expect:?} vs ffmpeg {got:?} (diff {diff})"
                ));
            }
        }
    }
    assert!(
        failures.is_empty(),
        "colour parity broke:\n  {}",
        failures.join("\n  ")
    );
}

/// Push one solid colour through a filter chain and read the result back.
fn run_chain(chain: &str, (r, g, b): (u8, u8, u8)) -> Vec<i32> {
    let out = Command::new("ffmpeg")
        .args([
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            &format!("color=c=#{r:02x}{g:02x}{b:02x}:s=8x8:d=0.1"),
            "-vf",
            &format!("format=rgb24,{chain},format=rgb24"),
            "-frames:v",
            "1",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgb24",
            "-",
        ])
        .output()
        .expect("ffmpeg");
    assert!(
        out.status.success(),
        "ffmpeg failed for chain {chain}: {}",
        String::from_utf8_lossy(&out.stderr)
    );
    out.stdout[..3].iter().map(|v| *v as i32).collect()
}
