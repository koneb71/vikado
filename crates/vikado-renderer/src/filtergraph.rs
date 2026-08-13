//! Project → `filter_complex` script compiler.
//!
//! Model: a black base canvas at project fps/size; every visual clip becomes
//! one prepared stream (trim → fps → scale → effects → alpha fades → timeline
//! shift) overlaid onto the accumulating base with an `enable` time window.
//! This mirrors the browser preview's layer stack exactly, including the
//! transition semantics (window centered on the cut, incoming clip blended
//! on top). Audio is atrim/volume/afade/adelay per clip into one `amix`.
//!
//! COLOR MATH CONTRACT (must match web/src/engine/compositor/shaders.ts):
//!   brightness b: eq brightness=b ; contrast c: eq contrast=1+c ;
//!   saturation s: eq saturation=1+s ; temperature w: lutrgb r+=25.5w, b-=25.5w.

use std::fmt::Write as _;
use vikado_types::{
    Clip, Easing, FilterPreset, Keyframe, Project, RenderOptions, TrackKind, Transition,
    TransitionType,
};

use crate::inputs::{input_for, ClipInput};

/// Compile one keyframe track into an ffmpeg expression over local time
/// `tvar` (an expression string, e.g. "(t-2)"). Mirrors the math in
/// web/src/lib/keyframes.ts: clamp outside the range, interpolate with the
/// LEFT keyframe's easing inside. Commas are escaped for quoted filter args.
/// `map` converts keyframe values (e.g. degrees → radians).
fn kf_expr(track: &[Keyframe], tvar: &str, map: impl Fn(f64) -> f64) -> String {
    assert!(!track.is_empty());
    if track.len() == 1 {
        return f(map(track[0].value));
    }
    // innermost fallback: clamp to the last keyframe
    let mut expr = f(map(track[track.len() - 1].value));
    for i in (0..track.len() - 1).rev() {
        let a = &track[i];
        let b = &track[i + 1];
        let v0 = map(a.value);
        let dv = map(b.value) - v0;
        let dt = (b.t - a.t).max(1e-9);
        // p stored in st(0) so easing warps reuse it
        let p = format!("st(0\\,({tvar}-{t0})/{dt})", t0 = f(a.t), dt = f(dt));
        let warped = match a.easing {
            Easing::Linear => p,
            Easing::EaseIn => format!("{p}*ld(0)"),
            Easing::EaseOut => format!("{p}*(2-ld(0))"),
            Easing::EaseInOut => format!("{p}*ld(0)*(3-2*ld(0))"),
        };
        let segment = format!("{}+{}*{warped}", f(v0), f(dv));
        expr = format!("if(lt({tvar}\\,{t1})\\,{segment}\\,{expr})", t1 = f(b.t));
    }
    // clamp before the first keyframe
    format!(
        "if(lt({tvar}\\,{t0})\\,{v0}\\,{expr})",
        t0 = f(track[0].t),
        v0 = f(map(track[0].value))
    )
}

/// Format a float compactly but precisely for filter args.
fn f(v: f64) -> String {
    if (v - v.round()).abs() < 1e-9 {
        format!("{}", v.round() as i64)
    } else {
        let s = format!("{v:.6}");
        s.trim_end_matches('0').trim_end_matches('.').to_string()
    }
}

struct VisualClip<'a> {
    clip: &'a Clip,
    input_index: usize,
    is_image: bool,
    /// transition INTO this clip (it is the incoming B side)
    transition_in: Option<&'a Transition>,
    /// transition OUT of this clip (it is the outgoing A side)
    transition_out_adj: Option<&'a Transition>,
}

pub struct Graph {
    pub script: String,
    pub video_out: String,
    pub audio_out: String,
    pub has_audio: bool,
}

