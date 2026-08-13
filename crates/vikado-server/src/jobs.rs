//! In-process job registry: statuses, progress channels, cancellation,
//! per-job workspaces on disk, TTL cleanup.

use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{watch, RwLock, Semaphore};
use uuid::Uuid;
use vikado_renderer::CancellationToken;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum JobPhase {
    Created,
    Queued,
    Rendering,
    Done,
    Failed,
    Canceled,
}

#[derive(Debug, Clone, Serialize)]
pub struct JobStatus {
    pub job_id: String,
    pub status: JobPhase,
    pub progress: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<JobError>,
}

#[derive(Debug, Clone, Serialize)]
pub struct JobError {
    pub code: String,
    pub message: String,
}

pub struct JobEntry {
    pub status_tx: watch::Sender<JobStatus>,
    pub cancel: CancellationToken,
    pub created_at: Instant,
    pub dir: PathBuf,
}

pub struct JobStore {
    pub jobs: RwLock<HashMap<Uuid, Arc<JobEntry>>>,
    pub render_slots: Semaphore,
    pub data_dir: PathBuf,
    pub ttl: Duration,
}

impl JobStore {
    pub fn new(data_dir: PathBuf, max_concurrent: usize, ttl: Duration) -> Self {
        Self {
            jobs: RwLock::new(HashMap::new()),
            render_slots: Semaphore::new(max_concurrent),
            data_dir,
            ttl,
        }
    }

    pub fn job_dir(&self, id: Uuid) -> PathBuf {
        self.data_dir.join("jobs").join(id.to_string())
    }

    pub async fn create(&self) -> anyhow::Result<Uuid> {
        let id = Uuid::now_v7();
        let dir = self.job_dir(id);
        tokio::fs::create_dir_all(dir.join("assets")).await?;
        let (status_tx, _) = watch::channel(JobStatus {
            job_id: id.to_string(),
            status: JobPhase::Created,
            progress: 0.0,
            error: None,
        });
        let entry = Arc::new(JobEntry {
            status_tx,
            cancel: CancellationToken::new(),
            created_at: Instant::now(),
            dir,
        });
        self.jobs.write().await.insert(id, entry);
        Ok(id)
    }

    pub async fn get(&self, id: Uuid) -> Option<Arc<JobEntry>> {
        self.jobs.read().await.get(&id).cloned()
    }

    pub async fn remove(&self, id: Uuid) -> Option<Arc<JobEntry>> {
        let entry = self.jobs.write().await.remove(&id);
        if let Some(e) = &entry {
            e.cancel.cancel();
            let dir = e.dir.clone();
            tokio::spawn(async move {
                let _ = tokio::fs::remove_dir_all(dir).await;
            });
        }
        entry
    }

    /// Periodic TTL sweep + startup orphan removal.
    pub async fn sweep(&self) {
        let expired: Vec<Uuid> = {
            let jobs = self.jobs.read().await;
            jobs.iter()
                .filter(|(_, e)| e.created_at.elapsed() > self.ttl)
                .map(|(id, _)| *id)
                .collect()
        };
        for id in expired {
            tracing::info!(job = %id, "sweeping expired job");
            self.remove(id).await;
        }
    }

    pub async fn remove_orphan_dirs(&self) {
        let jobs_dir = self.data_dir.join("jobs");
        let Ok(mut entries) = tokio::fs::read_dir(&jobs_dir).await else {
            return;
        };
        let known = self.jobs.read().await;
        while let Ok(Some(entry)) = entries.next_entry().await {
            let keep = entry
                .file_name()
                .to_str()
                .and_then(|n| Uuid::parse_str(n).ok())
                .map(|id| known.contains_key(&id))
                .unwrap_or(false);
            if !keep {
                let _ = tokio::fs::remove_dir_all(entry.path()).await;
            }
        }
    }
}

pub fn update_status(entry: &JobEntry, f: impl FnOnce(&mut JobStatus)) {
    entry.status_tx.send_modify(f);
}
