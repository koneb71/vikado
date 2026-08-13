//! The Vikado render engine: compiles a `Project` into an ffmpeg invocation
//! and supervises the render. No HTTP here — `vikado-server` wraps this.

pub mod ass;
pub mod ffmpeg;
pub mod filtergraph;
pub mod inputs;

use std::path::{Path, PathBuf};

pub use ffmpeg::{CancellationToken, Progress};

#[derive(Debug, thiserror::Error)]
pub enum RenderError {
    #[error(transparent)]
    Input(#[from] inputs::InputError),
    #[error(transparent)]
    Ffmpeg(#[from] ffmpeg::FfmpegError),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

pub struct RenderRequest<'a> {
    pub project: &'a vikado_types::Project,
    /// directory holding source files named by content hash
    pub assets_dir: &'a Path,
    /// scratch dir for graph.txt / overlays.ass (created if missing)
    pub work_dir: &'a Path,
    /// bundled fonts dir for libass (must match the frontend webfonts)
    pub fonts_dir: Option<&'a Path>,
    pub out_path: &'a Path,
    pub options: vikado_types::RenderOptions,
}

/// Render to MP4. Progress callbacks arrive on the tokio runtime.
pub async fn render(
    req: RenderRequest<'_>,
    on_progress: impl FnMut(Progress),
    cancel: &CancellationToken,
) -> Result<PathBuf, RenderError> {
    std::fs::create_dir_all(req.work_dir)?;
    let inputs = inputs::collect_inputs(req.project, req.assets_dir)?;

    let ass = ass::emit_ass(req.project);
    let (graph_path, ass_path, _) = ffmpeg::workspace_paths(req.work_dir);
    let ass_arg = if ass.is_empty {
        None
    } else {
        std::fs::write(&ass_path, &ass.content)?;
        Some(ass_path.to_string_lossy().into_owned())
    };

    let graph = filtergraph::emit_graph(
        req.project,
        &inputs,
        ass_arg.as_deref(),
        req.fonts_dir
            .map(|p| p.to_string_lossy().into_owned())
            .as_deref(),
        &req.options,
    );
    std::fs::write(&graph_path, &graph.script)?;

    let job = ffmpeg::build_args(
        req.project,
        &inputs,
        &graph_path,
        &graph.video_out,
        &graph.audio_out,
        req.out_path,
        &req.options,
    );
    ffmpeg::run(&job, on_progress, cancel).await?;
    Ok(req.out_path.to_path_buf())
}
