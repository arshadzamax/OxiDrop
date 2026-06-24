use serde::{Deserialize, Serialize};

// --- WebSockets Messaging Protocol Models ---

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct WsMessage {
    #[serde(rename = "type")]
    pub msg_type: String,
    pub data: serde_json::Value,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RegisterUserData {
    #[serde(rename = "userId")]
    pub user_id: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RequestAccessData {
    #[serde(rename = "fileId")]
    pub file_id: String,
    #[serde(rename = "receiverId")]
    pub receiver_id: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RequestStatusUpdateData {
    #[serde(rename = "fileId")]
    pub file_id: String,
    pub status: String,
    #[serde(rename = "senderId")]
    pub sender_id: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct NewAccessRequestData {
    #[serde(rename = "requestId")]
    pub request_id: String,
    #[serde(rename = "fileId")]
    pub file_id: String,
    #[serde(rename = "fileName")]
    pub file_name: String,
    #[serde(rename = "sizeBytes")]
    pub size_bytes: u64,
    #[serde(rename = "receiverId")]
    pub receiver_id: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct OfferMessageData {
    #[serde(rename = "toUserId")]
    pub to_user_id: String,
    pub offer: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ReceiveOfferMessageData {
    #[serde(rename = "fromUserId")]
    pub from_user_id: String,
    pub offer: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AnswerMessageData {
    #[serde(rename = "toUserId")]
    pub to_user_id: String,
    pub answer: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ReceiveAnswerMessageData {
    #[serde(rename = "fromUserId")]
    pub from_user_id: String,
    pub answer: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TransferCompletedData {
    #[serde(rename = "fileId")]
    pub file_id: String,
    #[serde(rename = "receiverId")]
    pub receiver_id: String,
}

// --- HTTP API Models ---

#[derive(Deserialize, Debug)]
pub struct RegisterFileResponse {
    #[serde(rename = "fileId")]
    pub file_id: String,
}

#[allow(dead_code)]
#[derive(Deserialize, Debug)]
pub struct FileMetadataResponse {
    #[serde(rename = "fileId")]
    pub file_id: String,
    #[serde(rename = "fileName")]
    pub file_name: String,
    #[serde(rename = "sizeBytes")]
    pub size_bytes: u64,
    #[serde(rename = "senderId")]
    pub sender_id: String,
}

// --- P2P WebRTC Data Channel Control Frame ---

#[derive(Serialize, Deserialize, Debug)]
pub struct TransferHeader {
    pub offset: u64,
}
