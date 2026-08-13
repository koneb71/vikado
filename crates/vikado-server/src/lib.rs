//! Vikado render service library: the job API router, extracted from the
//! binary so integration tests can drive it in-process.
//! See README for the security note (no auth — reverse-proxy it).

pub mod jobs;

use std::path::PathBuf;
use std::sync::Arc;

use axum::{
    extract::{DefaultBodyLimit, Multipart, Path, State},
    http::{header, StatusCode},
    response::sse::{Event, KeepAlive, Sse},
    response::{IntoResponse, Response},
    routing::{delete, get, post},
    Json, Router,
};
use futures::stream::Stream;
use serde_json::json;
use tokio_stream::wrappers::WatchStream;
use tokio_stream::StreamExt;
use tower_http::cors::CorsLayer;
use tower_http::services::{ServeDir, ServeFile};
use uuid::Uuid;
use vikado_renderer::{render, RenderRequest};

use jobs::{update_status, JobError, JobPhase, JobStore};

#[derive(Clone)]
pub struct AppState {
    pub store: Arc<JobStore>,
    pub fonts_dir: Option<PathBuf>,
}

/// The `/api/v1` application. `static_dir` additionally serves the built
/// frontend with an SPA fallback when set.
pub fn build_app(state: AppState, max_upload: usize, static_dir: Option<PathBuf>) -> Router {
    let api = Router::new()
        .route("/jobs", post(create_job))
        .route("/jobs/{id}/assets", post(upload_asset))
        .route("/jobs/{id}/render", post(start_render))
        .route("/jobs/{id}", get(job_status))
        .route("/jobs/{id}", delete(cancel_job))
        .route("/jobs/{id}/events", get(job_events))
        .route("/jobs/{id}/download", get(download))
        .route("/healthz", get(|| async { "ok" }))
        .route("/version", get(|| async { env!("CARGO_PKG_VERSION") }))
        .layer(DefaultBodyLimit::max(max_upload))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let mut app = Router::new().nest("/api/v1", api);
    if let Some(dir) = static_dir {
        let index = dir.join("index.html");
        app = app.fallback_service(ServeDir::new(&dir).fallback(ServeFile::new(index)));
    }
    app
}

// ---------------------------------------------------------------------------

struct ApiError {
    status: StatusCode,
    code: &'static str,
    message: String,
}

impl ApiError {
    fn new(status: StatusCode, code: &'static str, message: impl Into<String>) -> Self {
        Self {
            status,
            code,
            message: message.into(),
        }
    }

    fn not_found() -> Self {
        Self::new(StatusCode::NOT_FOUND, "JOB_NOT_FOUND", "job not found")
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (
            self.status,
            Json(json!({ "code": self.code, "message": self.message })),
        )
            .into_response()
    }
}

fn parse_id(id: &str) -> Result<Uuid, ApiError> {
    Uuid::parse_str(id).map_err(|_| ApiError::not_found())
}

async fn create_job(State(state): State<AppState>) -> Result<impl IntoResponse, ApiError> {
    let id = state.store.create().await.map_err(|e| {
        ApiError::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            "JOB_CREATE_FAILED",
            e.to_string(),
        )
    })?;
    Ok((
        StatusCode::CREATED,
        Json(json!({ "job_id": id.to_string() })),
    ))
}

/// Multipart upload; field name = content hash (the client knows it), file
/// streamed to `<job>/assets/<hash>`. Hashes are hex — safe path components.
async fn upload_asset(
    State(state): State<AppState>,
    Path(id): Path<String>,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, ApiError> {
    let id = parse_id(&id)?;
    let entry = state.store.get(id).await.ok_or_else(ApiError::not_found)?;

    let mut stored: Vec<String> = Vec::new();
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| ApiError::new(StatusCode::BAD_REQUEST, "UPLOAD_MALFORMED", e.to_string()))?
    {
        let hash = field.name().unwrap_or_default().to_string();
        if hash.len() != 64 || !hash.chars().all(|c| c.is_ascii_hexdigit()) {
            return Err(ApiError::new(
                StatusCode::BAD_REQUEST,
                "BAD_ASSET_KEY",
                "field name must be the sha-256 hex of the file",
            ));
        }
        let path = entry.dir.join("assets").join(&hash);
        let bytes = field
            .bytes()
            .await
            .map_err(|e| ApiError::new(StatusCode::BAD_REQUEST, "UPLOAD_FAILED", e.to_string()))?;
        tokio::fs::write(&path, &bytes).await.map_err(|e| {
            ApiError::new(
                StatusCode::INTERNAL_SERVER_ERROR,
                "UPLOAD_WRITE_FAILED",
                e.to_string(),
            )
        })?;
        stored.push(hash);
    }
    Ok(Json(json!({ "stored": stored })))
}

#[derive(serde::Deserialize)]
struct RenderPayload {
    project: vikado_types::Project,
    #[serde(default)]
    options: vikado_types::RenderOptions,
}

