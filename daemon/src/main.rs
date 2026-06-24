use anyhow::{anyhow, Result};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::env;
use std::io::SeekFrom;
use std::path::Path;
use std::sync::Arc;
use tokio::fs::{File, OpenOptions};
use tokio::io::{AsyncReadExt, AsyncSeekExt, AsyncWriteExt};
use tokio::sync::Mutex;
use tokio::time::{sleep, Duration};
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
use uuid::Uuid;

use webrtc::api::media_engine::MediaEngine;
use webrtc::api::APIBuilder;
use webrtc::data_channel::data_channel_init::RTCDataChannelInit;
use webrtc::data_channel::RTCDataChannel;
use webrtc::ice_transport::ice_server::RTCIceServer;
use webrtc::peer_connection::configuration::RTCConfiguration;
use webrtc::peer_connection::peer_connection_state::RTCPeerConnectionState;
use webrtc::peer_connection::sdp::session_description::RTCSessionDescription;
use webrtc::peer_connection::RTCPeerConnection;

// --- Data Types for Signaling (JSON messages) ---
#[derive(Serialize, Deserialize, Debug, Clone)]
struct WsMessage {
    #[serde(rename = "type")]
    msg_type: String,
    data: serde_json::Value,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct RegisterUserData {
    #[serde(rename = "userId")]
    user_id: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct RequestAccessData {
    #[serde(rename = "fileId")]
    file_id: String,
    #[serde(rename = "receiverId")]
    receiver_id: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct RequestStatusUpdateData {
    #[serde(rename = "fileId")]
    file_id: String,
    status: String,
    #[serde(rename = "senderId")]
    sender_id: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct NewAccessRequestData {
    #[serde(rename = "requestId")]
    request_id: String,
    #[serde(rename = "fileId")]
    file_id: String,
    #[serde(rename = "fileName")]
    file_name: String,
    #[serde(rename = "sizeBytes")]
    size_bytes: u64,
    #[serde(rename = "receiverId")]
    receiver_id: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct OfferMessageData {
    #[serde(rename = "toUserId")]
    to_user_id: String,
    offer: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct ReceiveOfferMessageData {
    #[serde(rename = "fromUserId")]
    from_user_id: String,
    offer: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct AnswerMessageData {
    #[serde(rename = "toUserId")]
    to_user_id: String,
    answer: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct ReceiveAnswerMessageData {
    #[serde(rename = "fromUserId")]
    from_user_id: String,
    answer: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct TransferCompletedData {
    #[serde(rename = "fileId")]
    file_id: String,
    #[serde(rename = "receiverId")]
    receiver_id: String,
}

// Struct to represent a registered file returned from the HTTP API
#[derive(Deserialize, Debug)]
struct RegisterFileResponse {
    #[serde(rename = "fileId")]
    file_id: String,
}

#[allow(dead_code)]
#[derive(Deserialize, Debug)]
struct FileMetadataResponse {
    #[serde(rename = "fileId")]
    file_id: String,
    #[serde(rename = "fileName")]
    file_name: String,
    #[serde(rename = "sizeBytes")]
    size_bytes: u64,
    #[serde(rename = "senderId")]
    sender_id: String,
}

// Data channel payload representation for resumability exchange
#[derive(Serialize, Deserialize, Debug)]
struct TransferHeader {
    offset: u64,
}

// Configuration Constants
const CHUNK_SIZE: usize = 65536; // 64KB - WebRTC Data Channel optimal packet size
const BUFFER_HIGH_WATERMARK: usize = 1_048_576; // 1MB - Pause sending when queue exceeds this to prevent flooding RAM/SCTP

// --- HELPER FUNCTIONS ---

// Configures standard WebRTC API instance
fn create_webrtc_api() -> Result<webrtc::api::API> {
    let mut media_engine = MediaEngine::default();
    media_engine.register_default_codecs()?; // Setup standard system codecs (VP8, VP9, H264, Opus)
    
    // We register default interceptors (RTCP, NACK, Bandwidth Estimation) to ensure reliable SCTP transfers
    let mut registry = webrtc::interceptor::registry::Registry::new();
    registry = webrtc::api::interceptor_registry::register_default_interceptors(registry, &mut media_engine)?;
    
    let api = APIBuilder::new()
        .with_media_engine(media_engine)
        .with_interceptor_registry(registry)
        .build();
        
    Ok(api)
}

// Configures PeerConnection with default STUN server
async fn create_peer_connection(api: &webrtc::api::API) -> Result<Arc<RTCPeerConnection>> {
    let config = RTCConfiguration {
        // CONCEPT: STUN servers help peers discover their public-facing IP and Port 
        // to traverse NAT firewalls. We route traffic directly, fall back to TURN if direct path fails.
        ice_servers: vec![RTCIceServer {
            urls: vec!["stun:stun.l.google.com:19302".to_string()],
            ..Default::default()
        }],
        ..Default::default()
    };
    
    let pc = api.new_peer_connection(config).await?;
    let pc = Arc::new(pc);
    
    // Log state changes to help debug P2P connections
    pc.on_peer_connection_state_change(Box::new(|state: RTCPeerConnectionState| {
        println!("WebRTC Connection State: {}", state);
        Box::pin(async {})
    }));
    
    Ok(pc)
}

// --- MAIN CLI ENTRYPOINT ---
#[tokio::main]
async fn main() -> Result<()> {
    // Basic argument parsing
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

// --- SENDER FLOW ---
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

    // 1. Register File metadata with signaling server via HTTP API (Phase 1)
    let client = reqwest::Client::new();
    let res = client
        .post(format!("{}/api/files", api_url))
        .json(&serde_json::json!({
            "fileName": file_name,
            "sizeBytes": file_size,
            "senderId": sender_id,
            "autoApprove": true // Set to true so receivers get immediate approvals
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
    println!("Share this ID with the receiver to start transfer.");
    println!("Waiting for receiver to connect...");
    println!("--------------------------------------------------");

    // 2. Connect to the signaling server via WebSocket
    let (ws_stream, _) = connect_async(signaling_url).await?;
    let (mut ws_write, mut ws_read) = ws_stream.split();
    println!("Connected to signaling server.");

    // Authenticate/register this daemon as the active socket for sender_id
    let auth_msg = WsMessage {
        msg_type: "register_user".to_string(),
        data: serde_json::to_value(RegisterUserData { user_id: sender_id.clone() })?,
    };
    ws_write.send(Message::Text(serde_json::to_string(&auth_msg)?)).await?;

    // Maintain references to WebRTC states
    let webrtc_api = create_webrtc_api()?;
    let pc = create_peer_connection(&webrtc_api).await?;
    let file_path = path.to_owned();

    // 3. Create WebRTC Data Channel (WebRTC Data channels are SCTP protocol over DTLS/UDP)
    let data_channel_config = RTCDataChannelInit {
        ordered: Some(true), // Ensure packets arrive in correct order for file reassembly
        ..Default::default()
    };
    let data_channel = pc.create_data_channel("file-transfer", Some(data_channel_config)).await?;
    let dc_clone = Arc::clone(&data_channel);

    // Setup Data Channel event handlers
    setup_sender_data_channel(dc_clone, file_path, file_size).await;

    // 4. WebSocket Message Loop
    let pc_offer_clone = Arc::clone(&pc);
    let file_id_clone = file_id.clone();

    let ws_sender_loop = async move {
        let mut ws_write = ws_write; // Take ownership
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
                    println!("Failed to parse message: {}, Error: {}", msg, e);
                    continue;
                }
            };

            match parsed.msg_type.as_str() {
                // When receiver requests file, signaling triggers handshake by notifying sender
                "new_access_request" => {
                    let req: NewAccessRequestData = serde_json::from_value(parsed.data).unwrap();
                    if req.file_id != file_id_clone {
                        continue;
                    }
                    println!("Receiver ({}) requested access. Starting WebRTC Handshake...", req.receiver_id);

                    // Auto approve request (socket confirmation to signaling server)
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

                    // --- GENERATE SDP OFFER ---
                    // CONCEPT: Offer defines our WebRTC configuration parameters.
                    // We generate SDP, wait for all local ICE Candidates to gather, then send it.
                    let offer = match pc_offer_clone.create_offer(None).await {
                        Ok(o) => o,
                        Err(e) => {
                            println!("Error creating offer: {}", e);
                            break;
                        }
                    };

                    // Gather all candidates completely (Vanilla ICE)
                    let mut gather_complete = pc_offer_clone.gathering_complete_promise().await;
                    if let Err(e) = pc_offer_clone.set_local_description(offer).await {
                        println!("Error setting local description: {}", e);
                        break;
                    }
                    
                    println!("Gathering network routing candidates (STUN)...");
                    let _ = gather_complete.recv().await; // Blocks until ICE gathering completes
                    
                    let local_desc = pc_offer_clone.local_description().await.unwrap();

                    // Send complete SDP offer to signaling to forward to receiver
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

                // Handle Answer SDP returned by the receiver
                "receive_answer" => {
                    let ans: ReceiveAnswerMessageData = serde_json::from_value(parsed.data).unwrap();
                    println!("WebRTC SDP Answer received. finalising peer handshake...");
                    
                    let sdp: RTCSessionDescription = serde_json::from_str(&serde_json::json!({
                        "type": "answer",
                        "sdp": ans.answer
                    }).to_string()).map_err(|e| anyhow!("Failed to deserialize Answer SDP: {}", e))?;
                    
                    if let Err(e) = pc_offer_clone.set_remote_description(sdp).await {
                        println!("Error setting remote description: {}", e);
                        break;
                    }
                    println!("Direct WebRTC connection establishing. Data plane opening...");
                }

                _ => {}
            }
        }
        Ok::<(), anyhow::Error>(())
    };

    ws_sender_loop.await?;
    Ok(())
}

async fn setup_sender_data_channel(data_channel: Arc<RTCDataChannel>, file_path: std::path::PathBuf, file_size: u64) {
    let dc_open_clone = Arc::clone(&data_channel);
    
    // We wrap our state in Mutex to make it thread-safe for WebRTC callback execution
    let transfer_state = Arc::new(Mutex::new(false)); 

    data_channel.on_open(Box::new(move || {
        println!("WebRTC Data Channel OPENED! Starting peer communication.");
        let dc = Arc::clone(&dc_open_clone);
        let path = file_path.clone();
        let state = Arc::clone(&transfer_state);
        
        Box::pin(async move {
            // Register message callback to receive transfer configuration header (offset)
            let dc_msg_clone = Arc::clone(&dc);
            let state_msg_clone = Arc::clone(&state);
            
            dc.on_message(Box::new(move |msg: webrtc::data_channel::data_channel_message::DataChannelMessage| {
                let dc_run = Arc::clone(&dc_msg_clone);
                let path_run = path.clone();
                let state_run = Arc::clone(&state_msg_clone);
                let data_str = String::from_utf8_lossy(&msg.data).into_owned();

                Box::pin(async move {
                    // Check if receiver sent the offset configuration header
                    if let Ok(header) = serde_json::from_str::<TransferHeader>(&data_str) {
                        let mut started = state_run.lock().await;
                        if *started {
                            return; // Avoid double stream spawning
                        }
                        *started = true;
                        
                        println!("Receiver requested stream start offset: {} bytes.", header.offset);
                        
                        // Spawn task to handle file reading & streaming
                        tokio::spawn(async move {
                            if let Err(e) = stream_file_to_peer(dc_run, &path_run, header.offset, file_size).await {
                                println!("Error streaming file: {}", e);
                            }
                        });
                    }
                })
            }));
        })
    }));
}

// File streaming loop with backpressure handling
async fn stream_file_to_peer(dc: Arc<RTCDataChannel>, path: &Path, offset: u64, total_size: u64) -> Result<()> {
    let mut file = File::open(path).await?;
    
    // RESUMABILITY SEEK: Seek to requested offset before reading (supports resume at interrupted byte)
    if offset > 0 {
        file.seek(SeekFrom::Start(offset)).await?;
        println!("Seeked local file stream to byte position: {}", offset);
    }

    let mut buffer = vec![0u8; CHUNK_SIZE];
    let mut total_sent = offset;
    let start_time = std::time::Instant::now();

    println!("Streaming file data directly to peer...");
    loop {
        let bytes_read = file.read(&mut buffer).await?;
        if bytes_read == 0 {
            break; // End of file
        }

        let chunk = &buffer[..bytes_read];

        // --- BACKPRESSURE FLOW CONTROL ---
        // CONCEPT: WebRTC data channels have limited internal socket buffers.
        // If we write faster than the link capacity, packets will dump or block memory.
        // We poll `buffered_amount()` and sleep if it overflows our high watermark.
        while dc.buffered_amount().await > BUFFER_HIGH_WATERMARK {
            sleep(Duration::from_millis(15)).await;
        }

        // Send chunk over the direct SCTP link
        let bytes_data = bytes::Bytes::copy_from_slice(chunk);
        dc.send(&bytes_data).await?;

        total_sent += bytes_read as u64;

        // Print progress
        let pct = (total_sent as f64 / total_size as f64) * 100.0;
        let speed = (total_sent - offset) as f64 / start_time.elapsed().as_secs_f64() / 1024.0 / 1024.0;
        print!("\rSending: {:.2}% ({}/{}) | {:.2} MB/s", pct, total_sent, total_size, speed);
        std::io::Write::flush(&mut std::io::stdout())?;
    }

    println!("\nFile streaming completed successfully!");
    Ok(())
}

// --- RECEIVER FLOW ---
async fn run_receiver(file_id: &str, output_path_str: &str, signaling_url: &str, api_url: &str) -> Result<()> {
    let receiver_id = format!("receiver-{}", Uuid::new_v4().to_string().chars().take(8).collect::<String>());

    // 1. Query file metadata from API (Phase 2)
    let client = reqwest::Client::new();
    let res = client
        .get(format!("{}/api/files/{}", api_url, file_id))
        .send()
        .await?;

    if !res.status().is_success() {
        return Err(anyhow!("Failed to retrieve file metadata: Check File ID."));
    }

    let meta: FileMetadataResponse = res.json().await?;
    println!("--------------------------------------------------");
    println!("File Found: {}", meta.file_name);
    println!("Size: {} bytes", meta.size_bytes);
    println!("Sender ID: {}", meta.sender_id);
    println!("--------------------------------------------------");

    // RESUMABILITY CHECK: Check if we have an incomplete local file we can resume
    let out_path = Path::new(output_path_str);
    let mut initial_offset = 0u64;

    if out_path.exists() {
        let existing_size = out_path.metadata()?.len();
        if existing_size < meta.size_bytes {
            initial_offset = existing_size;
            println!("Incomplete download found! Resuming from offset: {} bytes.", initial_offset);
        } else {
            println!("File already exists on destination and is fully complete.");
            return Ok(());
        }
    }

    // Open file in write/append mode
    let file = OpenOptions::new()
        .create(true)
        .write(true)
        .append(true)
        .open(out_path)
        .await?;

    let shared_file = Arc::new(Mutex::new(file));

    // 2. Connect to the signaling server
    let (ws_stream, _) = connect_async(signaling_url).await?;
    let (mut ws_write, mut ws_read) = ws_stream.split();
    println!("Connected to signaling server.");

    // Authenticate
    let auth_msg = WsMessage {
        msg_type: "register_user".to_string(),
        data: serde_json::to_value(RegisterUserData { user_id: receiver_id.clone() })?,
    };
    ws_write.send(Message::Text(serde_json::to_string(&auth_msg)?)).await?;

    // Emit request access (triggers pending state or approval redirect)
    let req_msg = WsMessage {
        msg_type: "request_access".to_string(),
        data: serde_json::to_value(RequestAccessData {
            file_id: file_id.to_string(),
            receiver_id: receiver_id.clone(),
        })?,
    };
    ws_write.send(Message::Text(serde_json::to_string(&req_msg)?)).await?;

    let webrtc_api = create_webrtc_api()?;
    let pc = create_peer_connection(&webrtc_api).await?;
    
    // Set up remote SDP listener on the PeerConnection
    let pc_offer_clone = Arc::clone(&pc);
    let receiver_id_clone = receiver_id.clone();
    let sender_id_state = Arc::new(Mutex::new(meta.sender_id.clone()));

    // 3. Setup Receive Data Channel Listener
    let file_clone = Arc::clone(&shared_file);
    let total_size = meta.size_bytes;
    let file_id_dc_clone = file_id.to_string();
    
    setup_receiver_data_channel(Arc::clone(&pc), file_clone, initial_offset, total_size, file_id_dc_clone, receiver_id_clone.clone(), signaling_url.to_string()).await;

    // 4. WebSocket Message Loop for Receiver
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
                    println!("Request Status: {}", update.status);
                    if update.status == "APPROVED" {
                        println!("Request approved! Waiting for sender to initiate WebRTC SDP Offer...");
                        if let Some(s_id) = update.sender_id {
                            *sender_id_state.lock().await = s_id;
                        }
                    }
                }

                // Handle incoming SDP offer from Sender
                "receive_offer" => {
                    let offer_data: ReceiveOfferMessageData = serde_json::from_value(parsed.data).unwrap();
                    println!("SDP Offer received. Setting remote description & generating answer...");

                    let sdp: RTCSessionDescription = serde_json::from_str(&serde_json::json!({
                        "type": "offer",
                        "sdp": offer_data.offer
                    }).to_string()).map_err(|e| anyhow!("Failed to deserialize Offer SDP: {}", e))?;

                    if let Err(e) = pc_offer_clone.set_remote_description(sdp).await {
                        println!("Error setting remote description: {}", e);
                        break;
                    }

                    // --- GENERATE SDP ANSWER ---
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

                    println!("Gathering local network routing configurations...");
                    let _ = gather_complete.recv().await; // Blocks until ICE complete

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
                    println!("WebRTC SDP Answer sent. handshaking finished!");
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
    file: Arc<Mutex<File>>,
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
                println!("Data channel is fully open. Exchanging stream configuration...");
                let d_open = Arc::clone(&d_clone);
                Box::pin(async move {
                    // Send initial offset (resumability request) as first message on open
                    let header = TransferHeader { offset };
                    if let Ok(hdr_str) = serde_json::to_string(&header) {
                        let bytes = bytes::Bytes::from(hdr_str);
                        if let Err(e) = d_open.send(&bytes).await {
                            println!("Failed to send transfer header: {}", e);
                        }
                    }
                })
            }));

            let bytes_received = Arc::new(Mutex::new(offset));
            let start_time = std::time::Instant::now();
            let file_id_msg = file_id.clone();
            let rx_id_msg = receiver_id.clone();

            d.on_message(Box::new(move |msg: webrtc::data_channel::data_channel_message::DataChannelMessage| {
                let file = Arc::clone(&file);
                let bytes_rec = Arc::clone(&bytes_received);
                let f_id = file_id_msg.clone();
                let r_id = rx_id_msg.clone();
                let sig_url_inner = sig_url.clone();

                Box::pin(async move {
                    let mut file_guard = file.lock().await;
                    if let Err(e) = file_guard.write_all(&msg.data).await {
                        println!("Failed to write chunk to disk: {}", e);
                        return;
                    }

                    let mut bytes_guard = bytes_rec.lock().await;
                    *bytes_guard += msg.data.len() as u64;

                    // Print Progress
                    let pct = (*bytes_guard as f64 / total_size as f64) * 100.0;
                    let speed = (*bytes_guard - offset) as f64 / start_time.elapsed().as_secs_f64() / 1024.0 / 1024.0;
                    print!("\rReceiving: {:.2}% ({}/{}) | {:.2} MB/s", pct, *bytes_guard, total_size, speed);
                    let _ = std::io::Write::flush(&mut std::io::stdout());

                    if *bytes_guard >= total_size {
                        println!("\nFile download completed successfully!");
                        // Notify signaling server we are done
                        tokio::spawn(async move {
                            if let Ok((ws_stream, _)) = connect_async(&sig_url_inner).await {
                                let (mut write, _) = ws_stream.split();
                                let comp_msg = WsMessage {
                                    msg_type: "transfer_completed".to_string(),
                                    data: serde_json::to_value(TransferCompletedData {
                                        file_id: f_id,
                                        receiver_id: r_id,
                                    }).unwrap(),
                                };
                                let _ = write.send(Message::Text(serde_json::to_string(&comp_msg).unwrap())).await;
                            }
                            sleep(Duration::from_millis(500)).await;
                            std::process::exit(0); // Exit process upon complete
                        });
                    }
                })
            }));
        })
    }));
}
