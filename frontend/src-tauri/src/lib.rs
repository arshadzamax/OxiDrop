use std::path::PathBuf;
use std::sync::Arc;
use std::str::FromStr;
use tokio::sync::Mutex;
use tauri::{State, Window, Emitter};
use futures_util::StreamExt;
use iroh::ticket::BlobTicket;

#[derive(Clone, serde::Serialize)]
pub struct IrohProgressPayload {
    pub bytes_transferred: u64,
    pub total_bytes: u64,
    pub speed_bytes_per_sec: f64,
    pub percent: f64,
    pub status: String,
}

pub struct IrohNode {
    pub pool: Arc<iroh_blobs::util::local_pool::LocalPool>,
    pub endpoint: iroh::Endpoint,
    pub store: iroh_blobs::store::mem::Store,
    pub blobs: Arc<iroh_blobs::net_protocol::Blobs<iroh_blobs::store::mem::Store>>,
    pub router: iroh::protocol::Router,
}

pub struct IrohState {
    pub node: Arc<Mutex<Option<IrohNode>>>,
}

impl IrohState {
    pub async fn get_or_spawn(&self) -> Result<IrohNode, String> {
        let mut guard = self.node.lock().await;
        if let Some(ref node) = *guard {
            return Ok(IrohNode {
                pool: node.pool.clone(),
                endpoint: node.endpoint.clone(),
                store: node.store.clone(),
                blobs: node.blobs.clone(),
                router: node.router.clone(),
            });
        }

        let endpoint = iroh::Endpoint::builder()
            .discovery_n0()
            .bind()
            .await
            .map_err(|e| format!("Failed to bind Iroh endpoint: {}", e))?;

        let pool = Arc::new(iroh_blobs::util::local_pool::LocalPool::default());
        let store = iroh_blobs::store::mem::Store::new();
        let blobs = iroh_blobs::net_protocol::Blobs::builder(store.clone())
            .build(pool.handle(), &endpoint);

        let router = iroh::protocol::Router::builder(endpoint.clone())
            .accept(iroh_blobs::ALPN, blobs.clone())
            .spawn()
            .await
            .map_err(|e| format!("Failed to spawn Iroh protocol router: {}", e))?;

        let node = IrohNode {
            pool: pool.clone(),
            endpoint,
            store,
            blobs,
            router,
        };

        *guard = Some(IrohNode {
            pool: node.pool.clone(),
            endpoint: node.endpoint.clone(),
            store: node.store.clone(),
            blobs: node.blobs.clone(),
            router: node.router.clone(),
        });

        Ok(node)
    }
}

#[tauri::command]
async fn start_iroh_share(
    state: State<'_, IrohState>,
    file_path: String,
) -> Result<String, String> {
    let path = PathBuf::from(&file_path);
    if !path.exists() {
        return Err("File path does not exist on local disk".to_string());
    }

    let file_name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "shared_file".to_string());

    let file_size = tokio::fs::metadata(&path)
        .await
        .map(|m| m.len())
        .unwrap_or(0);

    let node = state.get_or_spawn().await?;
    let client = node.blobs.client();

    let outcome_progress = client
        .add_from_path(
            path,
            false,
            iroh_blobs::util::SetTagOption::Auto,
            iroh_blobs::rpc::client::blobs::WrapOption::NoWrap,
        )
        .await
        .map_err(|e| format!("Failed to import file into Iroh blobs: {}", e))?;

    let outcome = outcome_progress
        .await
        .map_err(|e| format!("Error during blob import: {}", e))?;

    let node_addr = node
        .endpoint
        .node_addr()
        .await
        .map_err(|e| format!("Failed to get node address: {}", e))?;

    let ticket = BlobTicket::new(
        node_addr,
        outcome.hash,
        iroh_blobs::BlobFormat::Raw,
    )
    .map_err(|e| format!("Failed to create Iroh ticket: {}", e))?;

    // Embed the original filename and file size in ticket string so receiver automatically preserves the name & extension
    Ok(format!("{}#{}#{}", ticket.to_string(), file_name, file_size))
}

