/**
 * Toast notification component
 */

import React, { useEffect, useState } from 'react';
import { useToastStore, type Toast as ToastType } from '../../stores/toast-store';
import { CheckIcon, XIcon, InfoIcon, AlertIcon } from '@audiio/icons';

interface ToastItemProps {
  toast: ToastType;
  onRemove: () => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onRemove }) => {
  const [isExiting, setIsExiting] = useState(false);

  const handleRemove = () => {
    setIsExiting(true);
    setTimeout(onRemove, 200); // Match animation duration
  };

  const Icon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckIcon size={18} />;
      case 'error':
        return <XIcon size={18} />;
      case 'warning':
        return <AlertIcon size={18} />;
      default:
        return <InfoIcon size={18} />;
    }
  };

  return (
    <div className={`toast toast-${toast.type} ${isExiting ? 'toast-exit' : ''}`}>
      <div className="toast-icon">
        <Icon />
      </div>
      <div className="toast-content">
        <span className="toast-message">{toast.message}</span>
        {toast.action && (
          <button className="toast-action" onClick={toast.action.onClick}>
            {toast.action.label}
          </button>
        )}
      </div>
      <button className="toast-close" onClick={handleRemove}>
        <XIcon size={14} />
      </button>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onRemove={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
};

export default ToastContainer;
