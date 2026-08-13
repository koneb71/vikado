//! Integration tests for the job API, driven in-process via tower::oneshot.
//! The full render lifecycle (real ffmpeg) is #[ignore]d like the golden
//! render; everything else runs in plain `cargo test`.

use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use axum::body::Body;
use axum::http::{header, Request, StatusCode};
use axum::Router;
use http_body_util::BodyExt;
use serde_json::Value;
use tower::ServiceExt;
use vikado_server::jobs::JobStore;
use vikado_server::{build_app, AppState};

fn test_app(dir: &tempfile::TempDir) -> (Router, Arc<JobStore>) {
    let store = Arc::new(JobStore::new(
        dir.path().to_path_buf(),
        1,
        Duration::from_secs(3600),
    ));
    let app = build_app(
        AppState {
            store: store.clone(),
            fonts_dir: None,
        },
        64 * 1024 * 1024,
        None,
    );
    (app, store)
}

async fn body_json(response: axum::response::Response) -> Value {
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    serde_json::from_slice(&bytes).unwrap_or(Value::Null)
}

async fn create_job(app: &Router) -> String {
    let res = app
        .clone()
        .oneshot(Request::post("/api/v1/jobs").body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);
    body_json(res).await["job_id"].as_str().unwrap().to_string()
}

fn multipart_body(field_name: &str, content: &[u8]) -> (String, Vec<u8>) {
    let boundary = "vikado-test-boundary";
    let mut body = Vec::new();
    body.extend_from_slice(format!("--{boundary}\r\n").as_bytes());
    body.extend_from_slice(
        format!("Content-Disposition: form-data; name=\"{field_name}\"; filename=\"f\"\r\n\r\n")
            .as_bytes(),
    );
    body.extend_from_slice(content);
    body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());
    (format!("multipart/form-data; boundary={boundary}"), body)
}

const VALID_HASH: &str = "9481f3fd1efab428b122b3dd55dcf64f8b956d628ff8470b69a3c122c92a59ca";

