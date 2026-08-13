//! Binary entry point: env config, TTL sweeper, serve. The router itself
//! lives in the library (`vikado_server::build_app`) so tests can drive it.

use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use vikado_server::jobs::JobStore;
use vikado_server::{build_app, AppState};

fn env_var(name: &str) -> Option<String> {
    std::env::var(name).ok().filter(|v| !v.is_empty())
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "vikado_server=info,tower_http=info".into()),
        )
        .init();

    let port: u16 = env_var("VIKADO_PORT")
        .and_then(|v| v.parse().ok())
        .unwrap_or(3000);
    let data_dir = PathBuf::from(env_var("VIKADO_DATA_DIR").unwrap_or_else(|| "./data".into()));
    let static_dir = env_var("VIKADO_STATIC_DIR").map(PathBuf::from);
    let fonts_dir = env_var("VIKADO_FONTS_DIR")
        .map(PathBuf::from)
        .filter(|p| p.exists());
    let max_upload: usize = env_var("VIKADO_MAX_UPLOAD_BYTES")
        .and_then(|v| v.parse().ok())
        .unwrap_or(2 * 1024 * 1024 * 1024);
    let max_renders: usize = env_var("VIKADO_MAX_CONCURRENT_RENDERS")
        .and_then(|v| v.parse().ok())
        .unwrap_or(1);
    let ttl_hours: u64 = env_var("VIKADO_JOB_TTL_HOURS")
        .and_then(|v| v.parse().ok())
        .unwrap_or(24);

    tokio::fs::create_dir_all(&data_dir).await?;
    let store = Arc::new(JobStore::new(
        data_dir,
        max_renders,
        Duration::from_secs(ttl_hours * 3600),
    ));
    store.remove_orphan_dirs().await;

    {
        let store = store.clone();
        tokio::spawn(async move {
            let mut tick = tokio::time::interval(Duration::from_secs(600));
            loop {
                tick.tick().await;
                store.sweep().await;
            }
        });
    }

    let app = build_app(AppState { store, fonts_dir }, max_upload, static_dir);

    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("vikado-server listening on http://{addr}");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