#[tauri::command]
async fn download_from_iroh(
    window: Window,
    state: State<'_, IrohState>,
    ticket_str: String,
    output_dir: String,
) -> Result<String, String> {
    let parts: Vec<&str> = ticket_str.split('#').collect();
    let raw_ticket_str = parts[0].trim();
    let original_filename = if parts.len() > 1 && !parts[1].trim().is_empty() {
        Some(parts[1].trim().to_string())
    } else {
        None
    };
    let expected_size: Option<u64> = if parts.len() > 2 {
        parts[2].trim().parse().ok()
    } else {
        None
    };

    let ticket = BlobTicket::from_str(raw_ticket_str)
        .map_err(|e| format!("Invalid Iroh ticket: {}", e))?;

    let node = state.get_or_spawn().await?;
    let client = node.blobs.client();

    let mut progress_stream = client
        .download(ticket.hash(), ticket.node_addr().clone())
        .await
        .map_err(|e| format!("Failed to initiate download stream: {}", e))?;

    let start_time = std::time::Instant::now();
    let mut last_emit = std::time::Instant::now();
    let mut last_bytes = 0u64;
    let mut current_bytes = 0u64;
    let mut total_size = expected_size.unwrap_or(0);

    let _ = window.emit("iroh-progress", IrohProgressPayload {
        bytes_transferred: 0,
        total_bytes: total_size,
        speed_bytes_per_sec: 0.0,
        percent: 0.0,
        status: "connecting".to_string(),
    });

    while let Some(msg) = progress_stream.next().await {
        let event = msg.map_err(|e| format!("Error during download: {}", e))?;
        use iroh_blobs::get::db::DownloadProgress;
        match event {
            DownloadProgress::Found { size, .. } => {
                if total_size == 0 {
                    total_size = size;
                }
            }
            DownloadProgress::Progress { offset, .. } => {
                current_bytes = offset;
                if last_emit.elapsed() >= std::time::Duration::from_millis(100) {
                    let dt = last_emit.elapsed().as_secs_f64();
                    let speed = if dt > 0.0 {
                        (current_bytes.saturating_sub(last_bytes)) as f64 / dt
                    } else {
                        0.0
                    };
                    let pct = if total_size > 0 {
                        ((current_bytes as f64 / total_size as f64) * 100.0).min(99.0)
                    } else {
                        50.0
                    };
                    let _ = window.emit("iroh-progress", IrohProgressPayload {
                        bytes_transferred: current_bytes,
                        total_bytes: total_size,
                        speed_bytes_per_sec: speed,
                        percent: pct,
                        status: "downloading".to_string(),
                    });
                    last_emit = std::time::Instant::now();
                    last_bytes = current_bytes;
                }
            }
            _ => {}
        }
    }

    // Read the downloaded bytes from local node store
    let bytes = client
        .read_to_bytes(ticket.hash())
        .await
        .map_err(|e| format!("Failed to read downloaded blob: {}", e))?;

    let final_name = original_filename.unwrap_or_else(|| {
        let file_id_prefix: String = ticket.hash().to_string().chars().take(8).collect();
        format!("iroh_{}.download", file_id_prefix)
    });

    let dest_path = PathBuf::from(output_dir).join(&final_name);

    tokio::fs::write(&dest_path, &bytes)
        .await
        .map_err(|e| format!("Failed to write file to destination path: {}", e))?;

    let total_duration = start_time.elapsed().as_secs_f64();
    let avg_speed = if total_duration > 0.0 {
        bytes.len() as f64 / total_duration
    } else {
        0.0
    };

    let _ = window.emit("iroh-progress", IrohProgressPayload {
        bytes_transferred: bytes.len() as u64,
        total_bytes: bytes.len() as u64,
        speed_bytes_per_sec: avg_speed,
        percent: 100.0,
        status: "completed".to_string(),
    });

    Ok(dest_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn pick_file_dialog() -> Result<Option<String>, String> {
    let file = rfd::FileDialog::new()
        .set_title("Select File to Share")
        .pick_file();

    match file {
        Some(path) => Ok(Some(path.to_string_lossy().to_string())),
        None => Ok(None),
    }
}

#[tauri::command]
async fn pick_folder_dialog() -> Result<Option<String>, String> {
    let folder = rfd::FileDialog::new()
        .set_title("Select Save Folder")
        .pick_folder();

    match folder {
        Some(path) => Ok(Some(path.to_string_lossy().to_string())),
        None => Ok(None),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let iroh_state = IrohState {
        node: Arc::new(Mutex::new(None)),
    };

    tauri::Builder::default()
        .manage(iroh_state)
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_iroh_share,
            download_from_iroh,
            pick_file_dialog,
            pick_folder_dialog
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
