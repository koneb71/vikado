//! Dev CLI: render a project without the HTTP server.
//!
//!   vikado-render <project.json> <assets-dir> <out.mp4> [--fonts <dir>]
//!
//! Assets in <assets-dir> must be named by their content hash (as uploaded).

use std::path::PathBuf;
use std::process::ExitCode;
use vikado_renderer::{render, CancellationToken, RenderRequest};

#[tokio::main]
async fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.len() < 3 {
        eprintln!("usage: vikado-render <project.json> <assets-dir> <out.mp4> [--fonts <dir>]");
        return ExitCode::FAILURE;
    }
    let project_path = PathBuf::from(&args[0]);
    let assets_dir = PathBuf::from(&args[1]);
    let out_path = PathBuf::from(&args[2]);
    let fonts_dir = args
        .iter()
        .position(|a| a == "--fonts")
        .and_then(|i| args.get(i + 1))
        .map(PathBuf::from);

    let raw = match std::fs::read_to_string(&project_path) {
        Ok(r) => r,
        Err(e) => {
            eprintln!("cannot read {}: {e}", project_path.display());
            return ExitCode::FAILURE;
        }
    };
    let project: vikado_types::Project = match serde_json::from_str(&raw) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("invalid project JSON: {e}");
            return ExitCode::FAILURE;
        }
    };

    let work_dir = std::env::temp_dir().join(format!("vikado-render-{}", std::process::id()));
    let cancel = CancellationToken::new();
    let result = render(
        RenderRequest {
            project: &project,
            assets_dir: &assets_dir,
            work_dir: &work_dir,
            fonts_dir: fonts_dir.as_deref(),
            out_path: &out_path,
            options: vikado_types::RenderOptions::default(),
        },
        |p| eprintln!("progress: {:.1}%", p.ratio * 100.0),
        &cancel,
    )
    .await;

    match result {
        Ok(path) => {
            println!("rendered {}", path.display());
            ExitCode::SUCCESS
        }
        Err(e) => {
            eprintln!("render failed: {e}");
            ExitCode::FAILURE
        }
    }
}
