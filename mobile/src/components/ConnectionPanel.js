import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Platform } from 'react-native';
import { Wifi, WifiOff, Plus, Link, QrCode, Copy, Check, LogOut, CheckCircle2, Radio } from 'lucide-react-native';
import { copyRoomCode } from '../utils/helpers';

export const ConnectionPanel = ({
  colors,
  socketConnected,
  roomCode,
  isHost,
  peerConnected,
  peerId,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onShowQR,
  onShowQRScanner
}) => {
  const [roomInput, setRoomInput] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!roomCode) return;
    copyRoomCode(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJoin = () => {
    if (roomInput.trim()) {
      onJoinRoom(roomInput.trim());
      setRoomInput('');
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
      {/* Header */}
      <View style={[styles.cardHeader, { borderBottomColor: colors.cardBorder }]}>
        <View style={styles.headerLeft}>
          <Radio size={16} color={socketConnected ? colors.primaryBtn : colors.red} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Device Pairing</Text>
        </View>

        <View
          style={[
            styles.badge,
            {
              backgroundColor: socketConnected ? colors.greenBg : colors.redBg,
              borderColor: socketConnected ? colors.greenBorder : colors.redBorder,
            }
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              { color: socketConnected ? colors.green : colors.red }
            ]}
          >
            {socketConnected ? 'SERVER READY' : 'DISCONNECTED'}
          </Text>
        </View>
      </View>

      {/* Body */}
      <View style={styles.cardBody}>
        {!roomCode ? (
          <View style={styles.unpairedContainer}>
            {/* Create Room Button */}
            <Pressable
              style={[
                styles.primaryBtn,
                {
                  backgroundColor: colors.primaryBtn,
                  opacity: socketConnected ? 1 : 0.45,
                }
              ]}
              onPress={onCreateRoom}
              disabled={!socketConnected}
            >
              <Plus size={16} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.primaryBtnText}>Create New Room</Text>
            </Pressable>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: colors.cardBorder }]} />
              <Text style={[styles.dividerText, { color: colors.textMuted }]}>or join existing</Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.cardBorder }]} />
            </View>

            {/* Join Row */}
            <View style={styles.joinRow}>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.insetBg,
                    borderColor: colors.insetBorder,
                    color: colors.textPrimary,
                  }
                ]}
                placeholder="6-character code"
                placeholderTextColor={colors.textMuted}
                value={roomInput}
                onChangeText={setRoomInput}
                editable={socketConnected}
                autoCapitalize="characters"
                autoCorrect={false}
              />

              <Pressable
                style={[
                  styles.secondaryBtn,
                  {
                    backgroundColor: colors.secondaryBtn,
                    borderColor: colors.secondaryBtnBorder,
                  }
                ]}
                onPress={onShowQRScanner}
                disabled={!socketConnected}
              >
                <QrCode size={15} color={colors.textPrimary} style={{ marginRight: 4 }} />
                <Text style={[styles.secondaryBtnText, { color: colors.textPrimary }]}>Scan QR</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.joinBtn,
                  {
                    backgroundColor: colors.primaryBtn,
                    opacity: socketConnected && roomInput.trim() ? 1 : 0.45,
                  }
                ]}
                onPress={handleJoin}
                disabled={!socketConnected || !roomInput.trim()}
              >
                <Link size={15} color="#fff" style={{ marginRight: 4 }} />
                <Text style={styles.primaryBtnText}>Join</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.pairedContainer}>
            {/* Active Room Code Banner */}
            <View style={[styles.roomCodeBox, { backgroundColor: colors.insetBg, borderColor: colors.insetBorder }]}>
              <View style={styles.roomCodeHeader}>
                <CheckCircle2 size={13} color={colors.green} />
                <Text style={[styles.roomCodeLabel, { color: colors.green }]}>ACTIVE ROOM CODE</Text>
              </View>

              <View style={styles.roomCodeValueRow}>
                <Text style={[styles.roomCodeValue, { color: colors.primaryBtn }]}>{roomCode}</Text>

                <View style={styles.roomCodeActions}>
                  <Pressable
                    style={[styles.actionIconBtn, { backgroundColor: colors.secondaryBtn, borderColor: colors.secondaryBtnBorder }]}
                    onPress={onShowQR}
                  >
                    <QrCode size={15} color={colors.textSecondary} />
                  </Pressable>
                  <Pressable
                    style={[styles.actionIconBtn, { backgroundColor: colors.secondaryBtn, borderColor: colors.secondaryBtnBorder }]}
                    onPress={handleCopy}
                  >
                    {copied ? <Check size={15} color={colors.green} /> : <Copy size={15} color={colors.textSecondary} />}
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Connection Metadata Grid */}
            <View style={styles.metaGrid}>
              <View style={[styles.metaTile, { backgroundColor: colors.insetBg, borderColor: colors.insetBorder }]}>
                <Text style={[styles.metaKey, { color: colors.textMuted }]}>ROLE</Text>
                <Text style={[styles.metaVal, { color: colors.textPrimary }]}>{isHost ? 'Host' : 'Guest'}</Text>
              </View>

              <View style={[styles.metaTile, { backgroundColor: colors.insetBg, borderColor: colors.insetBorder }]}>
                <Text style={[styles.metaKey, { color: colors.textMuted }]}>PEER P2P STATUS</Text>
                <Text
                  style={[
                    styles.metaVal,
                    { color: peerConnected ? colors.green : colors.amber }
                  ]}
                >
                  {peerConnected ? 'Connected' : 'Waiting for peer...'}
                </Text>
              </View>
            </View>

            {/* Leave Button */}
            <Pressable
              style={[
                styles.leaveBtn,
                {
                  backgroundColor: colors.dangerBtn,
                  borderColor: colors.dangerBtnBorder,
                }
              ]}
              onPress={onLeaveRoom}
            >
              <LogOut size={14} color={colors.dangerBtnText} style={{ marginRight: 6 }} />
              <Text style={[styles.leaveBtnText, { color: colors.dangerBtnText }]}>Leave Room</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  cardHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardBody: {
    padding: 16,
  },
  unpairedContainer: {
    gap: 12,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  joinRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    borderRadius: 8,
    borderWidth: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  pairedContainer: {
    gap: 12,
  },
  roomCodeBox: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  roomCodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  roomCodeLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  roomCodeValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roomCodeValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  roomCodeActions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  metaTile: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  metaKey: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metaVal: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
  },
  leaveBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
});
