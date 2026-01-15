import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';

export default function BetaGateModal({ visible, onClose }:{ visible:boolean; onClose:()=>void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}><View /></Pressable>
      <View style={styles.card}>
        <Text style={styles.title}>Panterix Beta</Text>
        <Text style={styles.body}>This feature has not yet gone live on Panterix Beta.</Text>
        <TouchableOpacity onPress={onClose} style={styles.btn}>
          <Text style={styles.btnText}>OK</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  card: {
    position: 'absolute', left: 20, right: 20, top: 140,
    borderRadius: 18, paddingVertical: 16, paddingHorizontal: 16,
    backgroundColor: 'rgba(10,10,18,0.98)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 6 },
  body: { color: 'rgba(255,255,255,0.92)', fontSize: 14, marginBottom: 12 },
  btn: {
    alignSelf: 'flex-end',
    paddingVertical: 8, paddingHorizontal: 16,
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  btnText: { color: '#fff', fontWeight: '700' },
});