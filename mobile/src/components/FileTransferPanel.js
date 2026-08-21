import React, { useState, useRef } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Platform, NativeModules } from 'react-native';
import {
  UploadCloud,
  Download,
  Zap,
  CheckCircle2,
  Loader2,
  Trash2,
  FileText,
  Share2,
  Plus,
  Send,
  MessageSquare,
  Copy,
  Check,
  X
} from 'lucide-react-native';
import { formatBytes } from '../utils/helpers';

export const FileTransferPanel = ({
  colors,
  selectedFiles = [],
  selectedFile,
  onPickFiles,
  onRemoveSelectedFile,
  onClearSelectedFiles,
  onSendFileOffer,
  isUploading,
  senderProgress,
  senderBatchProgress = 0,
  senderCurrentFile,
  senderTransferSpeed,
  incomingFileOffer,
  onAcceptFileOffer,
  onRejectFileOffer,
  isDownloading,
  receiverProgress,
  receiverBatchProgress = 0,
  receiverTransferSpeed,
  receivedFiles = [],
  onShareFile,
  shareDownloadedFile,
  receiverFileMeta,
  chatMessages = [],
  onSendChatMessage,
}) => {
  const [chatInput, setChatInput] = useState('');
  const [copiedMsgId, setCopiedMsgId] = useState(null);

  const filesList = selectedFiles && selectedFiles.length > 0
    ? selectedFiles
    : selectedFile
      ? [selectedFile]
      : [];

  const totalSelectedSize = filesList.reduce((acc, f) => acc + (f.size || 0), 0);

  const handleCopyMessage = async (text, id) => {
    if (!text) return;
    try {
      if (NativeModules.IrohModule?.copyToClipboard) {
        await NativeModules.IrohModule.copyToClipboard(text);
      }
    } catch (e) {
      // Ignore copy error
    }
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    onSendChatMessage(chatInput);
    setChatInput('');
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
      {/* Header */}
      <View style={[styles.cardHeader, { borderBottomColor: colors.cardBorder }]}>
        <View style={styles.headerLeft}>
          <Zap size={16} color={colors.amber} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Direct P2P Data Tunnel</Text>
        </View>

        <View style={[styles.badge, { backgroundColor: colors.greenBg, borderColor: colors.greenBorder }]}>
          <Text style={[styles.badgeText, { color: colors.green }]}>WEBRTC ACTIVE</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        {/* ═══ Send Section ═══ */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <UploadCloud size={14} color={colors.textSecondary} />
            <Text style={[styles.sectionTitleText, { color: colors.textSecondary }]}>Send Files</Text>
          </View>

          {filesList.length === 0 ? (
            <Pressable
              style={[
                styles.dropzone,
                {
                  borderColor: colors.cardBorder,
                  backgroundColor: colors.insetBg,
                }
              ]}
              onPress={onPickFiles}
            >
              <UploadCloud size={28} color={colors.primaryBtn} style={{ marginBottom: 6 }} />
              <Text style={[styles.dropzoneLabel, { color: colors.textPrimary }]}>
                Select Files to Transfer
              </Text>
              <Text style={[styles.dropzoneHint, { color: colors.textMuted }]}>
                Supports documents, photos, videos, or archives
              </Text>
            </Pressable>
          ) : (
            <View>
              {/* Selected Files Header */}
              <View style={[styles.selectedHeaderRow, { borderBottomColor: colors.cardBorder }]}>
                <Text style={[styles.selectedHeaderText, { color: colors.textPrimary }]}>
                  Selected ({filesList.length}) · {formatBytes(totalSelectedSize)}
                </Text>

                {!isUploading && (
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <Pressable
                      style={[styles.chipBtn, { backgroundColor: colors.secondaryBtn, borderColor: colors.secondaryBtnBorder }]}
                      onPress={onPickFiles}
                    >
                      <Plus size={12} color={colors.primaryBtn} />
                      <Text style={[styles.chipBtnText, { color: colors.primaryBtn }]}>Add</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.chipBtn, { backgroundColor: colors.dangerBtn, borderColor: colors.dangerBtnBorder }]}
                      onPress={onClearSelectedFiles}
                    >
                      <Trash2 size={12} color={colors.red} />
                      <Text style={[styles.chipBtnText, { color: colors.red }]}>Clear</Text>
                    </Pressable>
                  </View>
                )}
              </View>

              {/* Files Queue List */}
              <View style={styles.queueList}>
                {filesList.map((file, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.fileItem,
                      {
                        backgroundColor: colors.insetBg,
                        borderColor: colors.insetBorder,
                      }
                    ]}
                  >
                    <FileText size={16} color={colors.primaryBtn} style={{ marginRight: 8 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fileName, { color: colors.textPrimary }]} numberOfLines={1}>
                        {file.name}
                      </Text>
                      <Text style={[styles.fileSize, { color: colors.textSecondary }]}>
                        {formatBytes(file.size)}
                      </Text>
                    </View>

                    {!isUploading && (
                      <Pressable hitSlop={8} onPress={() => onRemoveSelectedFile(idx)}>
                        <X size={14} color={colors.textMuted} />
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>

              {!isUploading && senderProgress < 100 && (
                <Pressable
                  style={[styles.primaryActionBtn, { backgroundColor: colors.primaryBtn }]}
                  onPress={onSendFileOffer}
                >
                  <Zap size={15} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.primaryActionBtnText}>Stream to Peer</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Upload Progress Box */}
          {isUploading && (
            <View style={[styles.progressBox, { backgroundColor: colors.insetBg, borderColor: colors.insetBorder }]}>
              <View style={styles.progressHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Loader2 size={13} color={colors.primaryBtn} />
                  <Text style={[styles.progressTitle, { color: colors.textPrimary }]}>
                    Streaming... {senderProgress}%
                  </Text>
                </View>
                {senderTransferSpeed > 0 && (
                  <Text style={[styles.speedText, { color: colors.primaryBtn }]}>
                    {(senderTransferSpeed / (1024 * 1024)).toFixed(2)} MB/s
                  </Text>
                )}
              </View>

              <View style={[styles.progressTrack, { backgroundColor: colors.cardBorder }]}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${senderProgress}%`, backgroundColor: colors.primaryBtn }
                  ]}
                />
              </View>

              {filesList.length > 1 && (
                <View style={{ marginTop: 8 }}>
                  <Text style={{ fontSize: 10, color: colors.textMuted, marginBottom: 4 }}>
                    Batch: {senderBatchProgress}% ({senderCurrentFile ? `${senderCurrentFile.index + 1}/${senderCurrentFile.total}` : ''})
                  </Text>
                  <View style={[styles.progressTrack, { backgroundColor: colors.cardBorder, height: 4 }]}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${senderBatchProgress}%`, backgroundColor: colors.green }
                      ]}
                    />
                  </View>
                </View>
              )}
            </View>
          )}

          {!isUploading && senderProgress === 100 && (
            <View style={[styles.completeBox, { backgroundColor: colors.greenBg, borderColor: colors.greenBorder }]}>
              <CheckCircle2 size={16} color={colors.green} />
              <Text style={[styles.completeText, { color: colors.green }]}>Transfer complete! Bytes verified.</Text>
            </View>
          )}
        </View>

        {/* ═══ Incoming Offer Section ═══ */}
        {incomingFileOffer && (
          <View style={[styles.section, { marginTop: 12 }]}>
            <View style={styles.sectionTitleRow}>
              <Download size={14} color={colors.primaryBtn} />
              <Text style={[styles.sectionTitleText, { color: colors.primaryBtn }]}>Incoming Request</Text>
            </View>

            <View style={[styles.offerCard, { backgroundColor: colors.insetBg, borderColor: colors.insetBorder }]}>
              <View style={{ marginBottom: 12 }}>
                <Text style={[styles.fileName, { color: colors.textPrimary, fontSize: 13.5 }]} numberOfLines={1}>
                  {incomingFileOffer.name}
                </Text>
                <Text style={[styles.fileSize, { color: colors.textSecondary }]}>
                  {formatBytes(incomingFileOffer.size)}
                  {incomingFileOffer.totalFiles > 1 ? ` (${incomingFileOffer.totalFiles} files in batch)` : ''}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  style={[styles.primaryActionBtn, { backgroundColor: colors.primaryBtn, flex: 1, marginTop: 0 }]}
                  onPress={onAcceptFileOffer}
                >
                  <Text style={styles.primaryActionBtnText}>Accept & Receive</Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.secondaryActionBtn,
                    {
                      borderColor: colors.dangerBtnBorder,
                      backgroundColor: colors.dangerBtn,
                      flex: 1
                    }
                  ]}
                  onPress={onRejectFileOffer}
                >
                  <Text style={{ color: colors.red, fontSize: 12.5, fontWeight: '700' }}>Decline</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* Receiving Progress */}
        {isDownloading && (
          <View style={[styles.section, { marginTop: 12 }]}>
            <View style={styles.sectionTitleRow}>
              <Download size={14} color={colors.green} />
              <Text style={[styles.sectionTitleText, { color: colors.green }]}>Receiving Bytes</Text>
            </View>

            <View style={[styles.progressBox, { backgroundColor: colors.insetBg, borderColor: colors.insetBorder }]}>
              <View style={styles.progressHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Loader2 size={13} color={colors.green} />
                  <Text style={[styles.progressTitle, { color: colors.textPrimary }]}>
                    Writing to Disk... {receiverProgress}%
                  </Text>
                </View>
                {receiverTransferSpeed > 0 && (
                  <Text style={[styles.speedText, { color: colors.green }]}>
                    {(receiverTransferSpeed / (1024 * 1024)).toFixed(2)} MB/s
                  </Text>
                )}
              </View>

              <View style={[styles.progressTrack, { backgroundColor: colors.cardBorder }]}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${receiverProgress}%`, backgroundColor: colors.green }
                  ]}
                />
              </View>
            </View>
          </View>
        )}

        {/* Received Files History */}
        {receivedFiles.length > 0 && (
          <View style={[styles.section, { marginTop: 12 }]}>
            <View style={styles.sectionTitleRow}>
              <CheckCircle2 size={14} color={colors.green} />
              <Text style={[styles.sectionTitleText, { color: colors.textSecondary }]}>
                Received Files ({receivedFiles.length})
              </Text>
            </View>

            <View style={styles.queueList}>
              {receivedFiles.map((f) => (
                <View
                  key={f.id}
                  style={[styles.fileItem, { backgroundColor: colors.insetBg, borderColor: colors.insetBorder }]}
                >
                  <FileText size={16} color={colors.green} style={{ marginRight: 8 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fileName, { color: colors.textPrimary }]} numberOfLines={1}>
                      {f.name}
                    </Text>
                    <Text style={[styles.fileSize, { color: colors.textSecondary }]}>
                      {formatBytes(f.size)} · {f.time}
                    </Text>
                  </View>

                  <Pressable
                    style={[styles.chipBtn, { backgroundColor: colors.secondaryBtn, borderColor: colors.secondaryBtnBorder }]}
                    onPress={() => onShareFile(f.uri)}
                  >
                    <Share2 size={12} color={colors.primaryBtn} style={{ marginRight: 4 }} />
                    <Text style={[styles.chipBtnText, { color: colors.primaryBtn }]}>Share</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ═══ In-Room Messaging ═══ */}
        <View style={[styles.section, { marginTop: 14 }]}>
          <View style={styles.sectionTitleRow}>
            <MessageSquare size={14} color={colors.textSecondary} />
            <Text style={[styles.sectionTitleText, { color: colors.textSecondary }]}>Peer Chat</Text>
          </View>

          <View style={[styles.chatContainer, { backgroundColor: colors.insetBg, borderColor: colors.insetBorder }]}>
            {chatMessages.length === 0 ? (
              <Text style={[styles.emptyChatText, { color: colors.textMuted }]}>
                Send private messages across the P2P data channel.
              </Text>
            ) : (
              <View style={styles.messagesList}>
                {chatMessages.map((msg) => {
                  const isMe = msg.sender === 'me';
                  const isCopied = copiedMsgId === msg.id;
                  return (
                    <Pressable
                      key={msg.id}
                      onPress={() => handleCopyMessage(msg.text, msg.id)}
                      onLongPress={() => handleCopyMessage(msg.text, msg.id)}
                      style={[
                        styles.chatBubble,
                        isMe
                          ? [styles.chatBubbleMe, { backgroundColor: colors.primaryBtn }]
                          : [styles.chatBubblePeer, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]
                      ]}
                    >
                      <View style={styles.chatHeaderRow}>
                        <Text style={[styles.chatTime, { color: isMe ? 'rgba(255,255,255,0.7)' : colors.textMuted }]}>
                          {msg.time}
                        </Text>
                        <Pressable
                          onPress={() => handleCopyMessage(msg.text, msg.id)}
                          hitSlop={8}
                          style={styles.chatCopyBtn}
                        >
                          {isCopied ? (
                            <Check size={11} color={isMe ? '#fff' : '#10B981'} />
                          ) : (
                            <Copy size={11} color={isMe ? 'rgba(255,255,255,0.7)' : colors.textMuted} />
                          )}
                        </Pressable>
                      </View>
                      <Text style={[styles.chatText, { color: isMe ? '#fff' : colors.textPrimary }]}>
                        {msg.text}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <View style={[styles.chatInputRow, { borderTopColor: colors.insetBorder }]}>
              <TextInput
                style={[styles.chatInput, { color: colors.textPrimary }]}
                placeholder="Type a message..."
                placeholderTextColor={colors.textMuted}
                value={chatInput}
                onChangeText={setChatInput}
                onSubmitEditing={handleSendChat}
              />
              <Pressable
                style={[
                  styles.sendBtn,
                  {
                    backgroundColor: chatInput.trim() ? colors.primaryBtn : colors.secondaryBtn,
                  }
                ]}
                onPress={handleSendChat}
                disabled={!chatInput.trim()}
              >
                <Send size={13} color={chatInput.trim() ? '#fff' : colors.textMuted} />
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 24,
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
  section: {
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sectionTitleText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dropzone: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropzoneLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  dropzoneHint: {
    fontSize: 11,
    marginTop: 2,
  },
  selectedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  selectedHeaderText: {
    fontSize: 12,
    fontWeight: '700',
  },
  chipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 4,
    borderWidth: 1,
  },
  chipBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  queueList: {
    gap: 6,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  fileName: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  fileSize: {
    fontSize: 10.5,
    marginTop: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 8,
    marginTop: 10,
  },
  primaryActionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 8,
    borderWidth: 1,
  },
  progressBox: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  speedText: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  progressTrack: {
    height: 5,
    borderRadius: 2.5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2.5,
  },
  completeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
  },
  completeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  offerCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  chatContainer: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  emptyChatText: {
    fontSize: 11,
    fontStyle: 'italic',
    padding: 12,
    textAlign: 'center',
  },
  messagesList: {
    padding: 10,
    gap: 6,
  },
  chatBubble: {
    maxWidth: '80%',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  chatBubbleMe: {
    alignSelf: 'flex-end',
  },
  chatBubblePeer: {
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  chatHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
    gap: 8,
  },
  chatCopyBtn: {
    padding: 2,
    borderRadius: 4,
  },
  chatText: {
    fontSize: 12,
    lineHeight: 16,
  },
  chatTime: {
    fontSize: 9,
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chatInput: {
    flex: 1,
    fontSize: 12,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  sendBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
