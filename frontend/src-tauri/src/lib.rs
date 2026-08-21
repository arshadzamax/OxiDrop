use std::path::PathBuf;
use std::sync::Arc;
use std::str::FromStr;
use tokio::sync::Mutex;
use tauri::{State, Window, Emitter, Manager};
use iroh_tickets::Ticket as _;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use log::{info, warn, error};

pub const OXIDROP_ALPN: &[u8] = b"oxidrop/file/1.0";

#[derive(Clone, serde::Serialize)]
pub struct IrohProgressPayload {
    pub bytes_transferred: u64,
    pub total_bytes: u64,
    pub speed_bytes_per_sec: f64,
    pub percent: f64,
    pub status: String,
}

#[derive(Clone, serde::Serialize)]
pub struct IrohTelemetryPayload {
    pub state: String,
    pub node_id: String,
    pub relay_url: Option<String>,
    pub latency_ms: Option<f64>,
    pub transport: String,
    pub log: Option<String>,
}

pub struct IrohState {
    pub endpoint: Arc<Mutex<Option<iroh::Endpoint>>>,
    pub active_file: Arc<Mutex<Option<PathBuf>>>,
    pub accept_task: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
}

impl IrohState {
    pub async fn get_or_spawn(&self, window: &Window) -> Result<iroh::Endpoint, String> {
        let mut guard = self.endpoint.lock().await;
        if let Some(ref ep) = *guard {
            return Ok(ep.clone());
        }

        info!("Initializing Iroh 1.0 Endpoint with n0 relays & discovery...");
        let _ = window.emit("iroh-log", "Initializing Iroh 1.0 Endpoint with n0 relays & discovery...");
        let _ = window.emit("iroh-telemetry", IrohTelemetryPayload {
            state: "binding".to_string(),
            node_id: String::new(),
            relay_url: None,
            latency_ms: None,
            transport: "Initializing".to_string(),
            log: Some("Binding local QUIC endpoint with n0 discovery...".to_string()),
        });

        let endpoint = iroh::Endpoint::builder(iroh::endpoint::presets::N0)
            .alpns(vec![OXIDROP_ALPN.to_vec()])
            .bind()
            .await
            .map_err(|e| {
                let err_msg = format!("Failed to bind Iroh endpoint: {}", e);
                error!("{}", err_msg);
                let _ = window.emit("iroh-log", &err_msg);
                err_msg
            })?;

        let node_id = endpoint.id().to_string();
        info!("Iroh 1.0 Endpoint bound successfully. NodeId: {}", node_id);
        let _ = window.emit("iroh-log", format!("Iroh 1.0 Endpoint bound successfully. NodeId: {}", node_id));
        let _ = window.emit("iroh-telemetry", IrohTelemetryPayload {
            state: "ready".to_string(),
            node_id: node_id.clone(),
            relay_url: None,
            latency_ms: None,
            transport: "QUIC (Listening)".to_string(),
            log: Some(format!("Bound endpoint {}", node_id)),
        });

        let ep_clone = endpoint.clone();
        let file_ref = self.active_file.clone();
        let window_clone = window.clone();

        let handle = tokio::spawn(async move {
            info!("Iroh background connection acceptor started.");
            while let Some(incoming) = ep_clone.accept().await {
                let file_ref = file_ref.clone();
                let window_clone = window_clone.clone();
                tokio::spawn(async move {
                    match incoming.accept() {
                        Ok(connecting) => {
                            match connecting.await {
                                Ok(conn) => {
                                    let remote_id = conn.remote_id().to_string();
                                    info!("Incoming QUIC peer connected: {}", remote_id);
                                    let _ = window_clone.emit("iroh-log", format!("Incoming QUIC peer connected: {}", remote_id));
                                    let _ = window_clone.emit("iroh-telemetry", IrohTelemetryPayload {
                                        state: "connected".to_string(),
                                        node_id: remote_id.clone(),
                                        relay_url: None,
                                        latency_ms: None,
                                        transport: "QUIC / P2P Direct or Relay".to_string(),
                                        log: Some(format!("Peer connected: {}", remote_id)),
                                    });

                                    match conn.accept_bi().await {
                                        Ok((mut send_stream, mut recv_stream)) => {
                                            // Read 1-byte handshake from downloader
                                            let mut ping = [0u8; 1];
                                            let read_res = recv_stream.read(&mut ping).await;
                                            info!("Handshake read result from peer: {:?}", read_res);

                                            let path_opt = {
                                                let guard = file_ref.lock().await;
                                                guard.clone()
                                            };

                                            if let Some(path) = path_opt {
                                                info!("Streaming active file {:?} to remote peer...", path);
                                                let _ = window_clone.emit("iroh-log", format!("Streaming active file {:?} to peer...", path));
                                                match tokio::fs::File::open(&path).await {
                                                    Ok(mut file) => {
                                                        let mut buf = [0u8; 64 * 1024];
                                                        let mut total_sent = 0u64;
                                                        while let Ok(n) = file.read(&mut buf).await {
                                                            if n == 0 { break; }
                                                            if let Err(e) = send_stream.write_all(&buf[..n]).await {
                                                                warn!("Error writing to peer stream: {}", e);
                                                                break;
                                                            }
                                                            total_sent += n as u64;
                                                        }
                                                        let _ = send_stream.finish();
                                                        info!("Finished streaming file ({} bytes) to remote peer.", total_sent);
                                                        let _ = window_clone.emit("iroh-log", format!("Finished streaming file ({} bytes) to remote peer.", total_sent));
                                                        // Keep connection alive briefly so remote peer can finish reading and flushing before conn is closed
                                                        tokio::time::sleep(std::time::Duration::from_secs(4)).await;
                                                    }
                                                    Err(e) => {
                                                        error!("Failed to open file for streaming: {}", e);
                                                        let _ = window_clone.emit("iroh-log", format!("Error opening file: {}", e));
                                                    }
                                                }
                                            } else {
                                                warn!("No active file registered for streaming.");
                                                let _ = window_clone.emit("iroh-log", "No active file registered for incoming peer.");
                                            }
                                        }
                                        Err(e) => {
                                            error!("Failed to accept bi-stream from peer: {}", e);
                                        }
                                    }
                                }
                                Err(e) => {
                                    error!("Failed connecting handshake with incoming peer: {}", e);
                                }
                            }
                        }
                        Err(e) => {
                            error!("Failed to accept incoming connection: {}", e);
                        }
                    }
                });
            }
            info!("Iroh connection accept loop terminated.");
        });

        {
            let mut task_guard = self.accept_task.lock().await;
            if let Some(old_task) = task_guard.take() {
                old_task.abort();
            }
            *task_guard = Some(handle);
        }

        *guard = Some(endpoint.clone());
        Ok(endpoint)
    }
}

