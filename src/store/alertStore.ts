import { create } from 'zustand';

export interface AlertButton {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface AlertState {
  visible: boolean;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'confirm';
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  showAlert: (config: {
    title: string;
    message: string;
    type?: 'success' | 'error' | 'info' | 'confirm';
    onConfirm?: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
  }) => void;
  hideAlert: () => void;
}

export const useAlertStore = create<AlertState>((set) => ({
  visible: false,
  title: '',
  message: '',
  type: 'info',
  showAlert: (config) => set({
    visible: true,
    title: config.title,
    message: config.message,
    type: config.type || 'info',
    onConfirm: config.onConfirm,
    onCancel: config.onCancel,
    confirmText: config.confirmText,
    cancelText: config.cancelText,
  }),
  hideAlert: () => set({ visible: false }),
}));
