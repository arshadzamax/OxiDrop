use anyhow::{anyhow, Result};
use futures_util::{SinkExt, StreamExt};
use std::env;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::fs::OpenOptions;
use tokio::io::AsyncWriteExt;
use tokio::sync::Mutex;
use tokio::time::{sleep, Duration};
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
use uuid::Uuid;

use ::webrtc::data_channel::data_channel_init::RTCDataChannelInit;
use ::webrtc::data_channel::RTCDataChannel;
use ::webrtc::peer_connection::sdp::session_description::RTCSessionDescription;
use ::webrtc::peer_connection::RTCPeerConnection;

// Import our custom modules
mod config;
mod transfer;
mod types;
mod webrtc_utils;

use types::{
    AnswerMessageData, FileMetadataResponse, NewAccessRequestData, OfferMessageData,
    ReceiveAnswerMessageData, ReceiveOfferMessageData, RegisterFileResponse, RegisterUserData,
    RequestAccessData, RequestStatusUpdateData, TransferHeader, WsMessage,
};

// --- MAIN CLI ENTRYPOINT ---
#[tokio::main]
async fn main() -> Result<()> {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        print_usage();
        return Ok(());
    }

    let mode = &args[1];
    let signaling_url = env::var("SIGNALING_URL").unwrap_or_else(|_| "ws://127.0.0.1:5000".to_string());
    let api_url = env::var("API_URL").unwrap_or_else(|_| "http://127.0.0.1:5000".to_string());

    match mode.as_str() {
        "send" => {
            if args.len() < 3 {
                println!("Error: Please specify the file path to share.");
                return Ok(());
            }
            let file_path = &args[2];
            run_sender(file_path, &signaling_url, &api_url).await?;
        }
        "receive" => {
            if args.len() < 4 {
                println!("Error: Please specify the File ID and output file path.");
                return Ok(());
            }
            let file_id = &args[2];
            let output_path = &args[3];
            run_receiver(file_id, output_path, &signaling_url, &api_url).await?;
        }
        _ => {
            print_usage();
        }
    }

    Ok(())
}

fn print_usage() {
    println!("OxiDrop Client Daemon");
    println!("Usage:");
    println!("  daemon send <FILE_PATH>       - Host and share a file");
    println!("  daemon receive <FILE_ID> <OUT_PATH> - Retrieve a shared file (supports resume)");
    println!("\nEnvironment variables (optional):");
    println!("  SIGNALING_URL - Default: ws://127.0.0.1:5000");
    println!("  API_URL       - Default: http://127.0.0.1:5000");
}

