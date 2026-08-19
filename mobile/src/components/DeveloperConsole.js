import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  StyleSheet,
  Platform,
  StatusBar as RNStatusBar
} from 'react-native';
import { Terminal, X, Trash2 } from 'lucide-react-native';

export const DeveloperConsole = ({
  visible,
  onClose,
  colors,
  socketConnected,
  roomCode,
  isHost,
  peerId,
  peerConnected,
  isUploading,
  isDownloading,
  devLogs = [],
  webrtcStats
}) => {
  const [logOffset, setLogOffset] = useState(0);

  const handleClearLogs = () => {
    setLogOffset(devLogs.length);
  };

  const visibleLogs = devLogs.slice(logOffset);

  // 6-step handshake checklist matching web DeveloperConsole
  const steps = [
    {
      label: 'Signaling WS',
      active: socketConnected,
      status: socketConnected ? 'connected' : 'disconnected'
    },
    {
      label: 'Room',
      active: !!roomCode,
      status: roomCode ? `${isHost ? 'hosting' : 'joined'}: ${roomCode}` : 'none'
    },
    {
      label: 'Peer',
      active: !!peerId,
      status: peerId ? peerId : 'waiting'
    },
    {
      label: 'WebRTC',
      active: webrtcStats && (webrtcStats.connectionState === 'connected' || peerConnected),
      status: webrtcStats?.connectionState || (peerConnected ? 'connected' : 'closed'),
      isWarning: webrtcStats && (webrtcStats.connectionState === 'connecting' || webrtcStats.connectionState === 'checking')
    },
    {
      label: 'Data Channel',
      active: peerConnected,
      status: peerConnected ? 'open' : 'closed'
    },
    {
      label: 'Transfer',
      active: isUploading || isDownloading,
      status: isUploading ? 'sending' : isDownloading ? 'receiving' : 'idle'
    }
  ];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.modalSafeArea, { backgroundColor: colors.bg }]}>
        {/* Modal Header */}
        <View style={[styles.modalHeader, { backgroundColor: colors.headerBg, borderColor: colors.inputBorder }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Terminal size={18} color="#00a2ed" style={{ marginRight: 8 }} />
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Developer Diagnostics</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Pressable hitSlop={8} onPress={handleClearLogs} title="Clear logs">
              <Trash2 size={18} color={colors.textSecondary} />
            </Pressable>
            <Pressable hitSlop={8} onPress={onClose} title="Close">
              <X size={22} color={colors.textPrimary} />
            </Pressable>
          </View>
        </View>

        <ScrollView style={{ flex: 1, padding: 14 }}>
          {/* Handshake 6-Step Checklist Card */}
          <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder, marginBottom: 12 }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>P2P Handshake Checklist</Text>
            <View style={styles.checklistGrid}>
              {steps.map((s, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.checklistItem,
                    {
                      backgroundColor: s.active ? 'rgba(16, 185, 129, 0.08)' : colors.inputBg,
                      borderColor: s.active ? 'rgba(16, 185, 129, 0.25)' : colors.inputBorder
                    }
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor: s.active ? '#10b981' : s.isWarning ? '#f59e0b' : '#64748b',
                        }
                      ]}
                    />
                    <Text style={[styles.checklistLabel, { color: colors.textPrimary }]}>{s.label}</Text>
                  </View>
                  <Text style={[styles.checklistStatus, { color: s.active ? '#10b981' : colors.textSecondary }]} numberOfLines={1}>
                    {s.status}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Console Logs */}
          <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder, marginBottom: 20 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0 }]}>Console Logs</Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>{visibleLogs.length} entries</Text>
            </View>

            {visibleLogs.length === 0 ? (
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontStyle: 'italic', paddingVertical: 8 }}>
                No logs recorded yet.
              </Text>
            ) : (
              visibleLogs.map((l, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.logEntry,
                    { borderColor: colors.inputBorder, borderBottomWidth: idx < visibleLogs.length - 1 ? 0.5 : 0 }
                  ]}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                    <Text style={{ fontSize: 10, color: colors.textSecondary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
                      [{l.time}]
                    </Text>
                    <Text style={[styles.logTypeBadge, { color: l.type === 'error' ? '#ef4444' : l.type === 'success' ? '#10b981' : l.type === 'warn' ? '#f59e0b' : '#00a2ed' }]}>
                      {l.type.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[styles.logMessage, { color: l.type === 'error' ? '#ef4444' : l.type === 'success' ? '#10b981' : colors.textPrimary }]}>
                    {l.msg}
                  </Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalSafeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 0,
  },
  modalHeader: {
    height: 52,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  checklistGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  checklistItem: {
    width: '48%',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  checklistLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  checklistStatus: {
    fontSize: 10,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  logEntry: {
    paddingVertical: 6,
  },
  logTypeBadge: {
    fontSize: 9,
    fontWeight: '700',
  },
  logMessage: {
    fontSize: 11,
    lineHeight: 16,
  },
});
