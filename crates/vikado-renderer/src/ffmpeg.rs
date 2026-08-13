//! ffmpeg process supervision: argument assembly, `-progress` parsing,
//! stderr capture, cancellation.

use std::path::{Path, PathBuf};
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use vikado_types::{Project, RenderOptions};

use crate::inputs::ClipInput;

#[derive(Debug, thiserror::Error)]
pub enum FfmpegError {
    #[error("could not start ffmpeg: {0}")]
    Spawn(std::io::Error),
    #[error("ffmpeg failed (exit {code:?}):\n{stderr_tail}")]
    Failed {
        code: Option<i32>,
        stderr_tail: String,
    },
    #[error("render canceled")]
    Canceled,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Progress {
    /// 0.0..=1.0
    pub ratio: f64,
    pub out_time_s: f64,
}

pub struct RenderJob {
    pub args: Vec<String>,
    pub duration: f64,
}

/// Build the full ffmpeg invocation. `graph_path` is the filter script on disk
/// (argv length limits), outputs map the graph's terminal pads.
pub fn build_args(
    project: &Project,
    inputs: &[ClipInput],
    graph_path: &Path,
    video_out: &str,
    audio_out: &str,
    out_path: &Path,
    options: &RenderOptions,
) -> RenderJob {
    let duration = project.duration().max(0.1);
    let mut args: Vec<String> = vec!["-y".into(), "-hide_banner".into(), "-nostats".into()];

    for input in inputs {
        if input.is_image {
            args.push("-loop".into());
            args.push("1".into());
            args.push("-t".into());
            args.push(format!("{}", input.image_duration));
        }
        args.push("-i".into());
        args.push(input.path.to_string_lossy().into_owned());
    }

    args.extend([
        "-filter_complex_script".into(),
        graph_path.to_string_lossy().into_owned(),
        "-map".into(),
        format!("[{video_out}]"),
        "-map".into(),
        format!("[{audio_out}]"),
        "-c:v".into(),
        "libx264".into(),
        "-preset".into(),
        options.quality.preset().into(),
        "-crf".into(),
        options.quality.crf().to_string(),
        "-pix_fmt".into(),
        "yuv420p".into(),
        "-c:a".into(),
        "aac".into(),
        "-b:a".into(),
        format!("{}k", options.quality.audio_bitrate_kbps()),
        "-movflags".into(),
        "+faststart".into(),
        "-t".into(),
        format!("{duration}"),
        "-progress".into(),
        "pipe:1".into(),
        out_path.to_string_lossy().into_owned(),
    ]);

    RenderJob { args, duration }
}

/// Run ffmpeg, streaming progress via `on_progress`. `cancel` aborts the child.
pub async fn run(
    job: &RenderJob,
    mut on_progress: impl FnMut(Progress),
    cancel: &tokio_util_lite::CancellationToken,
) -> Result<(), FfmpegError> {
    let mut child = Command::new("ffmpeg")
        .args(&job.args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(FfmpegError::Spawn)?;

    let stdout = child.stdout.take().expect("stdout piped");
    let stderr = child.stderr.take().expect("stderr piped");

    let stderr_task = tokio::spawn(async move {
        let mut lines = BufReader::new(stderr).lines();
        let mut tail: Vec<String> = Vec::new();
        while let Ok(Some(line)) = lines.next_line().await {
            tail.push(line);
            if tail.len() > 60 {
                tail.remove(0);
            }
        }
        tail.join("\n")
    });

    let mut lines = BufReader::new(stdout).lines();
    let duration = job.duration;
    loop {
        tokio::select! {
            _ = cancel.cancelled() => {
                let _ = child.kill().await;
                return Err(FfmpegError::Canceled);
            }
            line = lines.next_line() => {
                match line {
                    Ok(Some(line)) => {
                        if let Some(v) = line.strip_prefix("out_time_us=") {
                            if let Ok(us) = v.trim().parse::<i64>() {
                                let t = us as f64 / 1_000_000.0;
                                on_progress(Progress { ratio: (t / duration).clamp(0.0, 1.0), out_time_s: t });
                            }
                        }
                    }
                    _ => break,
                }
            }
        }
    }

    let status = child.wait().await.map_err(FfmpegError::Spawn)?;
    let stderr_tail = stderr_task.await.unwrap_or_default();
    if !status.success() {
        return Err(FfmpegError::Failed {
            code: status.code(),
            stderr_tail,
        });
    }
    on_progress(Progress {
        ratio: 1.0,
        out_time_s: duration,
    });
    Ok(())
}

/// Minimal cancellation token (avoids the tokio-util dependency).
pub mod tokio_util_lite {
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;
    use tokio::sync::Notify;

    #[derive(Clone, Default)]
    pub struct CancellationToken {
        inner: Arc<Inner>,
    }

    #[derive(Default)]
    struct Inner {
        canceled: AtomicBool,
        notify: Notify,
    }

    impl CancellationToken {
        pub fn new() -> Self {
            Self::default()
        }

        pub fn cancel(&self) {
            self.inner.canceled.store(true, Ordering::SeqCst);
            self.inner.notify.notify_waiters();
        }

        pub fn is_cancelled(&self) -> bool {
            self.inner.canceled.load(Ordering::SeqCst)
        }

        pub async fn cancelled(&self) {
            if self.is_cancelled() {
                return;
            }
            let notified = self.inner.notify.notified();
            if self.is_cancelled() {
                return;
            }
            notified.await;
        }
    }
}

pub use tokio_util_lite::CancellationToken;

/// Probe a media file with ffprobe; returns the parsed JSON.
pub async fn ffprobe(path: &Path) -> anyhow::Result<serde_json::Value> {
    let output = Command::new("ffprobe")
        .args([
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
        ])
        .arg(path)
        .output()
        .await?;
    if !output.status.success() {
        anyhow::bail!(
            "ffprobe failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    }
    Ok(serde_json::from_slice(&output.stdout)?)
}

pub fn workspace_paths(work_dir: &Path) -> (PathBuf, PathBuf, PathBuf) {
    (
        work_dir.join("graph.txt"),
        work_dir.join("overlays.ass"),
        work_dir.join("out.mp4"),
    )
}
