//! Maps clips to ffmpeg `-i` inputs. One input per media-backed clip keeps
//! the filtergraph free of `split` bookkeeping (a clip and its split twin can
//! reference the same file twice; ffmpeg reads it independently).

use std::path::{Path, PathBuf};
use vikado_types::{Clip, Project};

#[derive(Debug, Clone)]
pub struct ClipInput {
    /// ffmpeg input index
    pub index: usize,
    pub clip_id: String,
    pub path: PathBuf,
    /// image inputs are looped stills
    pub is_image: bool,
    /// seconds the demuxer should loop the still for (image clips)
    pub image_duration: f64,
}

#[derive(Debug, thiserror::Error)]
pub enum InputError {
    #[error("clip {clip_id} references unknown asset {asset_id}")]
    UnknownAsset { clip_id: String, asset_id: String },
    #[error("asset file missing: {0}")]
    MissingFile(PathBuf),
}

/// Resolve every media-backed clip to an input file under `assets_dir`
/// (files are stored by content hash — client filenames are never used).
pub fn collect_inputs(project: &Project, assets_dir: &Path) -> Result<Vec<ClipInput>, InputError> {
    let mut inputs = Vec::new();
    for track in &project.tracks {
        if track.hidden && track.kind != vikado_types::TrackKind::Audio {
            continue;
        }
        for (i, clip) in track.clips.iter().enumerate() {
            let (asset_id, is_image) = match clip {
                Clip::Video { asset_id, .. } => (asset_id, false),
                Clip::Image { asset_id, .. } => (asset_id, true),
                Clip::Audio { asset_id, .. } => (asset_id, false),
                Clip::Text { .. } => continue,
            };
            let asset = project
                .asset(asset_id)
                .ok_or_else(|| InputError::UnknownAsset {
                    clip_id: clip.id().to_string(),
                    asset_id: asset_id.clone(),
                })?;
            let path = assets_dir.join(&asset.hash);
            if !path.exists() {
                return Err(InputError::MissingFile(path));
            }
            // the looped still must cover the clip PLUS its transition
            // extensions (window is centered on each cut) — the filtergraph
            // trims nothing off image inputs
            let ext_out = clip
                .transition_out()
                .filter(|_| {
                    track
                        .clips
                        .get(i + 1)
                        .map(|next| (next.start() - clip.end()).abs() < 1e-6)
                        .unwrap_or(false)
                })
                .map_or(0.0, |t| t.duration / 2.0);
            let ext_in = i
                .checked_sub(1)
                .and_then(|pi| track.clips.get(pi))
                .filter(|prev| (clip.start() - prev.end()).abs() < 1e-6)
                .and_then(|prev| prev.transition_out())
                .map_or(0.0, |t| t.duration / 2.0);
            inputs.push(ClipInput {
                index: inputs.len(),
                clip_id: clip.id().to_string(),
                path,
                is_image,
                image_duration: clip.duration() + ext_in + ext_out,
            });
        }
    }
    Ok(inputs)
}

pub fn input_for<'a>(inputs: &'a [ClipInput], clip_id: &str) -> Option<&'a ClipInput> {
    inputs.iter().find(|i| i.clip_id == clip_id)
}