// --- SENDER CORE FLOW ---
async fn run_sender(file_path_str: &str, signaling_url: &str, api_url: &str) -> Result<()> {
    let path = Path::new(file_path_str);
    if !path.exists() {
        return Err(anyhow!("File does not exist: {}", file_path_str));
    }
    
    let file_name = path
        .file_name()
        .ok_or_else(|| anyhow!("Invalid file path"))?
        .to_string_lossy()
        .into_owned();
        
    let file_size = path.metadata()?.len();
    let sender_id = format!("sender-{}", Uuid::new_v4().to_string().chars().take(8).collect::<String>());

    println!("Registering file: {} ({} bytes)...", file_name, file_size);

    // 1. HTTP API Register Metadata (Phase 1)
    let client = reqwest::Client::new();
    let res = client
        .post(format!("{}/api/files", api_url))
        .json(&serde_json::json!({
            "fileName": file_name,
            "sizeBytes": file_size,
            "senderId": sender_id,
            "autoApprove": true
        }))
        .send()
        .await?;

    if !res.status().is_success() {
        return Err(anyhow!("Failed to register file: {}", res.text().await?));
    }

    let file_reg: RegisterFileResponse = res.json().await?;
    let file_id = file_reg.file_id;

    println!("--------------------------------------------------");
    println!("File Registered Successfully!");
    println!("File ID: {}", file_id);
    println!("Share this ID to download this file.");
    println!("Waiting for receiver to connect...");
    println!("--------------------------------------------------");

    // 2. Connect WebSockets signaling client
    let (ws_stream, _) = connect_async(signaling_url).await?;
    let (mut ws_write, mut ws_read) = ws_stream.split();
    println!("Connected to signaling node.");

    // Authenticate user socket connection
    let auth_msg = WsMessage {
        msg_type: "register_user".to_string(),
        data: serde_json::to_value(RegisterUserData { user_id: sender_id.clone() })?,
    };
    ws_write.send(Message::Text(serde_json::to_string(&auth_msg)?)).await?;

    let webrtc_api = webrtc_utils::create_webrtc_api()?;
    let pc = webrtc_utils::create_peer_connection(&webrtc_api).await?;
    let file_path = path.to_owned();

    // 3. Create WebRTC Data Channel (SCTP transport stream)
    let data_channel_config = RTCDataChannelInit {
        ordered: Some(true), // Enforce packets in-order reassembly
        ..Default::default()
    };
    let data_channel = pc.create_data_channel("file-transfer", Some(data_channel_config)).await?;
    let dc_clone = Arc::clone(&data_channel);

    setup_sender_data_channel(dc_clone, file_path, file_size).await;

    // 4. WebSocket Orchestrator listener loop
    let pc_offer_clone = Arc::clone(&pc);
    let file_id_clone = file_id.clone();

    let ws_sender_loop = async move {
        let mut ws_write = ws_write;
        while let Some(msg_res) = ws_read.next().await {
            let msg = match msg_res {
                Ok(Message::Text(t)) => t,
                Ok(_) => continue,
                Err(e) => {
                    println!("WebSocket Error: {}", e);
                    break;
                }
            };

            let parsed: WsMessage = match serde_json::from_str(&msg) {
                Ok(p) => p,
                Err(e) => {
                    println!("Failed to parse JSON: {}, Error: {}", msg, e);
                    continue;
                }
            };

            match parsed.msg_type.as_str() {
                "new_access_request" => {
                    let req: NewAccessRequestData = serde_json::from_value(parsed.data).unwrap();
                    if req.file_id != file_id_clone {
                        continue;
                    }
                    println!("Receiver ({}) requested access. Starting WebRTC Handshake...", req.receiver_id);

                    // Send approval back via WebSocket
                    let approve_msg = WsMessage {
                        msg_type: "approve_request".to_string(),
                        data: serde_json::json!({
                            "fileId": req.file_id,
                            "receiverId": req.receiver_id
                        }),
                    };
                    if let Err(e) = ws_write.send(Message::Text(serde_json::to_string(&approve_msg).unwrap())).await {
                        println!("Failed to send approval: {}", e);
                        break;
                    }

                    // Generate local SDP Offer and wait for gather complete
                    let offer = match pc_offer_clone.create_offer(None).await {
                        Ok(o) => o,
                        Err(e) => {
                            println!("Error creating offer: {}", e);
                            break;
                        }
                    };

                    let mut gather_complete = pc_offer_clone.gathering_complete_promise().await;
                    if let Err(e) = pc_offer_clone.set_local_description(offer).await {
                        println!("Error setting local description: {}", e);
                        break;
                    }
                    
                    println!("Gathering network routing candidates...");
                    let _ = gather_complete.recv().await;
                    
                    let local_desc = pc_offer_clone.local_description().await.unwrap();

                    // Send SDP Offer message to receiver
                    let offer_msg = WsMessage {
                        msg_type: "send_offer".to_string(),
                        data: serde_json::to_value(OfferMessageData {
                            to_user_id: req.receiver_id.clone(),
                            offer: local_desc.sdp,
                        }).unwrap(),
                    };
                    if let Err(e) = ws_write.send(Message::Text(serde_json::to_string(&offer_msg).unwrap())).await {
                        println!("Failed to send WebRTC Offer: {}", e);
                        break;
                    }
                    println!("WebRTC SDP Offer sent to receiver.");
                }

                "receive_answer" => {
                    let ans: ReceiveAnswerMessageData = serde_json::from_value(parsed.data).unwrap();
                    println!("WebRTC SDP Answer received. Establishing P2P link...");
                    
                    let sdp: RTCSessionDescription = serde_json::from_str(&serde_json::json!({
                        "type": "answer",
                        "sdp": ans.answer
                    }).to_string()).map_err(|e| anyhow!("Failed to deserialize Answer SDP: {}", e))?;
                    
                    if let Err(e) = pc_offer_clone.set_remote_description(sdp).await {
                        println!("Error setting remote description: {}", e);
                        break;
                    }
                    println!("P2P Handshake finalized. Connection active.");
                }

                _ => {}
            }
        }
        Ok::<(), anyhow::Error>(())
    };

    ws_sender_loop.await?;
    Ok(())
}

