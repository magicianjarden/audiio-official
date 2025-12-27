/**
 * PlayerSheet - Native-like bottom sheet player
 *
 * Features:
 * - Drag to expand/collapse
 * - Velocity-based snap points
 * - Backdrop blur when expanded
 * - CSS transitions for smooth animations
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePlaybackState, usePlaybackControls, usePlaybackModes, usePlayerStore } from '../stores/player-store';
import { useLibraryStore } from '../stores/library-store';
import { useLyricsStore, getCurrentLyricIndex } from '../stores/lyrics-store';
import { getTrackArtwork } from '../utils/artwork';
import { triggerHaptic } from '../utils/haptics';
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
  MoreIcon,
  LyricsIcon,
} from '@audiio/icons';
import styles from './PlayerSheet.module.css';

// Velocity threshold for snap decision (pixels per ms)
const VELOCITY_THRESHOLD = 0.3;

// Mini player height
const MINI_PLAYER_HEIGHT = 64;

interface TouchState {
  startY: number;
  startTime: number;
  currentY: number;
  startExpanded: boolean;
}

export function PlayerSheet() {
  const navigate = useNavigate();
  const location = useLocation();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const touchStateRef = useRef<TouchState | null>(null);

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

  // Fetch lyrics when expanded
  useEffect(() => {
    if (isExpanded && currentTrack) {
      fetchLyrics(currentTrack);
    }
  }, [isExpanded, currentTrack?.id, fetchLyrics]);

  // Close when navigating to now-playing or lyrics page
  useEffect(() => {
    if (location.pathname === '/now-playing' || location.pathname === '/lyrics') {
      setIsExpanded(false);
    }
  }, [location.pathname]);

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStateRef.current = {
      startY: touch.clientY,
      startTime: Date.now(),
      currentY: touch.clientY,
      startExpanded: isExpanded,
    };
    setIsDragging(true);
  }, [isExpanded]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStateRef.current) return;

    const touch = e.touches[0];
    const deltaY = touch.clientY - touchStateRef.current.startY;

    touchStateRef.current.currentY = touch.clientY;

    // Calculate drag offset (positive = dragging down)
    if (isExpanded) {
      // When expanded, only allow dragging down
      setDragOffset(Math.max(0, deltaY));
    } else {
      // When collapsed, only allow dragging up (negative deltaY)
      setDragOffset(Math.min(0, deltaY));
    }
  }, [isExpanded]);

  const handleTouchEnd = useCallback(() => {
    if (!touchStateRef.current) return;

    const deltaY = touchStateRef.current.currentY - touchStateRef.current.startY;
    const deltaTime = Date.now() - touchStateRef.current.startTime;
    const velocity = deltaY / deltaTime; // pixels per ms

    // Determine if we should toggle based on velocity or distance
    const screenHeight = window.innerHeight;
    const threshold = screenHeight * 0.2; // 20% of screen height

    let shouldExpand = isExpanded;

    if (Math.abs(velocity) > VELOCITY_THRESHOLD) {
      // Fast swipe - use velocity direction
      shouldExpand = velocity < 0; // Swipe up = expand
      triggerHaptic('light');
    } else if (Math.abs(deltaY) > threshold) {
      // Slow drag past threshold
      shouldExpand = deltaY < 0; // Drag up = expand
    }

    setIsExpanded(shouldExpand);
    setDragOffset(0);
    setIsDragging(false);
    touchStateRef.current = null;
  }, [isExpanded]);

  if (!currentTrack) return null;

  const progress = duration > 0 ? (position / duration) * 100 : 0;
  const artistName = currentTrack.artists?.[0]?.name || 'Unknown Artist';
  const albumName = currentTrack.album?.name || currentTrack.album?.title;
  const artwork = getTrackArtwork(currentTrack, isExpanded ? 'large' : 'small');
  const liked = isLiked(currentTrack.id);

  const handlePlayPause = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    triggerHaptic('light');
    isPlaying ? pause() : resume();
  };

  const handleLike = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    triggerHaptic('light');
    toggleLike(currentTrack);
  };

  const handleExpand = () => {
    if (!isExpanded) {
      triggerHaptic('light');
      setIsExpanded(true);
    }
  };

  const handleCollapse = () => {
    triggerHaptic('light');
    setIsExpanded(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    seek(parseFloat(e.target.value));
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`${styles.backdrop} ${isExpanded ? styles.visible : ''}`}
        onClick={handleCollapse}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`${styles.sheet} ${isExpanded ? styles.expanded : ''}`}
        style={{
          transform: isDragging ? `translateY(${dragOffset}px)` : undefined,
          transition: isDragging ? 'none' : undefined,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag Handle */}
        <div className={styles.dragHandle}>
          <div className={styles.dragBar} />
        </div>

        {/* Content Container */}
        <div className={styles.content}>
          {/* Mini Player Row (visible when collapsed) */}
          <div
            className={`${styles.miniRow} ${isExpanded ? styles.hidden : ''}`}
            onClick={handleExpand}
          >
            {/* Progress bar at top */}
            <div className={styles.miniProgress} style={{ width: `${progress}%` }} />

            <div className={styles.miniArtwork}>
              {artwork ? (
                <img src={artwork} alt={currentTrack.title} />
              ) : (
                <div className={styles.artworkPlaceholder}>
                  <MusicNoteIcon size={20} />
                </div>
              )}
            </div>

            <div className={styles.miniInfo}>
              <span className={styles.miniTitle}>{currentTrack.title}</span>
              <span className={styles.miniArtist}>{artistName}</span>
            </div>

            <button className={styles.miniButton} onClick={handlePlayPause}>
              {isBuffering ? (
                <div className={styles.spinner} />
              ) : isPlaying ? (
                <PauseIcon size={24} />
              ) : (
                <PlayIcon size={24} />
              )}
            </button>
          </div>

          {/* Expanded Content */}
          <div className={`${styles.expandedContent} ${isExpanded ? styles.visible : ''}`}>
            {/* Header */}
            <div className={styles.header}>
              <button className={styles.headerButton} onClick={handleCollapse}>
                <ChevronDownIcon size={28} />
              </button>
              <div className={styles.headerInfo}>
                <span className={styles.headerLabel}>Playing from</span>
                <span className={styles.headerSource}>{albumName || 'Unknown'}</span>
              </div>
              <button
                className={styles.headerButton}
                onClick={() => navigate('/lyrics')}
              >
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
                onClick={() => { triggerHaptic('light'); toggleShuffle(); }}
              >
                <ShuffleIcon size={24} />
              </button>
              <button className={styles.controlButton} onClick={() => { triggerHaptic('light'); previousTrack(); }}>
                <PrevIcon size={32} />
              </button>
              <button
                className={styles.playButton}
                onClick={handlePlayPause}
                disabled={isBuffering}
              >
                {isBuffering ? (
                  <div className={styles.spinnerLarge} />
                ) : isPlaying ? (
                  <PauseIcon size={36} />
                ) : (
                  <PlayIcon size={36} />
                )}
              </button>
              <button className={styles.controlButton} onClick={() => { triggerHaptic('light'); nextTrack(); }}>
                <NextIcon size={32} />
              </button>
              <button
                className={`${styles.controlButton} ${repeatMode !== 'none' ? styles.active : ''}`}
                onClick={() => { triggerHaptic('light'); toggleRepeat(); }}
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
              >
                {liked ? <HeartIcon size={24} /> : <HeartOutlineIcon size={24} />}
              </button>
              <button
                className={styles.actionButton}
                onClick={() => navigate('/queue')}
              >
                <QueueIcon size={24} />
              </button>
              <button className={styles.actionButton}>
                <MoreIcon size={24} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