#[tokio::test]
async fn job_lifecycle_create_status_delete() {
    let dir = tempfile::tempdir().unwrap();
    let (app, store) = test_app(&dir);

    let id = create_job(&app).await;
    let job_dir = dir.path().join("jobs").join(&id);
    assert!(job_dir.join("assets").is_dir(), "workspace created on disk");

    // status starts as created / progress 0
    let res = app
        .clone()
        .oneshot(
            Request::get(format!("/api/v1/jobs/{id}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let status = body_json(res).await;
    assert_eq!(status["status"], "created");
    assert_eq!(status["progress"], 0.0);

    // DELETE removes the job and its workspace
    let res = app
        .clone()
        .oneshot(
            Request::delete(format!("/api/v1/jobs/{id}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::NO_CONTENT);
    assert!(store.get(id.parse().unwrap()).await.is_none());
    // workspace cleanup is async-ish but same call path; give it a beat
    tokio::time::sleep(Duration::from_millis(50)).await;
    assert!(!job_dir.exists(), "workspace removed from disk");

    // further requests 404
    let res = app
        .oneshot(
            Request::get(format!("/api/v1/jobs/{id}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn unknown_and_malformed_ids_are_404() {
    let dir = tempfile::tempdir().unwrap();
    let (app, _) = test_app(&dir);
    for path in [
        "/api/v1/jobs/00000000-0000-0000-0000-000000000000",
        "/api/v1/jobs/not-a-uuid",
        "/api/v1/jobs/../../etc/passwd",
    ] {
        let res = app
            .clone()
            .oneshot(Request::get(path).body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::NOT_FOUND, "{path}");
    }
}

#[tokio::test]
async fn upload_validates_hash_field_names() {
    let dir = tempfile::tempdir().unwrap();
    let (app, _) = test_app(&dir);
    let id = create_job(&app).await;

    // hostile / malformed field names are rejected
    for bad in ["evil.mp4", "../../escape", "abc123", &"z".repeat(64)] {
        let (ct, body) = multipart_body(bad, b"data");
        let res = app
            .clone()
            .oneshot(
                Request::post(format!("/api/v1/jobs/{id}/assets"))
                    .header(header::CONTENT_TYPE, &ct)
                    .body(Body::from(body))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::BAD_REQUEST, "field {bad}");
        assert_eq!(body_json(res).await["code"], "BAD_ASSET_KEY");
    }

    // a valid 64-hex field name lands on disk under that name
    let (ct, body) = multipart_body(VALID_HASH, b"fake video bytes");
    let res = app
        .clone()
        .oneshot(
            Request::post(format!("/api/v1/jobs/{id}/assets"))
                .header(header::CONTENT_TYPE, &ct)
                .body(Body::from(body))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    assert_eq!(body_json(res).await["stored"][0], VALID_HASH);
    assert!(dir
        .path()
        .join("jobs")
        .join(&id)
        .join("assets")
        .join(VALID_HASH)
        .is_file());
}

fn minimal_project(schema_version: u32) -> Value {
    serde_json::json!({
        "schemaVersion": schema_version,
        "id": "p", "name": "Test", "fps": 30, "width": 320, "height": 180,
        "canvasBackground": "#000000",
        "tracks": [], "assets": [], "subtitles": null,
        "createdAt": "2026-01-01T00:00:00Z", "updatedAt": "2026-01-01T00:00:00Z"
    })
}

#[tokio::test]
async fn render_rejects_wrong_schema_version() {
    let dir = tempfile::tempdir().unwrap();
    let (app, _) = test_app(&dir);
    let id = create_job(&app).await;

    let res = app
        .oneshot(
            Request::post(format!("/api/v1/jobs/{id}/render"))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(
                    serde_json::json!({ "project": minimal_project(999) }).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(body_json(res).await["code"], "UNSUPPORTED_SCHEMA");
}

#[tokio::test]
async fn download_before_done_conflicts() {
    let dir = tempfile::tempdir().unwrap();
    let (app, _) = test_app(&dir);
    let id = create_job(&app).await;

    let res = app
        .oneshot(
            Request::get(format!("/api/v1/jobs/{id}/download"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::CONFLICT);
    assert_eq!(body_json(res).await["code"], "NOT_DONE");
}

#[tokio::test]
async fn ttl_sweep_removes_expired_jobs() {
    let dir = tempfile::tempdir().unwrap();
    let store = Arc::new(JobStore::new(
        dir.path().to_path_buf(),
        1,
        Duration::from_millis(10), // tiny TTL
    ));
    let id = store.create().await.unwrap();
    let job_dir = store.job_dir(id);
    assert!(job_dir.exists());
    tokio::time::sleep(Duration::from_millis(30)).await;
    store.sweep().await;
    assert!(store.get(id).await.is_none(), "expired job dropped");
    // dir removal happens in a spawned task
    tokio::time::sleep(Duration::from_millis(50)).await;
    assert!(!job_dir.exists(), "expired workspace removed");
}

/// Full lifecycle with a real ffmpeg render. Run with:
/// `cargo test -p vikado-server --test api -- --ignored`
#[tokio::test]
#[ignore]
async fn full_render_lifecycle_with_ffmpeg() {
    let dir = tempfile::tempdir().unwrap();
    let (app, _) = test_app(&dir);
    let id = create_job(&app).await;

    // stage the fixture video under its content hash
    let fixture =
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/media/countdown.mp4");
    let bytes = std::fs::read(&fixture).expect("fixture media present");
    let (ct, body) = multipart_body(VALID_HASH, &bytes);
    let res = app
        .clone()
        .oneshot(
            Request::post(format!("/api/v1/jobs/{id}/assets"))
                .header(header::CONTENT_TYPE, &ct)
                .body(Body::from(body))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let project = serde_json::json!({
        "schemaVersion": 1,
        "id": "p", "name": "E2E", "fps": 30, "width": 640, "height": 360,
        "canvasBackground": "#101020",
        "tracks": [{
            "id": "t1", "kind": "video", "name": "Track 1", "muted": false, "hidden": false,
            "clips": [{
                "type": "video", "id": "c1", "start": 0.0, "duration": 1.0,
                "assetId": "a1", "sourceIn": 0.0, "speed": 2.0, "volume": 1.0,
                "muted": false, "flipH": true, "flipV": false,
                "transform": {"x": 0.0, "y": 0.0, "scale": 1.0, "rotation": 0.0, "opacity": 1.0},
                "adjustments": {"brightness": 0.0, "contrast": 0.0, "saturation": 0.0, "temperature": 0.0},
                "filter": null, "fadeIn": 0.0, "fadeOut": 0.0, "transitionOut": null
            }]
        }],
        "assets": [{
            "id": "a1", "kind": "video", "name": "countdown.mp4", "hash": VALID_HASH,
            "duration": 5.0, "width": 1280.0, "height": 720.0, "fps": 30.0,
            "hasAudio": true, "mimeType": "video/mp4"
        }],
        "subtitles": null,
        "createdAt": "2026-01-01T00:00:00Z", "updatedAt": "2026-01-01T00:00:00Z"
    });

    let payload = serde_json::json!({
        "project": project,
        "options": { "quality": "draft", "scale": 0.5 }
    });
    let res = app
        .clone()
        .oneshot(
            Request::post(format!("/api/v1/jobs/{id}/render"))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::ACCEPTED);

    // poll until done/failed
    let mut last = Value::Null;
    for _ in 0..120 {
        tokio::time::sleep(Duration::from_millis(250)).await;
        let res = app
            .clone()
            .oneshot(
                Request::get(format!("/api/v1/jobs/{id}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        last = body_json(res).await;
        if last["status"] == "done" || last["status"] == "failed" {
            break;
        }
    }
    assert_eq!(last["status"], "done", "render finished: {last}");

    // download streams a real MP4
    let res = app
        .oneshot(
            Request::get(format!("/api/v1/jobs/{id}/download"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    assert!(bytes.len() > 10_000, "plausible mp4 size");
    assert_eq!(&bytes[4..8], b"ftyp", "mp4 magic");
}
