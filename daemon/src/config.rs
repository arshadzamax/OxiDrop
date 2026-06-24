// Configuration Constants for OxiDrop client daemon

// CHUNK_SIZE: Optimal WebRTC Data Channel payload size is 64KB.
// Larger chunks trigger IP fragmentation issues over UDP; smaller chunks increase wrapper overhead.
pub const CHUNK_SIZE: usize = 65536; 

// BUFFER_HIGH_WATERMARK: Pause reading from disk when SCTP outbound queue exceeds 1MB.
// Prevents flooding system memory when sender upload speed is higher than receiver download speed.
pub const BUFFER_HIGH_WATERMARK: usize = 1_048_576; 

// Default STUN servers for NAT Traversal discovery
pub const STUN_SERVER: &str = "stun:stun.l.google.com:19302";