async fn setup_sender_data_channel(data_channel: Arc<RTCDataChannel>, file_path: PathBuf, file_size: u64) {
    let dc_open_clone = Arc::clone(&data_channel);
    let transfer_state = Arc::new(Mutex::new(false));

    data_channel.on_open(Box::new(move || {
        println!("WebRTC Data Channel OPEN! Ready for transfer.");
        let dc = Arc::clone(&dc_open_clone);
        let path = file_path.clone();
        let state = Arc::clone(&transfer_state);
        
        Box::pin(async move {
            let dc_msg_clone = Arc::clone(&dc);
            let state_msg_clone = Arc::clone(&state);
            
            dc.on_message(Box::new(move |msg: ::webrtc::data_channel::data_channel_message::DataChannelMessage| {
                let dc_run = Arc::clone(&dc_msg_clone);
                let path_run = path.clone();
                let state_run = Arc::clone(&state_msg_clone);
                let data_str = String::from_utf8_lossy(&msg.data).into_owned();

                Box::pin(async move {
                    // Check if receiver requested starting offset (resumability link configuration)
                    if let Ok(header) = serde_json::from_str::<TransferHeader>(&data_str) {
                        let mut started = state_run.lock().await;
                        if *started {
                            return;
                        }
                        *started = true;
                        
                        println!("Receiver requested offset stream start: {} bytes.", header.offset);
                        
                        // Spawn background worker to stream file bytes
                        tokio::spawn(async move {
                            if let Err(e) = transfer::stream_file_to_peer(dc_run, &path_run, header.offset, file_size).await {
                                println!("Error streaming file: {}", e);
                            }
                        });
                    }
                })
            }));
        })
    }));
}

