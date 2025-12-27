/**
 * Now Playing Page - Full-screen player with gestures
 *
 * Gestures:
 * - Swipe down: Dismiss
 * - Double-tap artwork: Like/unlike
 * - Swipe artwork left/right: Next/previous track
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayerStore, usePlaybackState, usePlaybackControls, usePlaybackModes } from '../stores/player-store';
import { useLibraryStore, type DislikeReason } from '../stores/library-store';
import { useLyricsStore, getCurrentLyricIndex } from '../stores/lyrics-store';
import { useActionSheet } from '../contexts/ActionSheetContext';
import { getTrackArtwork } from '../utils/artwork';
import { DislikeModal } from '../components/DislikeModal';
import { triggerHaptic } from '../utils/haptics';

// Simple color extraction from image
async function extractDominantColor(imageUrl: string): Promise<{ primary: string; secondary: string } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }

        // Sample a small version for performance
        canvas.width = 10;
        canvas.height = 10;
        ctx.drawImage(img, 0, 0, 10, 10);

        const imageData = ctx.getImageData(0, 0, 10, 10).data;
        let r = 0, g = 0, b = 0, count = 0;

        for (let i = 0; i < imageData.length; i += 4) {
          r += imageData[i];
          g += imageData[i + 1];
          b += imageData[i + 2];
          count++;
        }

        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);

        // Create darker secondary color
        const darken = 0.6;
        const r2 = Math.round(r * darken);
        const g2 = Math.round(g * darken);
        const b2 = Math.round(b * darken);

        resolve({
          primary: `rgb(${r}, ${g}, ${b})`,
          secondary: `rgb(${r2}, ${g2}, ${b2})`
        });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
}
import {
  PlayIcon,
  PauseIcon,
  PrevIcon,
  NextIcon,
  MusicNoteIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CloseIcon,
  HeartIcon,
  HeartOutlineIcon,
  ShuffleIcon,
  RepeatIcon,
  QueueIcon,
  MoreIcon,
  LyricsIcon,
  TranslateIcon
} from '@audiio/icons';
import styles from './NowPlayingPage.module.css';

// Gesture thresholds
const SWIPE_THRESHOLD = 100;
const DOUBLE_TAP_DELAY = 300;
const LONG_PRESS_DELAY = 500;

// Hook for long-press detection
function useLongPress(
  onLongPress: () => void,
  onClick: () => void,
  delay: number = LONG_PRESS_DELAY
) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  const start = useCallback(() => {
    isLongPressRef.current = false;
    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      triggerHaptic('medium');
      onLongPress();
    }, delay);
  }, [onLongPress, delay]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const end = useCallback(() => {
    cancel();
    if (!isLongPressRef.current) {
      onClick();
    }
  }, [cancel, onClick]);

  return {
    onTouchStart: start,
    onTouchEnd: end,
    onTouchCancel: cancel,
    onMouseDown: start,
    onMouseUp: end,
    onMouseLeave: cancel,
  };
}

// Simple menu types
type MenuType = 'artist' | 'album' | null;

export function NowPlayingPage() {
  const navigate = useNavigate();
  const [showDislikeModal, setShowDislikeModal] = useState(false);
  const [showLikeAnimation, setShowLikeAnimation] = useState(false);
  const [dismissProgress, setDismissProgress] = useState(0);
  const [activeMenu, setActiveMenu] = useState<MenuType>(null);
  const [showLyrics, setShowLyrics] = useState(false);
  const [bgColors, setBgColors] = useState<{ primary: string; secondary: string } | null>(null);
  const [userScrolling, setUserScrolling] = useState(false);
  const lastTapRef = useRef<number>(0);
  const artworkRef = useRef<HTMLDivElement>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const userScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Use fine-grained selectors for performance
  const { currentTrack, isPlaying, isBuffering, position, duration } = usePlaybackState();
  const { pause, resume, seek, nextTrack, previousTrack } = usePlaybackControls();
  const { isShuffled, repeatMode } = usePlaybackModes();
  const { toggleShuffle, toggleRepeat } = usePlayerStore();

  const {
    isLiked,
    toggleLike,
    dislikeTrack,
    fetchLibrary
  } = useLibraryStore();

  const {
    lyrics,
    isLoading: isLyricsLoading,
    error: lyricsError,
    fetchLyrics,
    translationEnabled,
    isTranslating,
    toggleTranslation
  } = useLyricsStore();

  const { showTrackActions } = useActionSheet();

  // Fetch library on mount
  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  // Fetch lyrics when track changes and lyrics panel is open
  useEffect(() => {
    if (showLyrics && currentTrack) {
      fetchLyrics(currentTrack);
    }
  }, [showLyrics, currentTrack?.id, fetchLyrics]);

  // Auto-scroll lyrics to current line
  const currentLyricIndex = lyrics?.synced
    ? getCurrentLyricIndex(lyrics.synced, position)
    : -1;

  // Auto-scroll lyrics to current line (only when not user scrolling)
  useEffect(() => {
    if (currentLyricIndex >= 0 && lyricsContainerRef.current && !userScrolling) {
      const container = lyricsContainerRef.current;
      const currentLine = container.querySelector(`[data-index="${currentLyricIndex}"]`);
      if (currentLine) {
        currentLine.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
  }, [currentLyricIndex, userScrolling]);

  // Handle user scroll - pause auto-scroll for 3 seconds after user interaction
  const handleLyricsScroll = useCallback(() => {
    setUserScrolling(true);

    // Clear existing timeout
    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current);
    }

    // Resume auto-scroll after 3 seconds of no scrolling
    userScrollTimeoutRef.current = setTimeout(() => {
      setUserScrolling(false);
    }, 3000);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current);
      }
    };
  }, []);

  // Extract colors from artwork for dynamic background
  const artworkUrl = useMemo(() => getTrackArtwork(currentTrack, 'large'), [currentTrack]);

  useEffect(() => {
    if (artworkUrl) {
      extractDominantColor(artworkUrl).then(setBgColors);
    } else {
      setBgColors(null);
    }
  }, [artworkUrl]);

  // Handle double-tap to like on artwork
  const handleArtworkTap = useCallback(() => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    if (timeSinceLastTap < DOUBLE_TAP_DELAY && currentTrack) {
      // Double tap - toggle like
      triggerHaptic('medium');
      toggleLike(currentTrack);
      setShowLikeAnimation(true);
      setTimeout(() => setShowLikeAnimation(false), 600);
    }

    lastTapRef.current = now;
  }, [currentTrack, toggleLike]);

  // Swipe down to dismiss
  const [touchStart, setTouchStart] = useState<{ y: number; time: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchStart({
      y: e.touches[0].clientY,
      time: Date.now()
    });
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStart) return;

    const deltaY = e.touches[0].clientY - touchStart.y;

    if (deltaY > 0) {
      // Pulling down
      const progress = Math.min(deltaY / SWIPE_THRESHOLD, 1);
      setDismissProgress(progress);
    }
  }, [touchStart]);

  const handleTouchEnd = useCallback(() => {
    if (dismissProgress >= 0.8) {
      // Dismiss the page
      triggerHaptic('light');
      navigate(-1);
    }
    setDismissProgress(0);
    setTouchStart(null);
  }, [dismissProgress, navigate]);

  if (!currentTrack) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <p>No track playing</p>
          <button onClick={() => navigate('/search')}>Search for music</button>
        </div>
      </div>
    );
  }

  const artistName = currentTrack.artists?.[0]?.name || 'Unknown Artist';
  const albumName = currentTrack.album?.name || currentTrack.album?.title;
  const progress = duration > 0 ? (position / duration) * 100 : 0;
  const liked = isLiked(currentTrack.id);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPosition = parseFloat(e.target.value);
    seek(newPosition);
  };

  const handleLike = async () => {
    triggerHaptic('light');
    await toggleLike(currentTrack);
  };

  const handlePlayPause = () => {
    triggerHaptic('light');
    if (isPlaying) {
      pause();
    } else {
      resume();
    }
  };

  const handleDislike = () => {
    setShowDislikeModal(true);
  };

  // Navigate to artist page
  const handleArtistClick = useCallback(() => {
    if (!currentTrack?.artists?.[0]) return;
    triggerHaptic('light');
    const artist = currentTrack.artists[0];
    navigate(`/artist/${artist.id}?name=${encodeURIComponent(artist.name)}&source=${currentTrack.source || 'deezer'}`);
  }, [currentTrack, navigate]);

  // Navigate to album page
  const handleAlbumClick = useCallback(() => {
    if (!currentTrack?.album) return;
    triggerHaptic('light');
    const album = currentTrack.album;
    navigate(`/album/${album.id}?name=${encodeURIComponent(album.name || album.title || '')}&source=${currentTrack.source || 'deezer'}`);
  }, [currentTrack, navigate]);

  // Long-press handlers for artist/album menus
  const handleArtistLongPress = useCallback(() => {
    setActiveMenu('artist');
  }, []);

  const handleAlbumLongPress = useCallback(() => {
    setActiveMenu('album');
  }, []);

  const closeMenu = useCallback(() => {
    setActiveMenu(null);
  }, []);

  // Create long-press bindings
  const artistLongPress = useLongPress(handleArtistLongPress, handleArtistClick);
  const albumLongPress = useLongPress(handleAlbumLongPress, handleAlbumClick);

  // Show more options
  const handleMoreClick = useCallback(() => {
    if (!currentTrack) return;
    triggerHaptic('light');
    showTrackActions(currentTrack);
  }, [currentTrack, showTrackActions]);

  const handleDislikeSubmit = async (reasons: DislikeReason[]) => {
    await dislikeTrack(currentTrack, reasons);
    setShowDislikeModal(false);
    // Skip to next track
    nextTrack();
  };

  const getRepeatIcon = () => {
    if (repeatMode === 'one') {
      return <span className={styles.repeatOneIndicator}>1</span>;
    }
    return null;
  };

  const toggleLyricsPanel = useCallback(() => {
    triggerHaptic('light');
    setShowLyrics(prev => !prev);
  }, []);

  return (
    <div
      className={styles.container}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        '--bg-primary': bgColors?.primary || '#1a1a2e',
        '--bg-secondary': bgColors?.secondary || '#0d0d1a',
        transform: dismissProgress > 0 ? `translateY(${dismissProgress * 50}px) scale(${1 - dismissProgress * 0.05})` : undefined,
        opacity: 1 - dismissProgress * 0.3,
        transition: touchStart ? 'none' : 'all 0.3s ease-out',
      } as React.CSSProperties}
    >
      {/* Dynamic gradient background */}
      <div className={styles.gradientBg} />

      {/* Blurred artwork background */}
      {artworkUrl && <div className={styles.blurredBg} style={{ backgroundImage: `url(${artworkUrl})` }} />}

      {/* Dismiss indicator */}
      {dismissProgress > 0 && (
        <div className={styles.dismissIndicator} style={{ opacity: dismissProgress }}>
          <ChevronDownIcon size={24} />
        </div>
      )}

      {/* Header */}
      <header className={styles.header}>
        <button className={styles.headerButton} onClick={() => navigate(-1)}>
          <ChevronDownIcon size={28} />
        </button>
        <div className={styles.headerInfo}>
          <span className={styles.headerLabel}>Playing from</span>
          <span
            className={`${styles.headerSource} ${albumName ? styles.clickable : ''}`}
            onClick={albumName ? handleAlbumClick : undefined}
          >
            {albumName || 'Unknown Album'}
          </span>
        </div>
        <button
          className={`${styles.headerButton} ${showLyrics ? styles.active : ''}`}
          onClick={toggleLyricsPanel}
        >
          <LyricsIcon size={22} />
        </button>
      </header>

      {/* Artwork / Lyrics Toggle */}
      <div className={styles.artworkContainer}>
        {showLyrics ? (
          <div className={styles.lyricsPanel}>
            {/* Lyrics Header with Translation Toggle and Fullscreen */}
            <div className={styles.lyricsPanelHeader}>
              <button
                className={`${styles.translateButton} ${translationEnabled ? styles.active : ''}`}
                onClick={toggleTranslation}
                disabled={isTranslating}
                title={translationEnabled ? 'Hide translations' : 'Translate to English'}
              >
                <TranslateIcon size={18} />
                {isTranslating && <span className={styles.translatingDot} />}
              </button>
              <span
                className={styles.lyricsPanelTitle}
                onClick={() => navigate('/lyrics')}
                title="Open fullscreen lyrics"
              >
                Lyrics
              </span>
              <button
                className={styles.fullscreenButton}
                onClick={() => navigate('/lyrics')}
                title="Fullscreen lyrics"
              >
                <ChevronRightIcon size={18} />
              </button>
            </div>

            <div
              className={styles.lyricsContent}
              ref={lyricsContainerRef}
              onScroll={handleLyricsScroll}
              onTouchStart={handleLyricsScroll}
            >
              {isLyricsLoading ? (
                <div className={styles.lyricsLoading}>
                  <div className={styles.lyricsSpinner} />
                  <span>Loading lyrics...</span>
                </div>
              ) : lyricsError ? (
                <div className={styles.lyricsError}>
                  <span>{lyricsError}</span>
                </div>
              ) : lyrics?.synced ? (
                <div className={styles.syncedLyrics}>
                  {lyrics.synced.map((line, index) => (
                    <div
                      key={index}
                      data-index={index}
                      className={`${styles.lyricLineWrapper} ${index === currentLyricIndex ? styles.activeLine : ''}`}
                      onClick={() => {
                        // Convert milliseconds to seconds for seek
                        seek(line.time / 1000);
                        // Reset user scrolling so auto-scroll resumes from new position
                        setUserScrolling(false);
                      }}
                    >
                      <p className={styles.lyricLine}>{line.text || '♪'}</p>
                      {translationEnabled && line.translation && (
                        <p className={styles.lyricTranslation}>{line.translation}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : lyrics?.plain ? (
                <div className={styles.plainLyrics}>
                  {lyrics.plain.split('\n').map((line, index) => (
                    <p key={index} className={styles.lyricLine}>
                      {line || '\u00A0'}
                    </p>
                  ))}
                </div>
              ) : (
                <div className={styles.lyricsError}>
                  <span>No lyrics available</span>
                </div>
              )}
              {lyrics?.source && (
                <p className={styles.lyricsSource}>Lyrics from {lyrics.source}</p>
              )}
            </div>
          </div>
        ) : (
          <>
            <div
              ref={artworkRef}
              className={styles.artwork}
              onClick={handleArtworkTap}
            >
              {artworkUrl ? (
                <img src={artworkUrl} alt={currentTrack.title} />
              ) : (
                <div className={styles.artworkPlaceholder}>
                  <MusicNoteIcon size={64} />
                </div>
              )}

              {/* Like animation overlay */}
              {showLikeAnimation && (
                <div className={styles.likeAnimation}>
                  <HeartIcon size={80} />
                </div>
              )}
            </div>
            <p className={styles.doubleTapHint}>Double-tap to like</p>
          </>
        )}
      </div>

      {/* Footer */}
      <footer className={styles.footer}>
        {/* Track Info */}
        <div className={styles.trackInfo}>
          <h1 className={styles.trackTitle}>{currentTrack.title}</h1>
          <p className={styles.trackArtist} {...artistLongPress}>{artistName}</p>
        </div>

        {/* Progress Bar */}
        <div className={styles.progressSection}>
          <span className={styles.time}>{formatTime(position)}</span>
          <div className={styles.progressTrack}>
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={position}
              onChange={handleSeek}
              className={styles.progressBar}
              style={{ '--progress': `${progress}%` } as React.CSSProperties}
            />
          </div>
          <span className={styles.time}>{formatTime(duration)}</span>
        </div>

        {/* Controls Row - shuffle | prev | play/pause | next | repeat */}
        <div className={styles.controlsRow}>
          <button
            className={`${styles.controlButton} ${isShuffled ? styles.active : ''}`}
            onClick={toggleShuffle}
            title="Shuffle"
          >
            <ShuffleIcon size={24} />
          </button>

          <button className={styles.controlButton} onClick={previousTrack}>
            <PrevIcon size={32} />
          </button>

          <button
            className={styles.playButton}
            onClick={handlePlayPause}
            disabled={isBuffering}
          >
            {isBuffering ? (
              <div className={styles.spinner} />
            ) : isPlaying ? (
              <PauseIcon size={36} />
            ) : (
              <PlayIcon size={36} />
            )}
          </button>

          <button className={styles.controlButton} onClick={nextTrack}>
            <NextIcon size={32} />
          </button>

          <button
            className={`${styles.controlButton} ${repeatMode !== 'none' ? styles.active : ''}`}
            onClick={toggleRepeat}
            title="Repeat"
          >
            <RepeatIcon size={24} />
            {getRepeatIcon()}
          </button>
        </div>

        {/* Actions Row */}
        <div className={styles.actionsRow}>
          <button
            className={`${styles.actionButton} ${liked ? styles.liked : ''}`}
            onClick={handleLike}
            title={liked ? 'Unlike' : 'Like'}
          >
            {liked ? <HeartIcon size={24} /> : <HeartOutlineIcon size={24} />}
          </button>

          <button
            className={styles.actionButton}
            onClick={() => navigate('/queue')}
            title="Queue"
          >
            <QueueIcon size={24} />
          </button>

          <button
            className={styles.actionButton}
            onClick={handleMoreClick}
            title="More options"
          >
            <MoreIcon size={24} />
          </button>
        </div>
      </footer>

      {/* Dislike Modal */}
      <DislikeModal
        isOpen={showDislikeModal}
        trackTitle={currentTrack.title}
        trackArtist={artistName}
        onSubmit={handleDislikeSubmit}
        onClose={() => setShowDislikeModal(false)}
      />

      {/* Artist/Album Context Menu */}
      {activeMenu && (
        <div className={styles.menuOverlay} onClick={closeMenu}>
          <div className={styles.menuSheet} onClick={(e) => e.stopPropagation()}>
            <div className={styles.menuHeader}>
              <span>{activeMenu === 'artist' ? artistName : albumName}</span>
              <button className={styles.menuClose} onClick={closeMenu}>
                <CloseIcon size={20} />
              </button>
            </div>
            <div className={styles.menuOptions}>
              <button
                className={styles.menuOption}
                onClick={() => {
                  closeMenu();
                  if (activeMenu === 'artist') {
                    handleArtistClick();
                  } else {
                    handleAlbumClick();
                  }
                }}
              >
                <span>Go to {activeMenu === 'artist' ? 'Artist' : 'Album'}</span>
                <ChevronRightIcon size={20} />
              </button>
              {activeMenu === 'artist' && (
                <button
                  className={styles.menuOption}
                  onClick={() => {
                    closeMenu();
                    // Show track actions which includes "don't recommend artist"
                    showTrackActions(currentTrack);
                  }}
                >
                  <span>More Options...</span>
                  <ChevronRightIcon size={20} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
