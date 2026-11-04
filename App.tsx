import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import CustomAlert from './src/components/CustomAlert';
import { Alert } from 'react-native';
import { useAlertStore } from './src/store/alertStore';

// Override native Alert.alert globally to inject custom glassmorphic styling
Alert.alert = (title, message, buttons, options) => {
  const titleStr = typeof title === 'string' ? title : '';
  const messageStr = typeof message === 'string' ? message : '';
  
  const titleLower = titleStr.toLowerCase();
  const messageLower = messageStr.toLowerCase();

  let inferredType: 'success' | 'error' | 'info' | 'confirm' = 'info';
  
  if (buttons && buttons.length > 1) {
    inferredType = 'confirm';
  } else if (
    titleLower.includes('sukses') || 
    titleLower.includes('success') || 
    titleLower.includes('berhasil') || 
    titleLower.includes('saved') || 
    titleLower.includes('copied') || 
    messageLower.includes('sukses') || 
    messageLower.includes('success') || 
    messageLower.includes('berhasil')
  ) {
    inferredType = 'success';
  } else if (
    titleLower.includes('error') || 
    titleLower.includes('gagal') || 
    titleLower.includes('failed') || 
    titleLower.includes('validation') || 
    messageLower.includes('error') || 
    messageLower.includes('gagal') || 
    messageLower.includes('failed')
  ) {
    inferredType = 'error';
  }

  let onConfirm: (() => void) | undefined;
  let onCancel: (() => void) | undefined;
  let confirmText = 'OK';
  let cancelText = 'Batal';

  if (buttons && buttons.length > 0) {
    if (buttons.length === 1) {
      const btn = buttons[0];
      onConfirm = btn.onPress;
      confirmText = btn.text || 'OK';
    } else {
      const cancelBtn = buttons.find(b => b.style === 'cancel') || buttons[0];
      const confirmBtn = buttons.find(b => b.style !== 'cancel') || buttons[1];
      
      onCancel = cancelBtn?.onPress;
      cancelText = cancelBtn?.text || 'Batal';
      
      onConfirm = confirmBtn?.onPress;
      confirmText = confirmBtn?.text || 'OK';
    }
  }

  useAlertStore.getState().showAlert({
    title: titleStr,
    message: messageStr,
    type: inferredType,
    onConfirm,
    onCancel,
    confirmText,
    cancelText,
  });
};

export default function App() {
  return (
    <SafeAreaProvider>
      <RootNavigator />
      <CustomAlert />
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
