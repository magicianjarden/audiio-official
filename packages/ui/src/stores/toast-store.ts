/**
 * Toast store - manages toast notifications
 */

import { create } from 'zustand';

export interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  duration: number; // ms
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

let toastIdCounter = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  addToast: (toast) => {
    const id = `toast-${++toastIdCounter}`;
    const newToast: Toast = { ...toast, id };

    set(state => ({
      toasts: [...state.toasts, newToast]
    }));

    // Auto-remove after duration
    if (toast.duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, toast.duration);
    }

    return id;
  },

  removeToast: (id) => {
    set(state => ({
      toasts: state.toasts.filter(t => t.id !== id)
    }));
  },

  clearToasts: () => {
    set({ toasts: [] });
  }
}));

// Convenience functions for common toast types
export function showToast(message: string, type: Toast['type'] = 'info', duration = 3000): string {
  return useToastStore.getState().addToast({ message, type, duration });
}

export function showSuccessToast(message: string, duration = 3000): string {
  return showToast(message, 'success', duration);
}

export function showErrorToast(message: string, duration = 4000): string {
  return showToast(message, 'error', duration);
}

export function showInfoToast(message: string, duration = 3000): string {
  return showToast(message, 'info', duration);
}

export function showActionToast(
  message: string,
  action: { label: string; onClick: () => void },
  duration = 5000
): string {
  return useToastStore.getState().addToast({
    message,
    type: 'info',
    duration,
    action
  });
}