async fn start_render(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<RenderPayload>,
) -> Result<impl IntoResponse, ApiError> {
    let RenderPayload { project, options } = payload;
    let id = parse_id(&id)?;
    let entry = state.store.get(id).await.ok_or_else(ApiError::not_found)?;

    if project.schema_version != vikado_types::SCHEMA_VERSION {
        return Err(ApiError::new(
            StatusCode::UNPROCESSABLE_ENTITY,
            "UNSUPPORTED_SCHEMA",
            format!("expected schemaVersion {}", vikado_types::SCHEMA_VERSION),
        ));
    }

    update_status(&entry, |s| {
        s.status = JobPhase::Queued;
        s.progress = 0.0;
        s.error = None;
    });

    let store = state.store.clone();
    let fonts_dir = state.fonts_dir.clone();
    tokio::spawn(async move {
        let _permit = store.render_slots.acquire().await;
        if entry.cancel.is_cancelled() {
            return;
        }
        update_status(&entry, |s| s.status = JobPhase::Rendering);

        let assets_dir = entry.dir.join("assets");
        let work_dir = entry.dir.join("work");
        let out_path = entry.dir.join("out.mp4");
        let progress_entry = entry.clone();
        let result = render(
            RenderRequest {
                project: &project,
                assets_dir: &assets_dir,
                work_dir: &work_dir,
                fonts_dir: fonts_dir.as_deref(),
                out_path: &out_path,
                options,
            },
            move |p| {
                update_status(&progress_entry, |s| s.progress = p.ratio);
            },
            &entry.cancel,
        )
        .await;

        match result {
            Ok(_) => update_status(&entry, |s| {
                s.status = JobPhase::Done;
                s.progress = 1.0;
            }),
            Err(vikado_renderer::RenderError::Ffmpeg(
                vikado_renderer::ffmpeg::FfmpegError::Canceled,
            )) => update_status(&entry, |s| s.status = JobPhase::Canceled),
            Err(e) => update_status(&entry, |s| {
                s.status = JobPhase::Failed;
                s.error = Some(JobError {
                    code: error_code(&e).into(),
                    message: e.to_string(),
                });
            }),
        }
    });

    Ok((
        StatusCode::ACCEPTED,
        Json(json!({ "job_id": id.to_string() })),
    ))
}

fn error_code(e: &vikado_renderer::RenderError) -> &'static str {
    match e {
        vikado_renderer::RenderError::Input(_) => "ASSET_MISSING",
        vikado_renderer::RenderError::Ffmpeg(_) => "FFMPEG_FAILED",
        vikado_renderer::RenderError::Io(_) => "IO_ERROR",
    }
}

async fn job_status(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    let id = parse_id(&id)?;
    let entry = state.store.get(id).await.ok_or_else(ApiError::not_found)?;
    let status = entry.status_tx.borrow().clone();
    Ok(Json(status))
}

async fn job_events(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Sse<impl Stream<Item = Result<Event, std::convert::Infallible>>>, ApiError> {
    let id = parse_id(&id)?;
    let entry = state.store.get(id).await.ok_or_else(ApiError::not_found)?;
    let stream = WatchStream::new(entry.status_tx.subscribe())
        .map(|status| Ok(Event::default().json_data(&status).unwrap_or_default()));
    Ok(Sse::new(stream).keep_alive(KeepAlive::default()))
}

async fn cancel_job(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    let id = parse_id(&id)?;
    state
        .store
        .remove(id)
        .await
        .ok_or_else(ApiError::not_found)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn download(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Response, ApiError> {
    let id = parse_id(&id)?;
    let entry = state.store.get(id).await.ok_or_else(ApiError::not_found)?;
    if entry.status_tx.borrow().status != JobPhase::Done {
        return Err(ApiError::new(
            StatusCode::CONFLICT,
            "NOT_DONE",
            "render has not finished",
        ));
    }
    let path = entry.dir.join("out.mp4");
    let file = tokio::fs::File::open(&path).await.map_err(|_| {
        ApiError::new(
            StatusCode::NOT_FOUND,
            "OUTPUT_MISSING",
            "output file missing",
        )
    })?;
    let stream = tokio_util_io::ReaderStream::new(file);
    let body = axum::body::Body::from_stream(stream);
    Ok((
        [
            (header::CONTENT_TYPE, "video/mp4".to_string()),
            (
                header::CONTENT_DISPOSITION,
                "attachment; filename=\"vikado-export.mp4\"".to_string(),
            ),
        ],
        body,
    )
        .into_response())
}

/// Minimal ReaderStream (avoids the tokio-util dependency).
mod tokio_util_io {
    use futures::Stream;
    use std::pin::Pin;
    use std::task::{Context, Poll};
    use tokio::io::{AsyncRead, ReadBuf};

    pub struct ReaderStream<R> {
        reader: R,
        buf: Vec<u8>,
    }

    impl<R: AsyncRead + Unpin> ReaderStream<R> {
        pub fn new(reader: R) -> Self {
            Self {
                reader,
                buf: vec![0; 64 * 1024],
            }
        }
    }

    impl<R: AsyncRead + Unpin> Stream for ReaderStream<R> {
        type Item = std::io::Result<axum::body::Bytes>;

        fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
            let this = self.get_mut();
            let mut read_buf = ReadBuf::new(&mut this.buf);
            match Pin::new(&mut this.reader).poll_read(cx, &mut read_buf) {
                Poll::Pending => Poll::Pending,
                Poll::Ready(Err(e)) => Poll::Ready(Some(Err(e))),
                Poll::Ready(Ok(())) => {
                    let filled = read_buf.filled();
                    if filled.is_empty() {
                        Poll::Ready(None)
                    } else {
                        Poll::Ready(Some(Ok(axum::body::Bytes::copy_from_slice(filled))))
                    }
                }
            }
        }
    }
}