pub fn emit_graph(
    project: &Project,
    inputs: &[ClipInput],
    ass_path: Option<&str>,
    fonts_dir: Option<&str>,
    options: &RenderOptions,
) -> Graph {
    let mut g = String::new();
    let width = project.width;
    let height = project.height;
    let fps = project.fps;
    let duration = project.duration().max(0.1);

    // ---- collect visual clips bottom-up with transition adjacency resolved
    let mut visuals: Vec<VisualClip> = Vec::new();
    for track in &project.tracks {
        if track.kind == TrackKind::Audio || track.hidden {
            continue;
        }
        let clips = &track.clips;
        for (i, clip) in clips.iter().enumerate() {
            if !matches!(clip, Clip::Video { .. } | Clip::Image { .. }) {
                continue;
            }
            let Some(input) = input_for(inputs, clip.id()) else {
                continue;
            };

            // A→B adjacency: transition applies only when B starts at A's end
            let transition_out_adj = clip.transition_out().filter(|_| {
                clips
                    .get(i + 1)
                    .map(|next| (next.start() - clip.end()).abs() < 1e-6)
                    .unwrap_or(false)
            });
            let transition_in = i
                .checked_sub(1)
                .and_then(|pi| clips.get(pi))
                .filter(|prev| (clip.start() - prev.end()).abs() < 1e-6)
                .and_then(|prev| prev.transition_out());

            visuals.push(VisualClip {
                clip,
                input_index: input.index,
                is_image: input.is_image,
                transition_in,
                transition_out_adj,
            });
        }
    }

    // ---- per-clip prepared streams
    let mut bg_labels: Vec<Option<String>> = vec![None; visuals.len()];
    for (vi, v) in visuals.iter().enumerate() {
        let clip = v.clip;
        let start = clip.start();
        let dur = clip.duration();
        // extend by half the window on each transitioning side
        let ext_out = v.transition_out_adj.map_or(0.0, |t| t.duration / 2.0);
        let ext_in = v.transition_in.map_or(0.0, |t| t.duration / 2.0);
        let eff_start = start - ext_in; // timeline start incl. transition lead-in
        let eff_dur = dur + ext_in + ext_out;

        let (
            source_in,
            transform,
            keyframes,
            adjustments,
            filter,
            fade_in,
            fade_out,
            flip_h,
            flip_v,
            chroma_key,
            background_blur,
            crop,
        ) = match clip {
            Clip::Video {
                source_in,
                transform,
                keyframes,
                adjustments,
                filter,
                fade_in,
                fade_out,
                flip_h,
                flip_v,
                chroma_key,
                background_blur,
                crop,
                ..
            } => (
                *source_in,
                transform,
                keyframes,
                adjustments,
                filter,
                *fade_in,
                *fade_out,
                *flip_h,
                *flip_v,
                chroma_key,
                *background_blur,
                crop,
            ),
            Clip::Image {
                transform,
                keyframes,
                adjustments,
                filter,
                fade_in,
                fade_out,
                flip_h,
                flip_v,
                chroma_key,
                background_blur,
                crop,
                ..
            } => (
                0.0,
                transform,
                keyframes,
                adjustments,
                filter,
                *fade_in,
                *fade_out,
                *flip_h,
                *flip_v,
                chroma_key,
                *background_blur,
                crop,
            ),
            _ => unreachable!(),
        };
        // clip-local time inside the prepared chain: chain t=0 is eff_start
        let chain_t = if ext_in > 0.0 {
            format!("(t-{})", f(ext_in))
        } else {
            "t".to_string()
        };
        let geq_t = if ext_in > 0.0 {
            format!("(T-{})", f(ext_in))
        } else {
            "T".to_string()
        };
        let speed = clip.speed();

        let mut chain: Vec<String> = Vec::new();
        if v.is_image {
            // -loop 1 -t eff_dur inputs are pre-cut; just normalize timestamps
            chain.push("setpts=PTS-STARTPTS".into());
        } else {
            // transition extensions are timeline seconds; source consumption
            // scales with the playback rate
            let trim_start = (source_in - ext_in * speed).max(0.0);
            chain.push(format!(
                "trim=start={}:end={}",
                f(trim_start),
                f(trim_start + eff_dur * speed)
            ));
            if speed != 1.0 {
                chain.push(format!("setpts=(PTS-STARTPTS)/{}", f(speed)));
            } else {
                chain.push("setpts=PTS-STARTPTS".into());
            }
        }
        // source crop (normalized rect) before fit-scaling — the contain-fit
        // math then works on the cropped dimensions, matching the preview.
        // x/y are clamped so the rect stays inside the frame (schema allows
        // hand-edited JSON where x+w > 1; the shader clamps identically).
        if let Some(c) = crop {
            chain.push(format!(
                "crop=w='iw*{w}':h='ih*{h}':x='iw*{x}':y='ih*{y}'",
                w = f(c.w),
                h = f(c.h),
                x = f(c.x.min(1.0 - c.w).max(0.0)),
                y = f(c.y.min(1.0 - c.h).max(0.0))
            ));
        }
        chain.push(format!("fps={}", f(fps)));
        if flip_h {
            chain.push("hflip".into());
        }
        if flip_v {
            chain.push("vflip".into());
        }
        // CHROMA KEY CONTRACT (mirrors web/src/engine/compositor/shaders.ts):
        // keying happens on decoded RGB with colorkey's euclidean distance —
        // NOT yuv chromakey, whose limited-range plane comparison gives a
        // colorspace-dependent threshold offset the browser preview can't
        // reproduce. Both sides now compute
        //   diff = |rgb - key| / (255*sqrt(3)); alpha ramps over
        //   [similarity, similarity+blend]
        // on the same decoded RGB pixels.
        chain.push("format=rgba".into());
        if let Some(key) = chroma_key {
            let color = key.color.trim_start_matches('#');
            chain.push(format!(
                "colorkey=color=0x{color}:similarity={}:blend={}",
                f(key.similarity.max(0.01)),
                f(key.blend)
            ));
        }
        // the shared prefix ends here — a background-blur backdrop branches
        // off with everything above (trim/speed/crop/flips/rgba/key) applied
        let prefix_len = chain.len();

        // contain-fit then user scale (matches Compositor.layerMatrix);
        // keyframed scale animates per-frame via expressions over t
        if keyframes.scale.is_empty() {
            chain.push(format!(
                "scale=w='min({w}/iw\\,{h}/ih)*iw*{s}':h='min({w}/iw\\,{h}/ih)*ih*{s}':eval=init",
                w = width,
                h = height,
                s = f(transform.scale)
            ));
        } else {
            let s_expr = kf_expr(&keyframes.scale, &chain_t, |v| v.max(0.01));
            chain.push(format!(
                "scale=w='min({w}/iw\\,{h}/ih)*iw*({s})':h='min({w}/iw\\,{h}/ih)*ih*({s})':eval=frame",
                w = width,
                h = height,
                s = s_expr
            ));
        }

        // color adjustments (skip identity for graph readability)
        let a = adjustments;
        if a.brightness != 0.0 || a.contrast != 0.0 || a.saturation != 0.0 {
            chain.push(format!(
                "eq=brightness={}:contrast={}:saturation={}",
                f(a.brightness),
                f(1.0 + a.contrast),
                f(1.0 + a.saturation)
            ));
        }
        if a.temperature != 0.0 {
            let shift = 25.5 * a.temperature;
            chain.push(format!(
                "lutrgb=r='clip(val+{r}\\,0\\,255)':b='clip(val-{b}\\,0\\,255)'",
                r = f(shift),
                b = f(shift)
            ));
        }
        if let Some(preset) = filter {
            for step in preset_chain(*preset) {
                chain.push(step);
            }
        }

        if !keyframes.rotation.is_empty() || transform.rotation != 0.0 {
            // rotate's ow/oh are evaluated ONCE at init: with an animated
            // scale upstream the frame would be cropped once it outgrows the
            // initial canvas. Size the canvas for the clip's MAX scale using
            // the asset's known dimensions; fall back to the dynamic hypot
            // (safe while scale is static) when dimensions are unknown.
            let asset_dims = match clip {
                Clip::Video { asset_id, .. } | Clip::Image { asset_id, .. } => {
                    project.asset(asset_id).and_then(|a| a.width.zip(a.height))
                }
                _ => None,
            };
            let canvas = asset_dims.map(|(aw, ah)| {
                let fit = (width as f64 / aw).min(height as f64 / ah);
                let max_scale = keyframes
                    .scale
                    .iter()
                    .map(|k| k.value)
                    .fold(transform.scale, f64::max)
                    .max(0.01);
                let diag = ((aw * fit * max_scale).hypot(ah * fit * max_scale)).ceil() as u64;
                // libx264-friendly even dimension
                diag + (diag % 2)
            });
            let (ow, oh) = match canvas {
                Some(d) => (d.to_string(), d.to_string()),
                None => ("'hypot(iw\\,ih)'".into(), "'hypot(iw\\,ih)'".into()),
            };
            if !keyframes.rotation.is_empty() {
                let a_expr = kf_expr(&keyframes.rotation, &chain_t, |deg| deg.to_radians());
                chain.push(format!("rotate=a='{a_expr}':c=black@0:ow={ow}:oh={oh}"));
            } else {
                let rad = transform.rotation.to_radians();
                chain.push(format!("rotate={}:c=black@0:ow={ow}:oh={oh}", f(rad)));
            }
        }
        if !keyframes.opacity.is_empty() {
            let o_expr = kf_expr(&keyframes.opacity, &geq_t, |v| v.clamp(0.0, 1.0));
            chain.push(format!(
                "geq=a='alpha(X\\,Y)*({o_expr})':r='r(X\\,Y)':g='g(X\\,Y)':b='b(X\\,Y)'"
            ));
        } else if transform.opacity < 1.0 {
            chain.push(format!("colorchannelmixer=aa={}", f(transform.opacity)));
        }

        // fades are alpha fades in clip-local time (offset by lead-in)
        if fade_in > 0.0 && v.transition_in.is_none() {
            chain.push(format!(
                "fade=t=in:st={}:d={}:alpha=1",
                f(ext_in),
                f(fade_in)
            ));
        }
        if fade_out > 0.0 && v.transition_out_adj.is_none() {
            chain.push(format!(
                "fade=t=out:st={}:d={}:alpha=1",
                f(ext_in + dur - fade_out),
                f(fade_out)
            ));
        }

        // transition blending on the INCOMING side (B rides on top of A)
        if let Some(tr) = v.transition_in {
            match tr.kind {
                TransitionType::Crossfade
                | TransitionType::WipeLeft
                | TransitionType::WipeRight => {
                    // wipes: alpha mask sweeping across; crossfade: plain alpha ramp
                    match tr.kind {
                        TransitionType::Crossfade => chain.push(format!(
                            "fade=t=in:st=0:d={}:alpha=1",
                            f(tr.duration)
                        )),
                        TransitionType::WipeLeft => chain.push(format!(
                            "geq=a='255*gte(X\\,W*(1-clip(T/{d}\\,0\\,1)))':r='r(X\\,Y)':g='g(X\\,Y)':b='b(X\\,Y)'",
                            d = f(tr.duration)
                        )),
                        TransitionType::WipeRight => chain.push(format!(
                            "geq=a='255*lte(X\\,W*clip(T/{d}\\,0\\,1))':r='r(X\\,Y)':g='g(X\\,Y)':b='b(X\\,Y)'",
                            d = f(tr.duration)
                        )),
                        _ => unreachable!(),
                    }
                }
                TransitionType::FadeBlack => {
                    // B appears in the second half of the window
                    chain.push(format!(
                        "fade=t=in:st={}:d={}:alpha=1",
                        f(tr.duration / 2.0),
                        f(tr.duration / 2.0)
                    ));
                }
                TransitionType::SlideLeft | TransitionType::SlideRight => {
                    // position animation handled at the overlay stage
                }
            }
        }
        if let Some(tr) = v.transition_out_adj {
            if tr.kind == TransitionType::FadeBlack {
                // A disappears in the first half of the window
                chain.push(format!(
                    "fade=t=out:st={}:d={}:alpha=1",
                    f(ext_in + dur),
                    f(tr.duration / 2.0)
                ));
            }
        }

        // shift into timeline time
        chain.push(format!("setpts=PTS+{}/TB", f(eff_start.max(0.0))));

        if background_blur {
            // shared prefix → split → main chain + blurred cover backdrop
            let prefix = chain[..prefix_len].join(",");
            let rest = chain[prefix_len..].join(",");
            let _ = writeln!(g, "[{}:v]{}[p{vi}];", v.input_index, prefix);
            let _ = writeln!(g, "[p{vi}]split[p{vi}a][p{vi}b];");
            let _ = writeln!(g, "[p{vi}a]{rest}[c{vi}];");

            let mut bg: Vec<String> = vec![
                format!(
                    "scale=w='ceil(max({w}/iw\\,{h}/ih)*iw)':h='ceil(max({w}/iw\\,{h}/ih)*ih)':eval=init",
                    w = width,
                    h = height
                ),
                format!("crop={width}:{height}"),
                "gblur=sigma=30".into(),
            ];
            if fade_in > 0.0 && v.transition_in.is_none() {
                bg.push(format!(
                    "fade=t=in:st={}:d={}:alpha=1",
                    f(ext_in),
                    f(fade_in)
                ));
            }
            if fade_out > 0.0 && v.transition_out_adj.is_none() {
                bg.push(format!(
                    "fade=t=out:st={}:d={}:alpha=1",
                    f(ext_in + dur - fade_out),
                    f(fade_out)
                ));
            }
            bg.push(format!("setpts=PTS+{}/TB", f(eff_start.max(0.0))));
            let _ = writeln!(g, "[p{vi}b]{}[bg{vi}];", bg.join(","));
            bg_labels[vi] = Some(format!("bg{vi}"));
        } else {
            let _ = writeln!(g, "[{}:v]{}[c{}];", v.input_index, chain.join(","), vi);
        }
    }

    // ---- base canvas + overlay stack
    let bg = project
        .canvas_background
        .strip_prefix('#')
        .map(|hex| format!("0x{hex}"))
        .unwrap_or_else(|| "black".to_string());
    let _ = writeln!(
        g,
        "color=c={}:s={}x{}:r={}:d={}[base0];",
        bg,
        width,
        height,
        f(fps),
        f(duration)
    );
    let mut base = "base0".to_string();
    for (vi, v) in visuals.iter().enumerate() {
        let clip = v.clip;
        let ext_out = v.transition_out_adj.map_or(0.0, |t| t.duration / 2.0);
        let ext_in = v.transition_in.map_or(0.0, |t| t.duration / 2.0);
        let win_start = clip.start() - ext_in;
        let win_end = clip.end() + ext_out;

        let (transform, keyframes) = match clip {
            Clip::Video {
                transform,
                keyframes,
                ..
            }
            | Clip::Image {
                transform,
                keyframes,
                ..
            } => (transform, keyframes),
            _ => unreachable!(),
        };
        // overlay expressions run in TIMELINE time; keyframe t is clip-local
        let overlay_t = format!("(t-{})", f(clip.start()));
        let x_off = if keyframes.x.is_empty() {
            f(transform.x)
        } else {
            format!("({})", kf_expr(&keyframes.x, &overlay_t, |v| v))
        };
        let y_off = if keyframes.y.is_empty() {
            f(transform.y)
        } else {
            format!("({})", kf_expr(&keyframes.y, &overlay_t, |v| v))
        };
        let mut x = format!("(main_w-overlay_w)/2+{x_off}");
        let y = format!("(main_h-overlay_h)/2+{y_off}");

        // slide transitions animate the incoming clip's x across the window
        if let Some(tr) = v.transition_in {
            let d = f(tr.duration);
            let t0 = f(win_start);
            match tr.kind {
                TransitionType::SlideLeft => {
                    x = format!(
                        "(main_w-overlay_w)/2+{x_off}+main_w*(1-clip((t-{t0})/{d}\\,0\\,1))"
                    );
                }
                TransitionType::SlideRight => {
                    x = format!(
                        "(main_w-overlay_w)/2+{x_off}-main_w*(1-clip((t-{t0})/{d}\\,0\\,1))"
                    );
                }
                _ => {}
            }
        }

        if let Some(bg) = &bg_labels[vi] {
            // blurred fill sits directly under its clip, full-stage. Inside a
            // transition window the backdrop is suppressed on BOTH sides (the
            // preview does the same) — an opaque full-stage layer switching
            // on mid-crossfade would hard-cut the blend.
            let bg_start = clip.start() + ext_in;
            let bg_end = (clip.end() - ext_out).max(bg_start);
            let bnext = format!("base{}b", vi + 1);
            let _ = writeln!(
                g,
                "[{base}][{bg}]overlay=x=0:y=0:eof_action=pass:enable='between(t,{s},{e})'[{bnext}];",
                s = f(bg_start),
                e = f(bg_end),
            );
            base = bnext;
        }
        let next = format!("base{}", vi + 1);
        let _ = writeln!(
            g,
            "[{base}][c{vi}]overlay=x='{x}':y='{y}':eof_action=pass:enable='between(t,{s},{e})'[{next}];",
            s = f(win_start),
            e = f(win_end),
        );
        base = next;
    }

    // ---- subtitles / text via libass, applied over the final stack
    let mut video_out = if let Some(path) = ass_path {
        let fonts = fonts_dir
            .map(|d| format!(":fontsdir='{d}'"))
            .unwrap_or_default();
        let _ = writeln!(g, "[{base}]subtitles=f='{path}'{fonts}[vout];");
        "vout".to_string()
    } else {
        let _ = writeln!(g, "[{base}]null[vout];");
        "vout".to_string()
    };

    // ---- optional export downscale (everything above stays in canvas px)
    let (out_w, out_h) = options.output_size(project);
    if (out_w, out_h) != (width, height) {
        let _ = writeln!(
            g,
            "[{video_out}]scale={out_w}:{out_h}:flags=lanczos[vscaled];"
        );
        video_out = "vscaled".to_string();
    }

    // ---- audio: silence base + per-clip chains into amix
    let mut audio_labels: Vec<String> = Vec::new();
    let mut an = 0usize;
    for track in &project.tracks {
        if track.kind == TrackKind::Text {
            continue;
        }
        for clip in &track.clips {
            let (source_in, volume, fade_in, fade_out) = match clip {
                Clip::Video {
                    source_in,
                    volume,
                    muted,
                    fade_in,
                    fade_out,
                    asset_id,
                    ..
                } => {
                    let has_audio = project
                        .asset(asset_id)
                        .map(|a| a.has_audio)
                        .unwrap_or(false);
                    if *muted || track.muted || !has_audio || *volume <= 0.0 {
                        continue;
                    }
                    (*source_in, *volume, *fade_in, *fade_out)
                }
                Clip::Audio {
                    source_in,
                    volume,
                    fade_in,
                    fade_out,
                    ..
                } => {
                    if track.muted || *volume <= 0.0 {
                        continue;
                    }
                    (*source_in, *volume, *fade_in, *fade_out)
                }
                _ => continue,
            };
            let Some(input) = input_for(inputs, clip.id()) else {
                continue;
            };
            let dur = clip.duration();
            let speed = clip.speed();
            let delay_ms = (clip.start() * 1000.0).round() as i64;

            let mut chain: Vec<String> = vec![
                // source consumption scales with the playback rate
                format!(
                    "atrim=start={}:end={}",
                    f(source_in),
                    f(source_in + dur * speed)
                ),
                "asetpts=PTS-STARTPTS".into(),
            ];
            chain.extend(atempo_chain(speed));
            chain.push("aresample=48000".into());
            chain.push("aformat=channel_layouts=stereo".into());
            if volume != 1.0 {
                chain.push(format!("volume={}", f(volume)));
            }
            if fade_in > 0.0 {
                chain.push(format!("afade=t=in:st=0:d={}", f(fade_in)));
            }
            if fade_out > 0.0 {
                chain.push(format!(
                    "afade=t=out:st={}:d={}",
                    f(dur - fade_out),
                    f(fade_out)
                ));
            }
            chain.push(format!("adelay={delay_ms}|{delay_ms}"));

            let label = format!("a{an}");
            let _ = writeln!(g, "[{}:a]{}[{}];", input.index, chain.join(","), label);
            audio_labels.push(label);
            an += 1;
        }
    }

    let has_audio = !audio_labels.is_empty();
    let audio_out = if has_audio {
        let _ = writeln!(g, "anullsrc=r=48000:cl=stereo:d={}[asilence];", f(duration));
        let list = std::iter::once("[asilence]".to_string())
            .chain(audio_labels.iter().map(|l| format!("[{l}]")))
            .collect::<String>();
        let _ = writeln!(
            g,
            "{list}amix=inputs={}:duration=first:normalize=0[aout];",
            audio_labels.len() + 1
        );
        "aout".to_string()
    } else {
        let _ = writeln!(g, "anullsrc=r=48000:cl=stereo:d={}[aout];", f(duration));
        "aout".to_string()
    };

    // strip the trailing ';' — older ffmpeg (≤5.x) parses it as an empty
    // filter chain and fails with "No such filter: ''"
    let script = g.trim_end().trim_end_matches(';').to_string() + "\n";

    Graph {
        script,
        video_out,
        audio_out,
        has_audio: true, // aout always exists (silence when no clips)
    }
}

