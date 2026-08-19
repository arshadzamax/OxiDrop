import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { SimpleQrSvg } from './SimpleQrSvg';

export const QRModal = ({ visible, onClose, roomCode, colors }) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Room QR Code</Text>
            <Pressable onPress={onClose}>
              <X size={20} color={colors.textPrimary} />
            </Pressable>
          </View>
          <View style={{ alignItems: 'center', marginVertical: 16 }}>
            <SimpleQrSvg value={roomCode || "OXIDROP"} size={200} color="#00a2ed" bg={colors.inputBg} />
            <Text style={[styles.qrCodeText, { color: colors.textPrimary, marginTop: 12 }]}>{roomCode}</Text>
            <Text style={[styles.qrHint, { color: colors.textSecondary }]}>Scan with Web or Mobile camera to join room</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  qrCodeText: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 2,
  },
  qrHint: {
    fontSize: 11,
    marginTop: 4,
  },
});
