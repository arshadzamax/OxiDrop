use std::path::PathBuf;
use std::sync::Arc;
use std::str::FromStr;
use tokio::sync::Mutex;
use tokio::io::AsyncReadExt;
use tauri::{State, Manager};
use futures_util::StreamExt;

// We store the active Iroh node in the Tauri global state context.
pub struct IrohState {
    pub node: Arc<Mutex<Option<iroh::node::Node<iroh_blobs::store::mem::Store>>>>,
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

    let mut node_guard = state.node.lock().await;
    
    // Spawn the Iroh node lazily if it is not already running
    let node = match &*node_guard {
        Some(n) => n.clone(),
        None => {
            let n = iroh::node::Node::memory()
                .spawn()
                .await
                .map_err(|e| format!("Failed to spawn Iroh node: {}", e))?;
            *node_guard = Some(n.clone());
            n
        }
    };

    // Add the file to Iroh's in-memory store
    let outcome = node.blobs
        .add_from_path(path, iroh_blobs::util::SetTagOption::Auto)
        .await
        .map_err(|e| format!("Failed to add file to Iroh blobs: {}", e))?;

    // Create a shareable BlobTicket containing hash and node address
    let ticket = iroh_blobs::ticket::BlobTicket::new(
        node.endpoint().node_id(),
        outcome.hash,
        iroh_blobs::BlobFormat::Raw,
    )
    .map_err(|e| format!("Failed to create Iroh ticket: {}", e))?;

    Ok(ticket.to_string())
}

#[tauri::command]
async fn download_from_iroh(
    state: State<'_, IrohState>,
    ticket_str: String,
    output_dir: String,
) -> Result<String, String> {
    let ticket = iroh_blobs::ticket::BlobTicket::from_str(&ticket_str)
        .map_err(|e| format!("Invalid Iroh ticket: {}", e))?;

    let mut node_guard = state.node.lock().await;
    
    // Spawn the node if not running
    let node = match &*node_guard {
        Some(n) => n.clone(),
        None => {
            let n = iroh::node::Node::memory()
                .spawn()
                .await
                .map_err(|e| format!("Failed to spawn Iroh node: {}", e))?;
            *node_guard = Some(n.clone());
            n
        }
    };

    // Download the content from the peer via ticket address
    let mut progress_stream = node.blobs
        .download(ticket.hash(), ticket.node_addr().clone())
        .await
        .map_err(|e| format!("Failed to start download stream: {}", e))?;

    // Wait for the download stream to finish
    while let Some(msg) = progress_stream.next().await {
        let _event = msg.map_err(|e| format!("Error in download progress stream: {}", e))?;
    }

    // Read the downloaded bytes from the local node store
    let mut reader = node.blobs
        .read(ticket.hash())
        .await
        .map_err(|e| format!("Failed to read blob from node: {}", e))?;

    let mut buffer = Vec::new();
    reader.read_to_end(&mut buffer)
        .await
        .map_err(|e| format!("Failed to extract bytes: {}", e))?;

    // Save the bytes as a physical file on local disk
    let file_id_prefix: String = ticket.hash().to_string().chars().take(8).collect();
    let dest_path = PathBuf::from(output_dir).join(format!("iroh_{}.download", file_id_prefix));
    
    tokio::fs::write(&dest_path, buffer)
        .await
        .map_err(|e| format!("Failed to write file to destination path: {}", e))?;

    Ok(dest_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn pick_file_dialog() -> Result<Option<String>, String> {
    // Open native file selector dialog
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
    // Open native folder selector dialog
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