// --- RECEIVER CORE FLOW ---
async fn run_receiver(file_id: &str, output_path_str: &str, signaling_url: &str, api_url: &str) -> Result<()> {
    let receiver_id = format!("receiver-{}", Uuid::new_v4().to_string().chars().take(8).collect::<String>());

    // 1. HTTP API Fetch Metadata (Phase 2)
    let client = reqwest::Client::new();
    let res = client
        .get(format!("{}/api/files/{}", api_url, file_id))
        .send()
        .await?;

    if !res.status().is_success() {
        return Err(anyhow!("Failed to retrieve file metadata."));
    }

    let meta: FileMetadataResponse = res.json().await?;
    println!("--------------------------------------------------");
    println!("File Found: {}", meta.file_name);
    println!("Size: {} bytes", meta.size_bytes);
    println!("Sender ID: {}", meta.sender_id);
    println!("--------------------------------------------------");

    // RESUMABILITY SEEK CHECK: Detect incomplete local target file on disk
    let out_path = Path::new(output_path_str);
    let mut initial_offset = 0u64;

    if out_path.exists() {
        let existing_size = out_path.metadata()?.len();
        if existing_size < meta.size_bytes {
            initial_offset = existing_size;
            println!("Partial file found. Resuming from byte position: {}.", initial_offset);
        } else {
            println!("File already complete on local target path.");
            return Ok(());
        }
    }

    let file = OpenOptions::new()
        .create(true)
        .write(true)
        .append(true)
        .open(out_path)
        .await?;

    let shared_file = Arc::new(Mutex::new(file));

    // 2. Connect to the websocket node
    let (ws_stream, _) = connect_async(signaling_url).await?;
    let (mut ws_write, mut ws_read) = ws_stream.split();
    println!("Connected to signaling node.");

    // Authenticate
    let auth_msg = WsMessage {
        msg_type: "register_user".to_string(),
        data: serde_json::to_value(RegisterUserData { user_id: receiver_id.clone() })?,
    };
    ws_write.send(Message::Text(serde_json::to_string(&auth_msg)?)).await?;

    // Request Access (triggers notify to sender if online)
    let req_msg = WsMessage {
        msg_type: "request_access".to_string(),
        data: serde_json::to_value(RequestAccessData {
            file_id: file_id.to_string(),
            receiver_id: receiver_id.clone(),
        })?,
    };
    ws_write.send(Message::Text(serde_json::to_string(&req_msg)?)).await?;

    let webrtc_api = webrtc_utils::create_webrtc_api()?;
    let pc = webrtc_utils::create_peer_connection(&webrtc_api).await?;
    
    let pc_offer_clone = Arc::clone(&pc);
    let receiver_id_clone = receiver_id.clone();
    let sender_id_state = Arc::new(Mutex::new(meta.sender_id.clone()));

    // 3. Set up Remote Data Channel Event Listener
    let file_clone = Arc::clone(&shared_file);
    let total_size = meta.size_bytes;
    let file_id_dc_clone = file_id.to_string();
    
    setup_receiver_data_channel(
        Arc::clone(&pc),
        file_clone,
        initial_offset,
        total_size,
        file_id_dc_clone,
        receiver_id_clone.clone(),
        signaling_url.to_string(),
    ).await;

    // 4. WebSocket Message Loop
    let ws_receiver_loop = async move {
        let mut ws_write = ws_write;
        while let Some(msg_res) = ws_read.next().await {
            let msg = match msg_res {
                Ok(Message::Text(t)) => t,
                Ok(_) => continue,
                Err(e) => {
                    println!("WebSocket Error: {}", e);
                    break;
                }
            };

            let parsed: WsMessage = match serde_json::from_str(&msg) {
                Ok(p) => p,
                Err(e) => {
                    println!("Failed to parse JSON: {}", e);
                    continue;
                }
            };

            match parsed.msg_type.as_str() {
                "request_status_update" => {
                    let update: RequestStatusUpdateData = serde_json::from_value(parsed.data).unwrap();
                    println!("Request State: {}", update.status);
                    if update.status == "APPROVED" {
                        println!("Request approved. Awaiting WebRTC SDP Offer...");
                        if let Some(s_id) = update.sender_id {
                            *sender_id_state.lock().await = s_id;
                        }
                    }
                }

                "receive_offer" => {
                    let offer_data: ReceiveOfferMessageData = serde_json::from_value(parsed.data).unwrap();
                    println!("SDP Offer received. Finalising handshake Answer...");

                    let sdp: RTCSessionDescription = serde_json::from_str(&serde_json::json!({
                        "type": "offer",
                        "sdp": offer_data.offer
                    }).to_string()).map_err(|e| anyhow!("Failed to deserialize Offer SDP: {}", e))?;

                    if let Err(e) = pc_offer_clone.set_remote_description(sdp).await {
                        println!("Error setting remote description: {}", e);
                        break;
                    }

                    // Create Local SDP Answer
                    let answer = match pc_offer_clone.create_answer(None).await {
                        Ok(a) => a,
                        Err(e) => {
                            println!("Error creating answer: {}", e);
                            break;
                        }
                    };

                    let mut gather_complete = pc_offer_clone.gathering_complete_promise().await;
                    if let Err(e) = pc_offer_clone.set_local_description(answer).await {
                        println!("Error setting local description: {}", e);
                        break;
                    }

                    println!("Gathering local candidates...");
                    let _ = gather_complete.recv().await;

                    let local_desc = pc_offer_clone.local_description().await.unwrap();

                    // Send Answer SDP back to sender
                    let target_sender = sender_id_state.lock().await.clone();
                    let answer_msg = WsMessage {
                        msg_type: "send_answer".to_string(),
                        data: serde_json::to_value(AnswerMessageData {
                            to_user_id: target_sender,
                            answer: local_desc.sdp,
                        }).unwrap(),
                    };

                    if let Err(e) = ws_write.send(Message::Text(serde_json::to_string(&answer_msg).unwrap())).await {
                        println!("Failed to send WebRTC Answer: {}", e);
                        break;
                    }
                    println!("WebRTC SDP Answer sent. Handshake completed.");
                }

                _ => {}
            }
        }
        Ok::<(), anyhow::Error>(())
    };

    ws_receiver_loop.await?;
    Ok(())
}

