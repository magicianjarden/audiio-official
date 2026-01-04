/**
 * FullPlayer - Full-screen player modal
 *
 * Features:
 * - Animated gradient background from artwork colors
 * - Swipe down to dismiss
 * - Complete playback controls
 * - Lyrics preview
 * - Queue and lyrics navigation
 */

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { usePlaybackState, usePlaybackControls, usePlaybackModes, usePlayerStore } from '../stores/player-store';
import { useLibraryStore } from '../stores/library-store';
import { useLyricsStore, getCurrentLyricIndex } from '../stores/lyrics-store';
import { getTrackArtwork } from '../utils/artwork';
import { triggerHaptic } from '../utils/haptics';
import { useColorExtraction } from '../hooks/useColorExtraction';
import {
  PlayIcon,
  PauseIcon,
  PrevIcon,
  NextIcon,
  MusicNoteIcon,
  ChevronDownIcon,
  HeartIcon,
  HeartOutlineIcon,
  ShuffleIcon,
  RepeatIcon,
  QueueIcon,
  LyricsIcon,
  MoreIcon,
} from '@audiio/icons';
import styles from './FullPlayer.module.css';

interface FullPlayerProps {
  isOpen: boolean;
  onClose: () => void;
}

const SWIPE_THRESHOLD = 100;
const VELOCITY_THRESHOLD = 0.5;

interface TouchState {
  startY: number;
  startTime: number;
  currentY: number;
}

