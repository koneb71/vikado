//! Text clips + subtitle cues → one ASS file rendered by libass via the
//! `subtitles=` filter. PlayResX/Y are set to the output resolution so ASS
//! pixel coordinates equal canvas pixels — the same numbers the browser
//! preview uses (fonts are the same bundled TTFs on both sides).

use std::fmt::Write as _;
use vikado_types::{Clip, Project, TextAlign, TextStyle, TrackKind};

fn ass_time(s: f64) -> String {
    let cs = (s.max(0.0) * 100.0).round() as u64;
    let h = cs / 360_000;
    let m = (cs % 360_000) / 6_000;
    let sec = (cs % 6_000) / 100;
    let c = cs % 100;
    format!("{h}:{m:02}:{sec:02}.{c:02}")
}

/// "#rrggbb" → ASS "&HAABBGGRR" (alpha 00 = opaque).
fn ass_color(hex: &str, alpha: u8) -> String {
    let h = hex.trim_start_matches('#');
    let r = u8::from_str_radix(&h[0..2], 16).unwrap_or(255);
    let g = u8::from_str_radix(&h[2..4], 16).unwrap_or(255);
    let b = u8::from_str_radix(&h[4..6], 16).unwrap_or(255);
    format!("&H{alpha:02X}{b:02X}{g:02X}{r:02X}")
}

fn escape_text(text: &str) -> String {
    // ASS: newlines are \N; braces start override blocks
    text.replace('\\', "\\\\")
        .replace('{', "(")
        .replace('}', ")")
        .replace('\n', "\\N")
}

/// Style-level parts shared by a whole style; per-event overrides carry the rest.
/// `alignment` is the ASS \an code — it also controls how libass justifies
/// multiple lines within the block, which is why it must follow style.align.
fn style_line(name: &str, style: &TextStyle, alignment: u8, project: &Project) -> String {
    let bold = if style.font_weight >= 700 { -1 } else { 0 };
    let italic = if style.italic { -1 } else { 0 };
    let outline = style.outline_width;
    let outline_color = style
        .outline_color
        .as_deref()
        .map(|c| ass_color(c, 0))
        .unwrap_or_else(|| "&H00000000".into());
    // BorderStyle 3 = opaque box (background); 1 = outline + shadow
    let (border_style, back_color) = match &style.background_color {
        Some(bg) => (3, ass_color(bg, 0)),
        None => (1, "&H00000000".to_string()),
    };
    let _ = project;
    format!(
        "Style: {name},{font},{size},{primary},{primary},{outline_color},{back},{bold},{italic},0,0,100,100,0,0,{border_style},{outline},0,{alignment},0,0,0,1",
        font = style.font_family,
        size = style.font_size.round() as i64,
        primary = ass_color(&style.color, 0),
        back = back_color,
        outline = outline,
    )
}

pub struct AssDoc {
    pub content: String,
    pub is_empty: bool,
}

pub fn emit_ass(project: &Project) -> AssDoc {
    let mut styles: Vec<String> = Vec::new();
    let mut events: Vec<(f64, String)> = Vec::new();
    let w = project.width as f64;
    let h = project.height as f64;

    // text clips
    let mut style_idx = 0usize;
    for track in &project.tracks {
        if track.kind != TrackKind::Text || track.hidden {
            continue;
        }
        for clip in &track.clips {
            let Clip::Text {
                start,
                duration,
                text,
                style,
                transform,
                measured_width,
                fade_in,
                fade_out,
                ..
            } = clip
            else {
                continue;
            };
            // Anchor + per-line justification follow style.align. The preview
            // positions the block by its CENTER; for left/right we shift the
            // anchor to the block's visible edge using the editor-measured
            // width (minus the canvas padding TextRenderer adds around the
            // glyphs), scaled like the preview scales around the center.
            // Unknown measurement (0) falls back to centered.
            let pad = style.font_size * 0.25; // = TextRenderer PADDING × fontSize
            let half = ((measured_width / 2.0) - pad).max(0.0) * transform.scale;
            let (alignment, px) = match (style.align, *measured_width > 0.0) {
                (TextAlign::Left, true) => (4, w / 2.0 + transform.x - half),
                (TextAlign::Right, true) => (6, w / 2.0 + transform.x + half),
                _ => (5, w / 2.0 + transform.x),
            };
            let name = format!("T{style_idx}");
            styles.push(style_line(&name, style, alignment, project));
            style_idx += 1;

            // transform x/y are offsets from canvas center
            let py = h / 2.0 + transform.y;
            let mut ovr = format!("\\pos({},{})", px.round(), py.round());
            if transform.rotation != 0.0 {
                // ASS \frz is counter-clockwise; our rotation is clockwise
                let _ = write!(ovr, "\\frz{}", -transform.rotation.round());
            }
            if transform.scale != 1.0 {
                let pct = (transform.scale * 100.0).round();
                let _ = write!(ovr, "\\fscx{pct}\\fscy{pct}");
            }
            if transform.opacity < 1.0 {
                let a = (255.0 * (1.0 - transform.opacity)).round() as u8;
                let _ = write!(ovr, "\\alpha&H{a:02X}&");
            }
            if *fade_in > 0.0 || *fade_out > 0.0 {
                let _ = write!(
                    ovr,
                    "\\fad({},{})",
                    (*fade_in * 1000.0).round() as i64,
                    (*fade_out * 1000.0).round() as i64
                );
            }
            events.push((
                *start,
                format!(
                    "Dialogue: 1,{},{},{name},,0,0,0,,{{{ovr}}}{}",
                    ass_time(*start),
                    ass_time(start + duration),
                    escape_text(text)
                ),
            ));
        }
    }

    // subtitle cues: bottom-center with a 5% margin (matches preview)
    if let Some(subs) = &project.subtitles {
        let name = "Subs";
        // cues are always bottom-center anchored (\an2), lines centered
        styles.push(style_line(name, &subs.style, 2, project));
        let margin_v = (h * 0.05).round() as i64;
        for cue in &subs.cues {
            // \an2 bottom-center anchored via style margins
            events.push((
                cue.start,
                format!(
                    "Dialogue: 0,{},{},{name},,0,0,{margin_v},,{{\\an2}}{}",
                    ass_time(cue.start),
                    ass_time(cue.end),
                    escape_text(&cue.text)
                ),
            ));
        }
    }

    let is_empty = events.is_empty();
    events.sort_by(|a, b| a.0.total_cmp(&b.0));

    let mut out = String::new();
    let _ = writeln!(out, "[Script Info]");
    let _ = writeln!(out, "ScriptType: v4.00+");
    let _ = writeln!(out, "PlayResX: {}", project.width);
    let _ = writeln!(out, "PlayResY: {}", project.height);
    let _ = writeln!(out, "WrapStyle: 2"); // no automatic wrapping: explicit \N only
    let _ = writeln!(out, "ScaledBorderAndShadow: yes");
    let _ = writeln!(out);
    let _ = writeln!(out, "[V4+ Styles]");
    let _ = writeln!(out, "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding");
    for s in &styles {
        let _ = writeln!(out, "{s}");
    }
    let _ = writeln!(out);
    let _ = writeln!(out, "[Events]");
    let _ = writeln!(
        out,
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"
    );
    for (_, e) in &events {
        let _ = writeln!(out, "{e}");
    }

    AssDoc {
        content: out,
        is_empty,
    }
}
