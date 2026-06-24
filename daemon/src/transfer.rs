use anyhow::Result;
use std::io::SeekFrom;
use std::path::Path;
use std::sync::Arc;
use tokio::fs::File;
use tokio::io::{AsyncReadExt, AsyncSeekExt};
use tokio::time::{sleep, Duration};
use webrtc::data_channel::RTCDataChannel;

use crate::config::{BUFFER_HIGH_WATERMARK, CHUNK_SIZE};

// Streams local file data over P2P data channel with backpressure (flow control)
pub async fn stream_file_to_peer(
    dc: Arc<RTCDataChannel>,
    path: &Path,
    offset: u64,
    total_size: u64,
) -> Result<()> {
    let mut file = File::open(path).await?;
    
    // Seek to requested offset before starting read (enables resumability)
    if offset > 0 {
        file.seek(SeekFrom::Start(offset)).await?;
        println!("Seeked local file stream to position: {} bytes", offset);
    }

    let mut buffer = vec![0u8; CHUNK_SIZE];
    let mut total_sent = offset;
    let start_time = std::time::Instant::now();

    println!("Streaming file bytes directly to peer...");
    loop {
        let bytes_read = file.read(&mut buffer).await?;
        if bytes_read == 0 {
            break; // Finished reading file
        }

        let chunk = &buffer[..bytes_read];

        // --- BACKPRESSURE DETECTOR ---
        // If internal SCTP queue is full, pause reading from NVMe to avoid piling up RAM.
        while dc.buffered_amount().await > BUFFER_HIGH_WATERMARK {
            sleep(Duration::from_millis(15)).await;
        }

        // Write slice to P2P transport pipeline
        let bytes_data = bytes::Bytes::copy_from_slice(chunk);
        dc.send(&bytes_data).await?;

        total_sent += bytes_read as u64;

        // Print telemetry progress bar
        let pct = (total_sent as f64 / total_size as f64) * 100.0;
        let speed = (total_sent - offset) as f64 / start_time.elapsed().as_secs_f64() / 1024.0 / 1024.0;
        print!("\rSending: {:.2}% ({}/{}) | {:.2} MB/s", pct, total_sent, total_size, speed);
        let _ = std::io::Write::flush(&mut std::io::stdout());
    }

    println!("\nFile streaming completed successfully!");
    Ok(())
}
