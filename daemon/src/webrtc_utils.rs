use anyhow::Result;
use std::sync::Arc;
use ::webrtc::api::media_engine::MediaEngine;
use ::webrtc::api::APIBuilder;
use ::webrtc::ice_transport::ice_server::RTCIceServer;
use ::webrtc::peer_connection::configuration::RTCConfiguration;
use ::webrtc::peer_connection::peer_connection_state::RTCPeerConnectionState;
use ::webrtc::peer_connection::RTCPeerConnection;

use crate::config::STUN_SERVER;

// Creates WebRTC API stack with default media codecs and interceptor logic
pub fn create_webrtc_api() -> Result<::webrtc::api::API> {
    let mut media_engine = MediaEngine::default();
    media_engine.register_default_codecs()?; // Setup standard formats (VP8, H264, Opus)
    
    let mut registry = ::webrtc::interceptor::registry::Registry::new();
    registry = ::webrtc::api::interceptor_registry::register_default_interceptors(registry, &mut media_engine)?;
    
    let api = APIBuilder::new()
        .with_media_engine(media_engine)
        .with_interceptor_registry(registry)
        .build();
        
    Ok(api)
}

// Configures a new WebRTC Peer Connection mapping to STUN server for NAT discovery
pub async fn create_peer_connection(api: &::webrtc::api::API) -> Result<Arc<RTCPeerConnection>> {
    let config = RTCConfiguration {
        ice_servers: vec![RTCIceServer {
            urls: vec![STUN_SERVER.to_string()],
            ..Default::default()
        }],
        ..Default::default()
    };
    
    let pc = api.new_peer_connection(config).await?;
    let pc = Arc::new(pc);
    
    // Listen to connection shifts
    pc.on_peer_connection_state_change(Box::new(|state: RTCPeerConnectionState| {
        println!("WebRTC Link State Change: {}", state);
        Box::pin(async {})
    }));
    
    Ok(pc)
}