export function FullPlayer({ isOpen, onClose }: FullPlayerProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStateRef = useRef<TouchState | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Player state
  const { currentTrack, isPlaying, isBuffering, position, duration } = usePlaybackState();
  const { pause, resume, seek, nextTrack, previousTrack } = usePlaybackControls();
  const { isShuffled, repeatMode } = usePlaybackModes();
  const { toggleShuffle, toggleRepeat } = usePlayerStore();
  const { isLiked, toggleLike } = useLibraryStore();

  // Lyrics state
  const { lyrics, fetchLyrics } = useLyricsStore();
  const currentLyricIndex = lyrics?.synced ? getCurrentLyricIndex(lyrics.synced, position) : -1;
  const currentLyricText = lyrics?.synced?.[currentLyricIndex]?.text || '';

  // Artwork and colors
  const artwork = currentTrack ? getTrackArtwork(currentTrack, 'large') : null;
  const colors = useColorExtraction(artwork || null);

  // Fetch lyrics when opened
  useEffect(() => {
    if (isOpen && currentTrack) {
      fetchLyrics(currentTrack);
    }
  }, [isOpen, currentTrack?.id, fetchLyrics]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  // Touch handlers for swipe to dismiss
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
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
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchStateRef.current) return;

    const deltaY = touchStateRef.current.currentY - touchStateRef.current.startY;
    const deltaTime = Date.now() - touchStateRef.current.startTime;
    const velocity = deltaY / deltaTime;

    if (deltaY > SWIPE_THRESHOLD || velocity > VELOCITY_THRESHOLD) {
      triggerHaptic('light');
      onClose();
    }

    touchStateRef.current = null;
    setDragOffset(0);
    setIsDragging(false);
  }, [onClose]);

  const handlePlayPause = useCallback(() => {
    triggerHaptic('light');
    isPlaying ? pause() : resume();
  }, [isPlaying, pause, resume]);

  const handlePrevious = useCallback(() => {
    triggerHaptic('light');
    previousTrack();
  }, [previousTrack]);

  const handleNext = useCallback(() => {
    triggerHaptic('light');
    nextTrack();
  }, [nextTrack]);

  const handleLike = useCallback(() => {
    if (!currentTrack) return;
    triggerHaptic('light');
    // Cast to any to work around type mismatch between stores
    toggleLike(currentTrack as any);
  }, [currentTrack, toggleLike]);

  const handleShuffle = useCallback(() => {
    triggerHaptic('light');
    toggleShuffle();
  }, [toggleShuffle]);

  const handleRepeat = useCallback(() => {
    triggerHaptic('light');
    toggleRepeat();
  }, [toggleRepeat]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    seek(parseFloat(e.target.value));
  }, [seek]);

  const handleOpenQueue = useCallback(() => {
    onClose();
    navigate('/queue');
  }, [onClose, navigate]);

  const handleOpenLyrics = useCallback(() => {
    onClose();
    navigate('/lyrics');
  }, [onClose, navigate]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen || !currentTrack) return null;

  const progress = duration > 0 ? (position / duration) * 100 : 0;
  const artistName = currentTrack.artists?.[0]?.name || 'Unknown Artist';
  const albumName = currentTrack.album?.name || currentTrack.album?.title;
  const liked = isLiked(currentTrack.id);

  const content = (
    <>
      {/* Backdrop */}
      <div
        className={`${styles.backdrop} ${isOpen ? styles.visible : ''}`}
        onClick={onClose}
        style={{ opacity: isDragging ? 1 - (dragOffset / 400) : undefined }}
      />

      {/* Player */}
      <div
        ref={containerRef}
        className={`${styles.container} ${isOpen ? styles.visible : ''}`}
        style={{
          '--dynamic-color-primary': colors.primary,
          '--dynamic-color-secondary': colors.secondary,
          transform: isDragging ? `translateY(${dragOffset}px)` : undefined,
          transition: isDragging ? 'none' : undefined,
        } as React.CSSProperties}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div className={styles.dragHandle}>
          <div className={styles.dragBar} />
        </div>

        {/* Header */}
        <div className={styles.header}>
          <button className={styles.headerButton} onClick={onClose} aria-label="Close">
            <ChevronDownIcon size={28} />
          </button>
          <div className={styles.headerInfo}>
            <span className={styles.headerLabel}>Playing from</span>
            <span className={styles.headerSource}>{albumName || 'Unknown'}</span>
          </div>
          <button className={styles.headerButton} onClick={handleOpenLyrics} aria-label="Lyrics">
            <LyricsIcon size={22} />
          </button>
        </div>

        {/* Artwork */}
        <div className={styles.artworkContainer}>
          <div className={styles.artwork}>
            {artwork ? (
              <img src={artwork} alt={currentTrack.title} />
            ) : (
              <div className={styles.artworkPlaceholder}>
                <MusicNoteIcon size={64} />
              </div>
            )}
          </div>

          {/* Current lyric preview */}
          {currentLyricText && (
            <p className={styles.lyricPreview}>{currentLyricText}</p>
          )}
        </div>

        {/* Track Info */}
        <div className={styles.trackInfo}>
          <h1 className={styles.trackTitle}>{currentTrack.title}</h1>
          <p className={styles.trackArtist}>{artistName}</p>
        </div>

        {/* Progress */}
        <div className={styles.progressSection}>
          <span className={styles.time}>{formatTime(position)}</span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={position}
            onChange={handleSeek}
            className={styles.progressBar}
            style={{ '--progress': `${progress}%` } as React.CSSProperties}
          />
          <span className={styles.time}>{formatTime(duration)}</span>
        </div>

        {/* Controls */}
        <div className={styles.controls}>
          <button
            className={`${styles.controlButton} ${isShuffled ? styles.active : ''}`}
            onClick={handleShuffle}
            aria-label="Shuffle"
          >
            <ShuffleIcon size={24} />
          </button>
          <button className={styles.controlButton} onClick={handlePrevious} aria-label="Previous">
            <PrevIcon size={32} />
          </button>
          <button
            className={styles.playButton}
            onClick={handlePlayPause}
            disabled={isBuffering}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isBuffering ? (
              <div className={styles.spinner} />
            ) : isPlaying ? (
              <PauseIcon size={36} />
            ) : (
              <PlayIcon size={36} />
            )}
          </button>
          <button className={styles.controlButton} onClick={handleNext} aria-label="Next">
            <NextIcon size={32} />
          </button>
          <button
            className={`${styles.controlButton} ${repeatMode !== 'none' ? styles.active : ''}`}
            onClick={handleRepeat}
            aria-label="Repeat"
          >
            <RepeatIcon size={24} />
            {repeatMode === 'one' && <span className={styles.repeatOne}>1</span>}
          </button>
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <button
            className={`${styles.actionButton} ${liked ? styles.liked : ''}`}
            onClick={handleLike}
            aria-label={liked ? 'Unlike' : 'Like'}
          >
            {liked ? <HeartIcon size={24} /> : <HeartOutlineIcon size={24} />}
          </button>
          <button className={styles.actionButton} onClick={handleOpenQueue} aria-label="Queue">
            <QueueIcon size={24} />
          </button>
          <button className={styles.actionButton} aria-label="More">
            <MoreIcon size={24} />
          </button>
        </div>
      </div>
    </>
  );

  return createPortal(content, document.body);
}
