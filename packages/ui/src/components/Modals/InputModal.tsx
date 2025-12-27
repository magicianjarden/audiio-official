import React, { useState, useEffect, useRef } from 'react';
import { CloseIcon } from '@audiio/icons';

interface InputModalProps {
  title: string;
  placeholder?: string;
  submitLabel?: string;
  initialValue?: string;
  onSubmit: (value: string) => void;
  onClose: () => void;
  icon?: React.ReactNode;
}

export const InputModal: React.FC<InputModalProps> = ({
  title,
  placeholder = 'Enter name...',
  submitLabel = 'Create',
  initialValue = '',
  onSubmit,
  onClose,
  icon,
}) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on escape or click outside
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleSubmit = () => {
    if (value.trim()) {
      onSubmit(value.trim());
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && value.trim()) {
      handleSubmit();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal-small" ref={modalRef}>
        <header className="modal-header">
          {icon && <span className="modal-header-icon">{icon}</span>}
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>
            <CloseIcon size={20} />
          </button>
        </header>

        <div className="modal-content">
          <input
            ref={inputRef}
            type="text"
            className="modal-input"
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          <div className="modal-actions">
            <button
              className="modal-button secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="modal-button primary"
              onClick={handleSubmit}
              disabled={!value.trim()}
            >
              {submitLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InputModal;
