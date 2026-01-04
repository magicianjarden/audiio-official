/**
 * ModalSheet - Reusable bottom sheet component
 *
 * Features:
 * - Configurable heights (full, half, auto)
 * - Swipe to dismiss
 * - Backdrop tap to dismiss
 * - Nested scrolling support
 * - Spring animation on open/close
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { triggerHaptic } from '../utils/haptics';
import styles from './ModalSheet.module.css';

type SheetHeight = 'full' | 'half' | 'auto' | number;

interface ModalSheetProps {
  isOpen: boolean;
  onClose: () => void;
  height?: SheetHeight;
  showHandle?: boolean;
  children: React.ReactNode;
  title?: string;
  className?: string;
}

const SWIPE_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 0.4;

interface TouchState {
  startY: number;
  startTime: number;
  currentY: number;
}

export function ModalSheet({
  isOpen,
  onClose,
  height = 'auto',
  showHandle = true,
  children,
  title,
  className,
}: ModalSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const touchStateRef = useRef<TouchState | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setDragOffset(0);
      setIsDragging(false);
      setIsClosing(false);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    triggerHaptic('light');
    // Wait for animation before calling onClose
    setTimeout(onClose, 200);
  }, [onClose]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }, [handleClose]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;

    // Only start dragging from handle area or if at top of scroll
    const target = e.target as HTMLElement;
    const isHandle = target.closest(`.${styles.handle}`);
    const sheet = sheetRef.current;

    if (!isHandle && sheet && sheet.scrollTop > 0) {
      return; // Allow normal scrolling
    }

    touchStateRef.current = {
      startY: touch.clientY,
      startTime: Date.now(),
      currentY: touch.clientY,
    };
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStateRef.current) return;

    const touch = e.touches[0];
    if (!touch) return;

    const deltaY = touch.clientY - touchStateRef.current.startY;

    // Only allow dragging down
    if (deltaY > 0) {
      touchStateRef.current.currentY = touch.clientY;
      setDragOffset(deltaY);
      e.preventDefault(); // Prevent scrolling while dragging
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchStateRef.current) return;

    const deltaY = touchStateRef.current.currentY - touchStateRef.current.startY;
    const deltaTime = Date.now() - touchStateRef.current.startTime;
    const velocity = deltaY / deltaTime;

    if (deltaY > SWIPE_THRESHOLD || velocity > VELOCITY_THRESHOLD) {
      handleClose();
    } else {
      // Snap back
      setDragOffset(0);
    }

    touchStateRef.current = null;
    setIsDragging(false);
  }, [handleClose]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen && !isClosing) return null;

  const heightStyle = typeof height === 'number'
    ? { height: `${height}px` }
    : height === 'full'
      ? { height: '100%' }
      : height === 'half'
        ? { height: '50%' }
        : { height: 'auto', maxHeight: '90%' };

  const content = (
    <div
      className={`${styles.overlay} ${isOpen && !isClosing ? styles.visible : ''}`}
      onClick={handleBackdropClick}
      style={{ opacity: isDragging ? 1 - (dragOffset / 400) : undefined }}
    >
      <div
        ref={sheetRef}
        className={`${styles.sheet} ${isOpen && !isClosing ? styles.visible : ''} ${className || ''}`}
        style={{
          ...heightStyle,
          transform: isDragging ? `translateY(${dragOffset}px)` : undefined,
          transition: isDragging ? 'none' : undefined,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {showHandle && (
          <div className={styles.handle}>
            <div className={styles.handleBar} />
          </div>
        )}

        {title && (
          <div className={styles.header}>
            <h2 className={styles.title}>{title}</h2>
          </div>
        )}

        <div className={styles.content}>
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
