/**
 * Full-Screen Lyrics Page
 *
 * Immersive lyrics experience similar to desktop karaoke mode.
 * - Auto-scroll with current line highlighting
 * - Translation toggle
 * - Tap to seek
 * - Background from album artwork
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayerStore, usePlaybackState, usePlaybackControls } from '../stores/player-store';
import { useLyricsStore, getCurrentLyricIndex } from '../stores/lyrics-store';
import { getTrackArtwork } from '../utils/artwork';
import { triggerHaptic } from '../utils/haptics';
import {
  ChevronDownIcon,
  PlayIcon,
  PauseIcon,
  PrevIcon,
  NextIcon,
  TranslateIcon
} from '@audiio/icons';
import styles from './LyricsPage.module.css';

// Extract dominant color from image
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
        const darken = 0.4;
        resolve({
          primary: `rgb(${r}, ${g}, ${b})`,
          secondary: `rgb(${Math.round(r * darken)}, ${Math.round(g * darken)}, ${Math.round(b * darken)})`
        });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
}

export function LyricsPage() {
  const navigate = useNavigate();
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const [userScrolling, setUserScrolling] = useState(false);
  const [bgColors, setBgColors] = useState<{ primary: string; secondary: string } | null>(null);
  const userScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Player state
  const { currentTrack, isPlaying, position } = usePlaybackState();
  const { pause, resume, seek, nextTrack, previousTrack } = usePlaybackControls();

  // Lyrics state
  const {
    lyrics,
    isLoading,
    error,
    fetchLyrics,
    translationEnabled,
    isTranslating,
    translationError,
    toggleTranslation
  } = useLyricsStore();

  // Fetch lyrics on mount
  useEffect(() => {
    if (currentTrack) {
      fetchLyrics(currentTrack);
    }
  }, [currentTrack?.id, fetchLyrics]);

  // Extract colors from artwork
  const artworkUrl = currentTrack ? getTrackArtwork(currentTrack, 'large') : null;

  useEffect(() => {
    if (artworkUrl) {
      extractDominantColor(artworkUrl).then(setBgColors);
    }
  }, [artworkUrl]);

  // Current lyric index
  const currentLyricIndex = lyrics?.synced
    ? getCurrentLyricIndex(lyrics.synced, position)
    : -1;

  // Auto-scroll to current lyric
  useEffect(() => {
    if (currentLyricIndex >= 0 && lyricsContainerRef.current && !userScrolling) {
      const container = lyricsContainerRef.current;
      const currentLine = container.querySelector(`[data-index="${currentLyricIndex}"]`) as HTMLElement;
      if (currentLine) {
        const containerHeight = container.clientHeight;
        const lineTop = currentLine.offsetTop;
        const lineHeight = currentLine.clientHeight;
        // Scroll to put current line at ~40% from top
        const scrollTo = lineTop - (containerHeight * 0.4) + (lineHeight / 2);
        container.scrollTo({
          top: scrollTo,
          behavior: 'smooth'
        });
      }
    }
  }, [currentLyricIndex, userScrolling]);

  // Handle user scroll
  const handleScroll = useCallback(() => {
    setUserScrolling(true);
    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current);
    }
    userScrollTimeoutRef.current = setTimeout(() => {
      setUserScrolling(false);
    }, 3000);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current);
      }
    };
  }, []);

  // Handle line click to seek
  const handleLineClick = useCallback((timeMs: number) => {
    triggerHaptic('light');
    seek(timeMs / 1000);
    setUserScrolling(false);
  }, [seek]);

  // Play/pause toggle
  const handlePlayPause = useCallback(() => {
    triggerHaptic('light');
    if (isPlaying) {
      pause();
    } else {
      resume();
    }
  }, [isPlaying, pause, resume]);

  if (!currentTrack) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <p>No track playing</p>
          <button onClick={() => navigate(-1)}>Go Back</button>
        </div>
      </div>
    );
  }

  const artistName = currentTrack.artists?.[0]?.name || 'Unknown Artist';

  return (
    <div
      className={styles.container}
      style={{
        '--bg-primary': bgColors?.primary || '#1a1a2e',
        '--bg-secondary': bgColors?.secondary || '#0d0d1a',
      } as React.CSSProperties}
    >
      {/* Gradient background */}
      <div className={styles.gradientBg} />

      {/* Blurred artwork background */}
      {artworkUrl && (
        <div
          className={styles.blurredBg}
          style={{ backgroundImage: `url(${artworkUrl})` }}
        />
      )}

      {/* Header */}
      <header className={styles.header}>
        <button className={styles.headerButton} onClick={() => navigate(-1)}>
          <ChevronDownIcon size={28} />
        </button>
        <div className={styles.trackInfo}>
          <span className={styles.trackTitle}>{currentTrack.title}</span>
          <span className={styles.trackArtist}>{artistName}</span>
        </div>
        <button
          className={`${styles.headerButton} ${translationEnabled ? styles.active : ''}`}
          onClick={toggleTranslation}
          disabled={isTranslating}
        >
          <TranslateIcon size={22} />
          {isTranslating && <span className={styles.translatingDot} />}
        </button>
      </header>

      {/* Translation error toast */}
      {translationError && (
        <div className={styles.errorToast}>
          {translationError}
        </div>
      )}

      {/* Lyrics Content */}
      <div
        className={styles.lyricsContainer}
        ref={lyricsContainerRef}
        onScroll={handleScroll}
        onTouchStart={handleScroll}
      >
        {isLoading ? (
          <div className={styles.centered}>
            <div className={styles.spinner} />
            <span>Loading lyrics...</span>
          </div>
        ) : error ? (
          <div className={styles.centered}>
            <span className={styles.error}>{error}</span>
          </div>
        ) : lyrics?.synced ? (
          <div className={styles.syncedLyrics}>
            {/* Spacer for initial scroll position */}
            <div className={styles.spacer} />

            {lyrics.synced.map((line, index) => (
              <div
                key={index}
                data-index={index}
                className={`${styles.lyricLine} ${index === currentLyricIndex ? styles.active : ''} ${index < currentLyricIndex ? styles.past : ''}`}
                onClick={() => handleLineClick(line.time)}
              >
                <p className={styles.originalText}>{line.text || '\u266A'}</p>
                {translationEnabled && line.translation && (
                  <p className={styles.translationText}>{line.translation}</p>
                )}
              </div>
            ))}

            {/* Spacer for end scroll position */}
            <div className={styles.spacer} />

            {/* Source attribution */}
            {lyrics.source && (
              <p className={styles.source}>Lyrics from {lyrics.source}</p>
            )}
          </div>
        ) : lyrics?.plain ? (
          <div className={styles.plainLyrics}>
            {lyrics.plain.split('\n').map((line, index) => (
              <p key={index} className={styles.plainLine}>
                {line || '\u00A0'}
              </p>
            ))}
          </div>
        ) : (
          <div className={styles.centered}>
            <span>No lyrics available</span>
          </div>
        )}
      </div>

      {/* Mini Controls */}
      <footer className={styles.footer}>
        <button className={styles.controlButton} onClick={previousTrack}>
          <PrevIcon size={24} />
        </button>
        <button className={styles.playButton} onClick={handlePlayPause}>
          {isPlaying ? <PauseIcon size={28} /> : <PlayIcon size={28} />}
        </button>
        <button className={styles.controlButton} onClick={nextTrack}>
          <NextIcon size={24} />
        </button>
      </footer>
    </div>
  );
}