async fn setup_receiver_data_channel(
    pc: Arc<RTCPeerConnection>,
    file: Arc<Mutex<tokio::fs::File>>,
    offset: u64,
    total_size: u64,
    file_id: String,
    receiver_id: String,
    signaling_url: String,
) {
    pc.on_data_channel(Box::new(move |d: Arc<RTCDataChannel>| {
        let file = Arc::clone(&file);
        let file_id = file_id.clone();
        let receiver_id = receiver_id.clone();
        let sig_url = signaling_url.clone();
        println!("Data Channel established by sender: '{}'", d.label());

        Box::pin(async move {
            let d_clone = Arc::clone(&d);
            
            d.on_open(Box::new(move || {
                println!("Data channel open. Sending offset context header...");
                let d_open = Arc::clone(&d_clone);
                Box::pin(async move {
                    // Send offset configuration frame to sender immediately on channel open
                    let header = TransferHeader { offset };
                    if let Ok(hdr_str) = serde_json::to_string(&header) {
                        let bytes = bytes::Bytes::from(hdr_str);
                        if let Err(e) = d_open.send(&bytes).await {
                            println!("Failed to send offset: {}", e);
                        }
                    }
                })
            }));

            let bytes_received = Arc::new(Mutex::new(offset));
            let start_time = std::time::Instant::now();
            let file_id_msg = file_id.clone();
            let rx_id_msg = receiver_id.clone();

            d.on_message(Box::new(move |msg: ::webrtc::data_channel::data_channel_message::DataChannelMessage| {
                let file = Arc::clone(&file);
                let bytes_rec = Arc::clone(&bytes_received);
                let f_id = file_id_msg.clone();
                let r_id = rx_id_msg.clone();
                let sig_url_inner = sig_url.clone();

                Box::pin(async move {
                    let mut file_guard = file.lock().await;
                    if let Err(e) = file_guard.write_all(&msg.data).await {
                        println!("Failed to write chunk: {}", e);
                        return;
                    }

                    let mut bytes_guard = bytes_rec.lock().await;
                    *bytes_guard += msg.data.len() as u64;

                    // Progress metrics display
                    let pct = (*bytes_guard as f64 / total_size as f64) * 100.0;
                    let speed = (*bytes_guard - offset) as f64 / start_time.elapsed().as_secs_f64() / 1024.0 / 1024.0;
                    print!("\rReceiving: {:.2}% ({}/{}) | {:.2} MB/s", pct, *bytes_guard, total_size, speed);
                    let _ = std::io::Write::flush(&mut std::io::stdout());

                    if *bytes_guard >= total_size {
                        println!("\nFile download completed successfully!");
                        // Notify signaling server
                        tokio::spawn(async move {
                            if let Ok((ws_stream, _)) = connect_async(&sig_url_inner).await {
                                let (mut write, _) = ws_stream.split();
                                let comp_msg = WsMessage {
                                    msg_type: "transfer_completed".to_string(),
                                    data: serde_json::to_value(types::TransferCompletedData {
                                        file_id: f_id,
                                        receiver_id: r_id,
                                    }).unwrap(),
                                };
                                let _ = write.send(Message::Text(serde_json::to_string(&comp_msg).unwrap())).await;
                            }
                            sleep(Duration::from_millis(500)).await;
                            std::process::exit(0);
                        });
                    }
                })
            }));
        })
    }));
}
