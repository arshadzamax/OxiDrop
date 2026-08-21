import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, Share } from 'react-native';
import {
  UploadCloud,
  Download,
  Zap,
  CheckCircle2,
  Loader2,
  Copy,
  Share2,
  Shield,
  FileText,
  Check,
} from 'lucide-react-native';
import * as Sharing from 'expo-sharing';
import { formatBytes } from '../utils/helpers';

export const IrohTransferPanel = ({
  colors,
  selectedFile,
  irohTicket,
  isIrohSharing,
  onPickFile,
  onStartShare,
  onResetShare,
  downloadTicket,
  targetFileName,
  targetFileSize,
  isIrohDownloading,
  downloadProgress,
  downloadSpeed,
  transferredBytes,
  totalBytes,
  downloadedFilePath,
  onSetDownloadTicket,
  onDownloadFromIroh,
  onShareDownloaded,
  onResetDownload,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyTicket = async () => {
    if (!irohTicket) return;
    try {
      await Share.share({
        message: irohTicket,
        title: 'OxiDrop Iroh Ticket',
      });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      // User dismissed share dialog
    }
  };

  const handleShareTicket = async () => {
    handleCopyTicket();
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Shield size={16} color="#00f2fe" />
          <Text style={[styles.cardTitle, { color: colors.text }]}>Iroh P2P Mode (Native)</Text>
        </View>
        <View style={styles.irohBadge}>
          <Text style={styles.irohBadgeText}>Direct QUIC</Text>
        </View>
      </View>

      <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
        Decentralized peer-to-peer file distribution without any central server.
      </Text>

      {/* ─── SENDER SECTION ─── */}
      <View style={[styles.sectionBox, { borderColor: colors.border, backgroundColor: colors.bgInset }]}>
        <View style={styles.sectionHeader}>
          <UploadCloud size={14} color="#00f2fe" />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Natively Share File</Text>
        </View>

        <Pressable
          onPress={onPickFile}
          style={[
            styles.dropzone,
            {
              borderColor: selectedFile ? '#00f2fe' : colors.border,
              borderStyle: selectedFile ? 'solid' : 'dashed',
            },
          ]}
        >
          <UploadCloud size={24} color={selectedFile ? '#00f2fe' : colors.textSecondary} />
          {selectedFile ? (
            <View style={{ alignItems: 'center', marginTop: 6 }}>
              <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>
                {selectedFile.name}
              </Text>
              <Text style={[styles.fileSize, { color: colors.textSecondary }]}>
                {formatBytes(selectedFile.size)}
              </Text>
              <Text style={{ color: '#00f2fe', fontSize: 10, marginTop: 4, fontWeight: '600' }}>
                Tap to change file
              </Text>
            </View>
          ) : (
            <View style={{ alignItems: 'center', marginTop: 6 }}>
              <Text style={[styles.dropzoneText, { color: colors.text }]}>Tap to choose file</Text>
              <Text style={[styles.dropzoneHint, { color: colors.textSecondary }]}>
                Any size, direct device-to-device stream
              </Text>
            </View>
          )}
        </Pressable>

        {selectedFile && !isIrohSharing && !irohTicket && (
          <Pressable onPress={onStartShare} style={[styles.btn, { backgroundColor: '#00f2fe' }]}>
            <Zap size={14} color="#000" />
            <Text style={[styles.btnText, { color: '#000' }]}>Generate Iroh Ticket</Text>
          </Pressable>
        )}

        {isIrohSharing && (
          <View style={styles.loadingBox}>
            <Loader2 size={16} color="#00f2fe" />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Initializing Iroh Node & Packaging Blob...
            </Text>
          </View>
        )}

        {irohTicket ? (
          <View style={[styles.ticketBox, { backgroundColor: 'rgba(0,0,0,0.3)', borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#00f2fe' }}>Iroh Share Ticket:</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Pressable onPress={handleCopyTicket} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} color={colors.textSecondary} />}
                  <Text style={{ fontSize: 10, color: copied ? '#10b981' : colors.textSecondary }}>
                    {copied ? 'Copied' : 'Copy'}
                  </Text>
                </Pressable>
              </View>
            </View>
            <TextInput
              editable={false}
              multiline
              value={irohTicket}
              style={[styles.ticketInput, { color: colors.textSecondary }]}
            />
            <Text style={{ fontSize: 10, color: colors.textSecondary, fontStyle: 'italic', marginTop: 6, textAlign: 'center' }}>
              Paste this ticket on Desktop Tauri or another OxiDrop mobile device.
            </Text>
            <Pressable
              onPress={onResetShare}
              style={[styles.btn, { backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 8, paddingVertical: 8 }]}
            >
              <Text style={[styles.btnText, { color: colors.text, fontSize: 11 }]}>Share Another File</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* ─── RECEIVER SECTION ─── */}
      <View style={[styles.sectionBox, { borderColor: colors.border, backgroundColor: colors.bgInset, marginTop: 16 }]}>
        <View style={styles.sectionHeader}>
          <Download size={14} color="#10b981" />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Receive via Iroh Ticket</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            placeholder="Paste Iroh Share Ticket here..."
            placeholderTextColor={colors.textSecondary}
            value={downloadTicket}
            onChangeText={onSetDownloadTicket}
            editable={!isIrohDownloading}
            style={[styles.input, { flex: 1, color: colors.text, borderColor: colors.border, backgroundColor: 'rgba(0,0,0,0.2)' }]}
          />
          {downloadTicket ? (
            <Pressable
              onPress={onResetDownload}
              disabled={isIrohDownloading}
              style={[styles.clearBtn, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Clear</Text>
            </Pressable>
          ) : null}
        </View>

        {/* File Metadata Preview */}
        {targetFileName ? (
          <View style={[styles.filePreview, { backgroundColor: 'rgba(0, 242, 254, 0.08)', borderColor: 'rgba(0, 242, 254, 0.2)' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <FileText size={14} color="#00f2fe" />
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                {targetFileName}
              </Text>
            </View>
            {targetFileSize > 0 && (
              <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                {formatBytes(targetFileSize)}
              </Text>
            )}
          </View>
        ) : null}

        {!isIrohDownloading && (
          <Pressable
            onPress={onDownloadFromIroh}
            disabled={!downloadTicket.trim()}
            style={[
              styles.btn,
              {
                backgroundColor: downloadTicket.trim() ? '#10b981' : colors.border,
                opacity: downloadTicket.trim() ? 1 : 0.5,
              },
            ]}
          >
            <Download size={14} color="#fff" />
            <Text style={[styles.btnText, { color: '#fff' }]}>Download via Iroh QUIC</Text>
          </Pressable>
        )}

        {isIrohDownloading && (
          <View style={styles.progressBox}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Loader2 size={13} color="#00f2fe" />
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>Downloading...</Text>
              </View>
              <Text style={{ color: '#00f2fe', fontSize: 12, fontWeight: '700' }}>{downloadProgress}%</Text>
            </View>

            <View style={[styles.progressTrack, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
              <View style={[styles.progressFill, { width: `${downloadProgress}%`, backgroundColor: '#00f2fe' }]} />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={{ color: '#00f2fe', fontSize: 11, fontWeight: '700' }}>
                ⚡ {downloadSpeed > 0 ? `${(downloadSpeed / (1024 * 1024)).toFixed(2)} MB/s` : 'Connecting...'}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                {formatBytes(transferredBytes)} {totalBytes > 0 ? `/ ${formatBytes(totalBytes)}` : ''}
              </Text>
            </View>
          </View>
        )}

        {downloadedFilePath && !isIrohDownloading ? (
          <View style={{ gap: 8, marginTop: 10 }}>
            <Pressable onPress={onShareDownloaded} style={[styles.btn, { backgroundColor: '#3b82f6', marginTop: 0 }]}>
              <Share2 size={14} color="#fff" />
              <Text style={[styles.btnText, { color: '#fff' }]}>Open / Share Downloaded File</Text>
            </Pressable>
            <Pressable
              onPress={onResetDownload}
              style={[styles.btn, { backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 0, paddingVertical: 8 }]}
            >
              <Text style={[styles.btnText, { color: colors.textSecondary, fontSize: 11 }]}>Download Another File</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 12,
    marginBottom: 14,
  },
  irohBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.3)',
  },
  irohBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#00f2fe',
  },
  sectionBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  dropzone: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  dropzoneText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dropzoneHint: {
    fontSize: 10,
    marginTop: 2,
  },
  fileName: {
    fontSize: 12,
    fontWeight: '600',
    maxWidth: 240,
  },
  fileSize: {
    fontSize: 10,
    marginTop: 2,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  btnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginTop: 8,
  },
  loadingText: {
    fontSize: 11,
  },
  ticketBox: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    marginTop: 10,
  },
  ticketInput: {
    fontSize: 10,
    fontFamily: 'monospace',
    height: 48,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
  },
  clearBtn: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  filePreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
  },
  progressBox: {
    marginTop: 12,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
});