/// Pitch-corrected tempo change. `atempo` accepts 0.5..=2.0 per instance
/// (portable across ffmpeg versions), so out-of-range speeds chain factors:
/// 0.25 → 0.5,0.5 ; 4 → 2,2 ; 3 → 2,1.5.
fn atempo_chain(speed: f64) -> Vec<String> {
    if (speed - 1.0).abs() < 1e-9 {
        return vec![];
    }
    let mut factors = Vec::new();
    let mut rest = speed;
    while rest > 2.0 {
        factors.push(2.0);
        rest /= 2.0;
    }
    while rest < 0.5 {
        factors.push(0.5);
        rest /= 0.5;
    }
    factors.push(rest);
    factors
        .into_iter()
        .filter(|s| (*s - 1.0).abs() > 1e-9)
        .map(|s| format!("atempo={}", f(s)))
        .collect()
}

/// ffmpeg equivalents of the preview's filter-preset color matrices
/// (see web/src/schema/filters.ts — keep in sync).
fn preset_chain(preset: FilterPreset) -> Vec<String> {
    match preset {
        FilterPreset::Grayscale => vec!["hue=s=0".into()],
        FilterPreset::Sepia => vec![
            "colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131:0".into(),
        ],
        FilterPreset::Invert => vec!["negate".into()],
        FilterPreset::Vintage => vec![
            "colorchannelmixer=.5:.35:.1:0:.3:.55:.1:0:.2:.25:.4:0".into(),
            "lutrgb=r='clip(val+15\\,0\\,255)':g='clip(val+13\\,0\\,255)':b='clip(val+20\\,0\\,255)'".into(),
        ],
        FilterPreset::Cool => vec![
            "colorchannelmixer=.92:0:0:0:0:1:0:0:0:0:1.08:0".into(),
            "lutrgb=g='clip(val+5\\,0\\,255)':b='clip(val+8\\,0\\,255)'".into(),
        ],
        FilterPreset::Warm => vec![
            "colorchannelmixer=1.08:0:0:0:0:1:0:0:0:0:.92:0".into(),
            "lutrgb=r='clip(val+8\\,0\\,255)':g='clip(val+5\\,0\\,255)'".into(),
        ],
    }
}