#[tauri::command]
async fn start_iroh_share(
    window: Window,
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

    info!("Starting Iroh share for file: {} ({} bytes)", file_name, file_size);

    // Register active file for direct QUIC streaming
    {
        let mut guard = state.active_file.lock().await;
        *guard = Some(path.clone());
    }

    let ep = state.get_or_spawn(&window).await?;
    
    // Allow brief window for endpoint to discover closest relay server
    for _ in 0..12 {
        let addr = ep.addr();
        if addr.relay_urls().next().is_some() || addr.ip_addrs().next().is_some() {
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }

    let node_addr = ep.addr();
    let relay_str = node_addr.relay_urls().next().map(|r| r.to_string());

    // Create standard EndpointTicket including relay info
    let ticket = iroh_tickets::endpoint::EndpointTicket::new(node_addr);
    let ticket_str = ticket.to_string();

    info!("Generated Iroh EndpointTicket for {}: {}", file_name, ticket_str);
    let _ = window.emit("iroh-log", format!("Generated Iroh EndpointTicket for {}: {}", file_name, ticket_str));
    let _ = window.emit("iroh-telemetry", IrohTelemetryPayload {
        state: "ready".to_string(),
        node_id: ep.id().to_string(),
        relay_url: relay_str,
        latency_ms: None,
        transport: "QUIC (Sharing)".to_string(),
        log: Some(format!("Sharing file {}", file_name)),
    });

    // Canonical format: <ticket_str>#<file_name>#<file_size>
    Ok(format!("{}#{}#{}", ticket_str, file_name, file_size))
}

#[tauri::command]
async fn download_from_iroh(
    window: Window,
    state: State<'_, IrohState>,
    ticket_str: String,
    output_dir: String,
) -> Result<String, String> {
    info!("download_from_iroh initiated with ticket: {}", ticket_str);
    
    // Execute download inside a spawned Tokio task with a panic boundary
    // so any internal panic in Quinn/Iroh returns a clean Err instead of killing the app process.
    let window_clone = window.clone();
    let state_endpoint = state.endpoint.clone();
    let state_active_file = state.active_file.clone();
    let state_accept_task = state.accept_task.clone();
    
    let download_task = tokio::spawn(async move {
        let ep = {
            let temp_state = IrohState {
                endpoint: state_endpoint,
                active_file: state_active_file,
                accept_task: state_accept_task,
            };
            temp_state.get_or_spawn(&window_clone).await?
        };

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

        let start_time = std::time::Instant::now();
        let total_size = expected_size.unwrap_or(0);

        let _ = window_clone.emit("iroh-progress", IrohProgressPayload {
            bytes_transferred: 0,
            total_bytes: total_size,
            speed_bytes_per_sec: 0.0,
            percent: 0.0,
            status: "connecting".to_string(),
        });

        let final_name = original_filename.unwrap_or_else(|| {
            let file_id_prefix: String = raw_ticket_str.chars().take(8).collect();
            format!("iroh_{}.download", file_id_prefix)
        });

        let target_dir = if output_dir.trim().is_empty() || output_dir == "." {
            dirs::download_dir().unwrap_or_else(|| PathBuf::from("."))
        } else {
            PathBuf::from(&output_dir)
        };

        let dest_path = target_dir.join(&final_name);
        if let Some(parent) = dest_path.parent() {
            let _ = tokio::fs::create_dir_all(parent).await;
        }

        info!("Parsing ticket string: {}", raw_ticket_str);
        // Universal Ticket & Address Decoder
        let target_addr: iroh::EndpointAddr = if let Ok(ticket) = iroh_tickets::endpoint::EndpointTicket::decode_string(raw_ticket_str) {
            info!("Parsed standard EndpointTicket for node: {}", ticket.endpoint_addr().id);
            ticket.endpoint_addr().clone()
        } else if let Ok(ticket) = raw_ticket_str.parse::<iroh_tickets::endpoint::EndpointTicket>() {
            info!("Parsed EndpointTicket via parse() for node: {}", ticket.endpoint_addr().id);
            ticket.endpoint_addr().clone()
        } else if raw_ticket_str.len() == 64 && raw_ticket_str.chars().all(|c| c.is_ascii_hexdigit()) {
            let bytes = hex::decode(raw_ticket_str).map_err(|e| format!("Hex decode error: {}", e))?;
            let bytes_arr: [u8; 32] = bytes.try_into().map_err(|_| "Expected 32 bytes for NodeId".to_string())?;
            let ep_id = iroh::EndpointId::from_bytes(&bytes_arr).map_err(|e| format!("Invalid NodeId: {}", e))?;
            info!("Parsed 64-hex NodeId: {}", ep_id);
            iroh::EndpointAddr::from(ep_id)
        } else if let Ok(ep_id) = iroh::EndpointId::from_str(raw_ticket_str) {
            info!("Parsed Base32 EndpointId: {}", ep_id);
            iroh::EndpointAddr::from(ep_id)
        } else {
            let err_msg = format!("Invalid Iroh ticket or EndpointId token: {}", raw_ticket_str);
            error!("{}", err_msg);
            return Err(err_msg);
        };

        let remote_node_id = target_addr.id.to_string();
        info!("Connecting to peer {} over QUIC ALPN {:?}...", remote_node_id, String::from_utf8_lossy(OXIDROP_ALPN));
        let _ = window_clone.emit("iroh-log", format!("Connecting to peer {} over QUIC...", remote_node_id));
        let _ = window_clone.emit("iroh-telemetry", IrohTelemetryPayload {
            state: "connecting".to_string(),
            node_id: remote_node_id.clone(),
            relay_url: target_addr.relay_urls().next().map(|r| r.to_string()),
            latency_ms: None,
            transport: "QUIC (Connecting)".to_string(),
            log: Some(format!("Dialing node {}", remote_node_id)),
        });

        // 30-second connection timeout
        let conn = match tokio::time::timeout(
            std::time::Duration::from_secs(30),
            ep.connect(target_addr.clone(), OXIDROP_ALPN)
        ).await {
            Ok(Ok(conn)) => conn,
            Ok(Err(e)) => {
                let err_msg = format!("Failed to connect to peer via QUIC: {}", e);
                error!("{}", err_msg);
                let _ = window_clone.emit("iroh-log", &err_msg);
                let _ = window_clone.emit("iroh-telemetry", IrohTelemetryPayload {
                    state: "failed".to_string(),
                    node_id: remote_node_id.clone(),
                    relay_url: None,
                    latency_ms: None,
                    transport: "QUIC / Failed".to_string(),
                    log: Some(err_msg.clone()),
                });
                return Err(err_msg);
            }
            Err(_) => {
                let err_msg = "QUIC connection timed out after 30 seconds. Ensure remote peer is still sharing and connected to internet.".to_string();
                error!("{}", err_msg);
                let _ = window_clone.emit("iroh-log", &err_msg);
                return Err(err_msg);
            }
        };

        info!("QUIC connection established! Opening bidirectional stream...");
        let _ = window_clone.emit("iroh-log", "QUIC connection established! Opening bidirectional stream...");
        let _ = window_clone.emit("iroh-telemetry", IrohTelemetryPayload {
            state: "streaming".to_string(),
            node_id: remote_node_id.clone(),
            relay_url: target_addr.relay_urls().next().map(|r| r.to_string()),
            latency_ms: None,
            transport: "QUIC Bi-directional Stream".to_string(),
            log: Some("Stream opened, transmitting handshake...".to_string()),
        });

        let (mut send_stream, mut recv_stream) = conn.open_bi().await
            .map_err(|e| {
                let err_msg = format!("Failed to open bidirectional stream: {}", e);
                error!("{}", err_msg);
                err_msg
            })?;

        // Send 1-byte handshake to propagate stream frame
        if let Err(e) = send_stream.write_all(b"1").await {
            warn!("Failed to send handshake byte: {}", e);
        }
        let _ = send_stream.finish();

        let mut dest_file = tokio::fs::File::create(&dest_path).await
            .map_err(|e| format!("Failed to create destination file {:?}: {}", dest_path, e))?;

        let mut buffer = [0u8; 64 * 1024];
        let mut transferred = 0u64;
        let mut last_emit = std::time::Instant::now();
        let mut last_bytes = 0u64;

        loop {
            let n = recv_stream.read(&mut buffer).await
                .map_err(|e| format!("Error reading from QUIC stream: {}", e))?;
            if let Some(bytes_read) = n {
                if bytes_read == 0 {
                    break;
                }
                dest_file.write_all(&buffer[..bytes_read]).await
                    .map_err(|e| format!("Failed to write to file: {}", e))?;
                transferred += bytes_read as u64;

                if last_emit.elapsed() >= std::time::Duration::from_millis(100) {
                    let dt = last_emit.elapsed().as_secs_f64();
                    let speed = if dt > 0.0 {
                        (transferred.saturating_sub(last_bytes)) as f64 / dt
                    } else {
                        0.0
                    };
                    let pct = if total_size > 0 {
                        ((transferred as f64 / total_size as f64) * 100.0).min(99.0)
                    } else {
                        50.0
                    };
                    let _ = window_clone.emit("iroh-progress", IrohProgressPayload {
                        bytes_transferred: transferred,
                        total_bytes: total_size,
                        speed_bytes_per_sec: speed,
                        percent: pct,
                        status: "downloading".to_string(),
                    });
                    last_emit = std::time::Instant::now();
                    last_bytes = transferred;
                }
            } else {
                break;
            }
        }

        dest_file.flush().await
            .map_err(|e| format!("Failed to flush destination file: {}", e))?;

        let total_duration = start_time.elapsed().as_secs_f64();
        let final_size = tokio::fs::metadata(&dest_path).await.map(|m| m.len()).unwrap_or(transferred);
        let avg_speed = if total_duration > 0.0 {
            final_size as f64 / total_duration
        } else {
            0.0
        };

        let _ = window_clone.emit("iroh-progress", IrohProgressPayload {
            bytes_transferred: final_size,
            total_bytes: final_size,
            speed_bytes_per_sec: avg_speed,
            percent: 100.0,
            status: "completed".to_string(),
        });

        let success_msg = format!("Download complete: {} ({} bytes) in {:.2}s ({:.2} MB/s)", final_name, final_size, total_duration, avg_speed / (1024.0 * 1024.0));
        info!("{}", success_msg);
        let _ = window_clone.emit("iroh-log", &success_msg);
        let _ = window_clone.emit("iroh-telemetry", IrohTelemetryPayload {
            state: "completed".to_string(),
            node_id: remote_node_id,
            relay_url: target_addr.relay_urls().next().map(|r| r.to_string()),
            latency_ms: Some(total_duration * 1000.0),
            transport: "QUIC (Completed)".to_string(),
            log: Some(success_msg),
        });

        Ok(dest_path.to_string_lossy().to_string())
    });

    match download_task.await {
        Ok(result) => result,
        Err(join_err) => {
            if join_err.is_panic() {
                let err_msg = "Iroh transfer encountered an internal panic in QUIC networking layer. Prevented app crash.".to_string();
                error!("{}", err_msg);
                let _ = window.emit("iroh-log", &err_msg);
                Err(err_msg)
            } else {
                let err_msg = format!("Download task failed: {}", join_err);
                error!("{}", err_msg);
                Err(err_msg)
            }
        }
    }
}

#[tauri::command]
async fn pick_file_dialog() -> Result<Option<String>, String> {
    tokio::task::spawn_blocking(|| {
        let file = rfd::FileDialog::new()
            .set_title("Select File to Share")
            .pick_file();
        Ok(file.map(|p| p.to_string_lossy().to_string()))
    })
    .await
    .map_err(|e| format!("Dialog error: {}", e))?
}

#[tauri::command]
async fn pick_folder_dialog() -> Result<Option<String>, String> {
    tokio::task::spawn_blocking(|| {
        let folder = rfd::FileDialog::new()
            .set_title("Select Save Folder")
            .pick_folder();
        Ok(folder.map(|p| p.to_string_lossy().to_string()))
    })
    .await
    .map_err(|e| format!("Dialog error: {}", e))?
}

pub fn setup_panic_hook() {
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |panic_info| {
        let payload = if let Some(s) = panic_info.payload().downcast_ref::<&str>() {
            s.to_string()
        } else if let Some(s) = panic_info.payload().downcast_ref::<String>() {
            s.clone()
        } else {
            "Unknown panic payload".to_string()
        };

        let location = panic_info
            .location()
            .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
            .unwrap_or_else(|| "unknown location".to_string());
        let backtrace = std::backtrace::Backtrace::capture();
        let log_msg = format!(
            "[CRITICAL RUST PANIC] at {}:\nPayload: {}\nBacktrace:\n{:?}",
            location, payload, backtrace
        );

        eprintln!("{}", log_msg);
        log::error!("{}", log_msg);

        // Write to persistent crash log file in local app data directory
        if let Some(mut path) = dirs::data_local_dir() {
            path.push("OxiDrop");
            let _ = std::fs::create_dir_all(&path);
            path.push("crash.log");
            let _ = std::fs::write(&path, format!("{}\n---\n", log_msg));
        }

        default_hook(panic_info);
    }));
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    setup_panic_hook();

    let iroh_state = IrohState {
        endpoint: Arc::new(Mutex::new(None)),
        active_file: Arc::new(Mutex::new(None)),
        accept_task: Arc::new(Mutex::new(None)),
    };

    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::default()
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                        file_name: Some("oxidrop_tauri".to_string()),
                    }),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview),
                ])
                .level(log::LevelFilter::Info)
                .build(),
        )
        .manage(iroh_state)
        .invoke_handler(tauri::generate_handler![
            start_iroh_share,
            download_from_iroh,
            pick_file_dialog,
            pick_folder_dialog
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                info!("Tauri window close requested, performing clean teardown...");
                let state: State<IrohState> = window.state();
                let accept_task = state.accept_task.clone();
                let endpoint = state.endpoint.clone();
                tokio::spawn(async move {
                    if let Some(task) = accept_task.lock().await.take() {
                        task.abort();
                    }
                    if let Some(ep) = endpoint.lock().await.take() {
                        let _ = ep.close().await;
                    }
                });
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
