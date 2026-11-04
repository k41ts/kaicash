import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { useAlertStore } from '../store/alertStore';
import Animated, { FadeIn, ZoomIn, FadeOut, ZoomOut } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

export default function CustomAlert() {
  const { visible, title, message, type, confirmText, cancelText, onConfirm, onCancel, hideAlert } = useAlertStore();

  if (!visible) return null;

  const handleConfirm = () => {
    hideAlert();
    if (onConfirm) onConfirm();
  };

  const handleCancel = () => {
    hideAlert();
    if (onCancel) onCancel();
  };

  const getIconInfo = () => {
    switch (type) {
      case 'success':
        return { name: 'check-circle' as const, color: '#00E676', bg: 'rgba(0, 230, 118, 0.12)' };
      case 'error':
        return { name: 'x-circle' as const, color: '#FF5252', bg: 'rgba(255, 82, 82, 0.12)' };
      case 'confirm':
        return { name: 'help-circle' as const, color: '#6643FF', bg: 'rgba(102, 67, 255, 0.12)' };
      case 'info':
      default:
        return { name: 'info' as const, color: '#448AFF', bg: 'rgba(68, 138, 255, 0.12)' };
    }
  };

  const iconInfo = getIconInfo();

  return (
    <Modal visible={visible} transparent animationType="none">
      <View style={StyleSheet.absoluteFill}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        
        <Animated.View 
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={styles.overlay}
        >
          <Animated.View 
            entering={ZoomIn.duration(250)}
            exiting={ZoomOut.duration(150)}
            style={styles.alertCard}
          >
            <View style={[styles.iconContainer, { backgroundColor: iconInfo.bg }]}>
              <Feather name={iconInfo.name} size={36} color={iconInfo.color} />
            </View>

            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>

            {type === 'confirm' ? (
              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                  <Text style={styles.cancelButtonText}>{cancelText || 'Batal'}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.confirmButtonWrapper} onPress={handleConfirm}>
                  <LinearGradient
                    colors={['#6643FF', '#3D28E0']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gradientButton}
                  >
                    <Text style={styles.confirmButtonText}>{confirmText || 'Ya'}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.singleButtonWrapper} onPress={handleConfirm}>
                <LinearGradient
                  colors={['#6643FF', '#3D28E0']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.gradientButton}
                >
                  <Text style={styles.confirmButtonText}>{confirmText || 'OK'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    padding: 24,
  },
  alertCard: {
    width: '90%',
    maxWidth: 320,
    backgroundColor: 'rgba(25, 25, 35, 0.92)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
  },
  iconContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#A0A0B0',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#E0E0E0',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmButtonWrapper: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  singleButtonWrapper: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  gradientButton: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
