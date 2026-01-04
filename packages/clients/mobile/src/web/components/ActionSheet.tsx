/**
 * ActionSheet - Generic bottom sheet for mobile actions
 */

import React, { useEffect, useRef } from 'react';
import styles from './ActionSheet.module.css';

export interface ActionSheetOption {
  id: string;
  label: string;
  icon?: React.ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

interface ActionSheetProps {
  isOpen: boolean;
  title?: string;
  subtitle?: string;
  options: ActionSheetOption[];
  onClose: () => void;
  header?: React.ReactNode;
}

export function ActionSheet({
  isOpen,
  title,
  subtitle,
  options,
  onClose,
  header
}: ActionSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOptionClick = (option: ActionSheetOption) => {
    if (option.disabled) return;
    option.onClick();
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        ref={sheetRef}
        className={styles.sheet}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle for drag */}
        <div className={styles.handle} />

        {/* Header */}
        {header && <div className={styles.header}>{header}</div>}

        {/* Title/Subtitle */}
        {(title || subtitle) && !header && (
          <div className={styles.titleSection}>
            {title && <h3 className={styles.title}>{title}</h3>}
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
        )}

        {/* Options */}
        <div className={styles.options}>
          {options.map((option, index) => (
            <button
              key={option.id}
              className={`${styles.option} ${option.destructive ? styles.destructive : ''} ${option.disabled ? styles.disabled : ''}`}
              onClick={() => handleOptionClick(option)}
              disabled={option.disabled}
            >
              {option.icon && <span className={styles.optionIcon}>{option.icon}</span>}
              <span className={styles.optionLabel}>{option.label}</span>
            </button>
          ))}
        </div>

        {/* Cancel button */}
        <button className={styles.cancelButton} onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
