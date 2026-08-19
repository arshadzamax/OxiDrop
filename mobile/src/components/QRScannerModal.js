import React from 'react';
import { View, Text, TextInput, Pressable, Modal, StyleSheet } from 'react-native';
import { QrCode, X } from 'lucide-react-native';

export const QRScannerModal = ({ visible, onClose, onJoinRoom, colors }) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Scan Room QR Code</Text>
            <Pressable onPress={onClose}>
              <X size={20} color={colors.textPrimary} />
            </Pressable>
          </View>
          <View style={{ marginVertical: 16, alignItems: 'center' }}>
            <QrCode size={64} color="#00a2ed" />
            <Text style={[styles.qrHint, { color: colors.textSecondary, marginVertical: 12, textAlign: 'center' }]}>
              Enter the room code scanned from web or peer camera:
            </Text>
            <TextInput
              style={[styles.input, { width: '100%', textAlign: 'center', fontSize: 18, fontWeight: '700', backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              placeholder="EX: A1B2C3"
              placeholderTextColor={colors.textSecondary}
              onChangeText={(val) => {
                if (val.length >= 6) {
                  onClose();
                  onJoinRoom(val);
                }
              }}
            />
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
  input: {
    height: 42,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  qrHint: {
    fontSize: 11,
    marginTop: 4,
  },
});
