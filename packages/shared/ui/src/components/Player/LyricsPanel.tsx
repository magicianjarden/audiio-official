/**
 * LyricsPanel - Unified lyrics experience
 *
 * Two modes:
 * 1. Sidebar mode (default): Compact panel on right side
 * 2. Full-screen mode: Immersive lyrics experience with optional vocal removal
 *
 * Full-screen works independently - vocal removal is an optional toggle.
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useUIStore } from '../../stores/ui-store';
import { usePlayerStore } from '../../stores/player-store';
import { useLyricsStore } from '../../stores/lyrics-store';
import { useTranslatedLyrics } from '../../hooks/useTranslatedLyrics';
import {
  CloseIcon,
  PlainLyricsIcon,
  SyncedLyricsIcon,
  MusicNoteIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ExpandIcon,
  ContractIcon,
  SingAlongIcon,
  PlayIcon,
  PauseIcon,
  NextIcon,
  PrevIcon
} from '@audiio/icons';
import { TranslationToggle } from './TranslationToggle';
import { SingAlongLine, SingAlongLyrics } from '../Lyrics/SingAlongLine';

// Lyrics display modes
type LyricsMode = 'synced' | 'sing-along' | 'plain';

const LYRICS_MODE_OPTIONS: { value: LyricsMode; label: string; icon: React.ReactNode }[] = [
  { value: 'synced', label: 'Synced', icon: <SyncedLyricsIcon size={16} /> },
  { value: 'sing-along', label: 'Sing-Along', icon: <SingAlongIcon size={16} /> },
  { value: 'plain', label: 'Plain', icon: <PlainLyricsIcon size={16} /> },
];

export const LyricsPanel: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

  // UI State
  const { isLyricsPanelOpen, isLyricsPanelExpanded, closeLyricsPanel, toggleLyricsPanelExpanded } = useUIStore();

  // Player State
  const { currentTrack, position, seek, isPlaying, pause, resume, next, previous } = usePlayerStore();

  // Lyrics State
  const {
    isLoading,
    error,
    fetchLyrics,
    updateCurrentLine,
    singAlongEnabled,
    setSingAlongEnabled,
    linesWithWords,
    currentWordIndex,
    getWordTimingsForLine,
    offset,
    updatePositionAtomic,
    viewMode,
    toggleViewMode
  } = useLyricsStore();

  const {
    lyrics,
    plainLyrics,
    currentLineIndex,
    nextLineIndex,
    seekToLine,
    adjustOffset,
    resetOffset,
    translationEnabled
  } = useTranslatedLyrics();

  // Lyrics mode dropdown state
  const [showLyricsModeMenu, setShowLyricsModeMenu] = useState(false);
  const lyricsModeRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showLyricsModeMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (lyricsModeRef.current && !lyricsModeRef.current.contains(e.target as Node)) {
        setShowLyricsModeMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLyricsModeMenu]);

  // Derive current lyrics mode from viewMode + singAlongEnabled
  const currentLyricsMode: LyricsMode = viewMode === 'plain' ? 'plain' : singAlongEnabled ? 'sing-along' : 'synced';

  // Handle lyrics mode change
  const handleLyricsModeChange = useCallback((mode: LyricsMode) => {
    setShowLyricsModeMenu(false);
    if (mode === 'plain') {
      // Switch to plain view (this also disables sing-along in the store)
      if (viewMode !== 'plain') toggleViewMode();
    } else if (mode === 'sing-along') {
      // Ensure synced mode and enable sing-along
      if (viewMode === 'plain') toggleViewMode();
      if (!singAlongEnabled) setSingAlongEnabled(true);
    } else {
      // Synced mode without sing-along
      if (viewMode === 'plain') toggleViewMode();
      if (singAlongEnabled) setSingAlongEnabled(false);
    }
  }, [viewMode, singAlongEnabled, toggleViewMode, setSingAlongEnabled]);

  // Get current mode icon and label
  const currentModeOption = LYRICS_MODE_OPTIONS.find(o => o.value === currentLyricsMode) || LYRICS_MODE_OPTIONS[0];

  // Ref for basic lyrics mode auto-scroll
  const basicLyricsRef = useRef<HTMLDivElement>(null);
  const basicActiveLineRef = useRef<HTMLDivElement>(null);

  // Fetch lyrics when panel opens
  useEffect(() => {
    if (isLyricsPanelOpen && currentTrack) {
      const artistName = currentTrack.artists[0]?.name || '';
      fetchLyrics(artistName, currentTrack.title, currentTrack.id);
    }
  }, [isLyricsPanelOpen, currentTrack?.id, fetchLyrics]);

  // Update current line and word atomically for smooth scrubbing
  // Using atomic update prevents visual glitches when seeking
  useEffect(() => {
    if (!isLyricsPanelOpen) return;

    // Use atomic update when sing-along is enabled for smoother scrubbing
    if (singAlongEnabled || isLyricsPanelExpanded) {
      updatePositionAtomic(position);
    } else {
      updateCurrentLine(position);
    }
  }, [position, isLyricsPanelOpen, singAlongEnabled, isLyricsPanelExpanded, updatePositionAtomic, updateCurrentLine]);

  // Auto-scroll to active line (sidebar mode)
  useEffect(() => {
    if (activeLineRef.current && containerRef.current && !isLyricsPanelExpanded) {
      const container = containerRef.current;
      const activeLine = activeLineRef.current;
      const containerHeight = container.clientHeight;
      const lineTop = activeLine.offsetTop;
      const lineHeight = activeLine.clientHeight;
      const scrollTarget = lineTop - containerHeight * 0.4 + lineHeight / 2;

      container.scrollTo({
        top: scrollTarget,
        behavior: 'smooth'
      });
    }
  }, [currentLineIndex, isLyricsPanelExpanded]);

  // Auto-scroll for fullscreen basic lyrics mode
  useEffect(() => {
    if (basicActiveLineRef.current && basicLyricsRef.current && isLyricsPanelExpanded && !singAlongEnabled) {
      const container = basicLyricsRef.current;
      const activeLine = basicActiveLineRef.current;
      const containerHeight = container.clientHeight;
      const lineTop = activeLine.offsetTop;
      const lineHeight = activeLine.clientHeight;
      const scrollTarget = lineTop - containerHeight * 0.4 + lineHeight / 2;

      container.scrollTo({
        top: scrollTarget,
        behavior: 'smooth'
      });
    }
  }, [currentLineIndex, isLyricsPanelExpanded, singAlongEnabled]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isLyricsPanelOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isLyricsPanelExpanded) {
          toggleLyricsPanelExpanded();
        } else {
          closeLyricsPanel();
        }
      } else if (e.key === ' ' && isLyricsPanelExpanded) {
        e.preventDefault();
        if (isPlaying) {
          pause();
        } else {
          resume();
        }
      } else if (e.key === 'ArrowUp' && e.altKey) {
        adjustOffset(-200);
      } else if (e.key === 'ArrowDown' && e.altKey) {
        adjustOffset(200);
      } else if (e.key === '0' && e.altKey) {
        resetOffset();
      } else if (e.key === 'ArrowRight' && isLyricsPanelExpanded) {
        next();
      } else if (e.key === 'ArrowLeft' && isLyricsPanelExpanded) {
        previous();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isLyricsPanelOpen, isLyricsPanelExpanded, closeLyricsPanel, toggleLyricsPanelExpanded, adjustOffset, resetOffset, isPlaying, pause, resume, next, previous]);

  const handleLineClick = useCallback((index: number) => {
    const time = seekToLine(index);
    if (time >= 0) {
      seek(time);
    }
  }, [seekToLine, seek]);

  const handleClose = useCallback(() => {
    if (isLyricsPanelExpanded) {
      toggleLyricsPanelExpanded();
    }
    closeLyricsPanel();
  }, [isLyricsPanelExpanded, toggleLyricsPanelExpanded, closeLyricsPanel]);

  if (!isLyricsPanelOpen) return null;

  const artworkUrl = currentTrack?.artwork?.large ?? currentTrack?.artwork?.medium ?? currentTrack?.album?.artwork?.large;

  // Full-screen lyrics mode
  if (isLyricsPanelExpanded) {
    return (
      <div className="lyrics-fullscreen">
        {/* Animated background */}
        <div
          className="lyrics-fullscreen-bg"
          style={artworkUrl ? { backgroundImage: `url(${artworkUrl})` } : undefined}
        />
        <div className="lyrics-fullscreen-overlay" />

        {/* Header */}
        <header className="lyrics-fullscreen-header">
          <button className="lyrics-fullscreen-close" onClick={handleClose} title="Close (Esc)">
            <CloseIcon size={24} />
          </button>

          <div className="lyrics-fullscreen-track">
            {artworkUrl ? (
              <img className="lyrics-fullscreen-artwork" src={artworkUrl} alt="" />
            ) : (
              <div className="lyrics-fullscreen-artwork lyrics-fullscreen-artwork-placeholder">
                <MusicNoteIcon size={24} />
              </div>
            )}
            <div className="lyrics-fullscreen-meta">
              <span className="lyrics-fullscreen-title">{currentTrack?.title || 'No track'}</span>
              <span className="lyrics-fullscreen-artist">
                {currentTrack?.artists.map(a => a.name).join(', ') || 'Unknown artist'}
              </span>
            </div>
          </div>

          {/* Fullscreen Controls - Lyrics Mode, Karaoke & Translation */}
          <div className="lyrics-fullscreen-controls">
            {/* Lyrics Mode Dropdown */}
            <div className="lyrics-mode-dropdown fullscreen" ref={lyricsModeRef}>
              <button
                className="lyrics-mode-trigger"
                onClick={() => setShowLyricsModeMenu(!showLyricsModeMenu)}
                title={`Lyrics: ${currentModeOption?.label}`}
              >
                {currentModeOption?.icon}
                <ChevronDownIcon size={12} />
              </button>
              {showLyricsModeMenu && (
                <div className="lyrics-mode-menu" onClick={(e) => e.stopPropagation()}>
                  {LYRICS_MODE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className={currentLyricsMode === opt.value ? 'active' : ''}
                      onClick={() => handleLyricsModeChange(opt.value)}
                    >
                      {opt.icon}
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Translation Toggle */}
            <TranslationToggle />

            <button
              className="lyrics-fullscreen-collapse"
              onClick={toggleLyricsPanelExpanded}
              title="Exit Full Screen"
            >
              <ContractIcon size={20} />
            </button>
          </div>
        </header>

        {/* Lyrics Display */}
        <div className="lyrics-fullscreen-content">
          {isLoading && (
            <div className="lyrics-fullscreen-message">
              <div className="lyrics-fullscreen-spinner" />
              <span>Loading lyrics...</span>
            </div>
          )}

          {!isLoading && !lyrics && !linesWithWords && (
            <div className="lyrics-fullscreen-message">
              <MusicNoteIcon size={64} />
              <span>No synced lyrics available</span>
              <span className="lyrics-fullscreen-hint">Play a track with lyrics to get started</span>
            </div>
          )}

          {/* Sing-Along Mode - Word-by-word highlighting (only in synced mode) */}
          {!isLoading && viewMode === 'synced' && singAlongEnabled && linesWithWords && linesWithWords.length > 0 && (
            <SingAlongLyrics
              linesWithWords={
                // Merge translations from lyrics into linesWithWords
                translationEnabled && lyrics
                  ? linesWithWords.map((line, i) => ({
                      ...line,
                      translation: lyrics[i]?.translation
                    }))
                  : linesWithWords
              }
              currentLineIndex={currentLineIndex}
              currentWordIndex={currentWordIndex}
              onLineClick={handleLineClick}
              showTranslations={translationEnabled}
            />
          )}

          {/* Basic Synced Lyrics Mode - Line-by-line highlighting (only in synced mode) */}
          {!isLoading && viewMode === 'synced' && !singAlongEnabled && lyrics && lyrics.length > 0 && (
            <div className="lyrics-fullscreen-basic" ref={basicLyricsRef}>
              {lyrics.map((line, index) => {
                const isActive = index === currentLineIndex;
                const isPast = index < currentLineIndex;
                const isUpcoming = index === nextLineIndex;

                return (
                  <div
                    key={index}
                    ref={isActive ? basicActiveLineRef : null}
                    className={`lyrics-fullscreen-line ${isActive ? 'active' : ''} ${isPast ? 'past' : ''} ${isUpcoming ? 'upcoming' : ''}`}
                    onClick={() => handleLineClick(index)}
                  >
                    <span className="lyrics-fullscreen-line-text">{line.text || '\u00A0'}</span>
                    {translationEnabled && line.translation && (
                      <span className="lyrics-fullscreen-line-translation">{line.translation}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Plain Lyrics Mode - Static text, no highlighting */}
          {!isLoading && viewMode === 'plain' && lyrics && lyrics.length > 0 && (
            <div className="lyrics-fullscreen-plain">
              {lyrics.map((line, index) => (
                <div key={index} className="lyrics-fullscreen-line plain">
                  <span className="lyrics-fullscreen-line-text">{line.text || '\u00A0'}</span>
                  {translationEnabled && line.translation && (
                    <span className="lyrics-fullscreen-line-translation">{line.translation}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Playback Controls */}
        <footer className="lyrics-fullscreen-footer">
          <div className="lyrics-fullscreen-playback">
            <button className="lyrics-playback-btn" onClick={previous} title="Previous">
              <PrevIcon size={28} />
            </button>
            <button className="lyrics-playback-btn play" onClick={isPlaying ? pause : resume} title={isPlaying ? 'Pause' : 'Play'}>
              {isPlaying ? <PauseIcon size={36} /> : <PlayIcon size={36} />}
            </button>
            <button className="lyrics-playback-btn" onClick={next} title="Next">
              <NextIcon size={28} />
            </button>
          </div>
        </footer>
      </div>
    );
  }

  // Sidebar mode
  return (
    <div className="lyrics-panel">
      {/* Header */}
      <header className="lyrics-panel-header">
        <div className="lyrics-panel-header-info">
          {artworkUrl ? (
            <img className="lyrics-panel-artwork" src={artworkUrl} alt="" />
          ) : (
            <div className="lyrics-panel-artwork lyrics-panel-artwork-placeholder">
              <MusicNoteIcon size={20} />
            </div>
          )}
          <div className="lyrics-panel-track-info">
            <span className="lyrics-panel-title">{currentTrack?.title || 'No track'}</span>
            <span className="lyrics-panel-artist">
              {currentTrack?.artists.map(a => a.name).join(', ') || 'Unknown artist'}
            </span>
          </div>
        </div>
        <div className="lyrics-panel-header-actions">
          {/* Lyrics Mode Dropdown */}
          {lyrics && lyrics.length > 0 && (
            <div className="lyrics-mode-dropdown" ref={lyricsModeRef}>
              <button
                className="lyrics-mode-trigger"
                onClick={() => setShowLyricsModeMenu(!showLyricsModeMenu)}
                title={`Lyrics: ${currentModeOption?.label}`}
              >
                {currentModeOption?.icon}
                <ChevronDownIcon size={12} />
              </button>
              {showLyricsModeMenu && (
                <div className="lyrics-mode-menu" onClick={(e) => e.stopPropagation()}>
                  {LYRICS_MODE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className={currentLyricsMode === opt.value ? 'active' : ''}
                      onClick={() => handleLyricsModeChange(opt.value)}
                    >
                      {opt.icon}
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <TranslationToggle compact />
          <button
            className="lyrics-panel-expand"
            onClick={toggleLyricsPanelExpanded}
            title="Full-Screen Lyrics"
          >
            <ExpandIcon size={18} />
          </button>
          <button className="lyrics-panel-close" onClick={closeLyricsPanel} title="Close (Esc)">
            <CloseIcon size={20} />
          </button>
        </div>
      </header>

      {/* Offset Controls - only show in synced mode */}
      {lyrics && lyrics.length > 0 && viewMode === 'synced' && (
        <div className="lyrics-panel-offset">
          <button
            className="lyrics-offset-button"
            onClick={() => adjustOffset(-200)}
            title="Lyrics earlier (Alt+Up)"
          >
            <ChevronUpIcon size={16} />
          </button>
          <span className="lyrics-offset-value" onClick={resetOffset} title="Click to reset">
            {offset === 0 ? 'Synced' : `${offset > 0 ? '+' : ''}${offset}ms`}
          </span>
          <button
            className="lyrics-offset-button"
            onClick={() => adjustOffset(200)}
            title="Lyrics later (Alt+Down)"
          >
            <ChevronDownIcon size={16} />
          </button>
        </div>
      )}

      {/* Lyrics Content */}
      <div className="lyrics-panel-content" ref={containerRef}>
        {isLoading && (
          <div className="lyrics-panel-state">
            <div className="lyrics-panel-spinner" />
            <span>Loading lyrics...</span>
          </div>
        )}

        {error && (
          <div className="lyrics-panel-state">
            <span className="lyrics-panel-error">{error}</span>
          </div>
        )}

        {/* Synced lyrics view - with highlighting and timing */}
        {!isLoading && !error && lyrics && lyrics.length > 0 && viewMode === 'synced' && (
          <div className={`lyrics-panel-synced ${singAlongEnabled ? 'sing-along-mode' : ''}`}>
            {lyrics.map((line, index) => {
              const isActive = index === currentLineIndex;
              const isPast = index < currentLineIndex;
              const isUpcoming = index === nextLineIndex;
              const wordTimings = singAlongEnabled ? getWordTimingsForLine(index) : [];

              return (
                <div
                  key={index}
                  ref={isActive ? activeLineRef : null}
                  className={`lyrics-panel-line ${isActive ? 'active' : ''} ${isPast ? 'past' : ''} ${isUpcoming ? 'upcoming' : ''}`}
                  onClick={() => handleLineClick(index)}
                >
                  {singAlongEnabled && wordTimings.length > 0 ? (
                    <SingAlongLine
                      words={wordTimings}
                      currentWordIndex={isActive ? currentWordIndex : isPast ? wordTimings.length : -1}
                      isActive={isActive}
                    />
                  ) : (
                    <span className="lyrics-panel-line-original">{line.text || '\u00A0'}</span>
                  )}
                  {translationEnabled && line.translation && (
                    <span className="lyrics-panel-line-translation">{line.translation}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Plain lyrics view - static text, no highlighting */}
        {!isLoading && !error && lyrics && lyrics.length > 0 && viewMode === 'plain' && (
          <div className="lyrics-panel-plain">
            {lyrics.map((line, index) => (
              <div key={index} className="lyrics-panel-line plain">
                {line.text || '\u00A0'}
                {translationEnabled && line.translation && (
                  <span className="lyrics-panel-line-translation">{line.translation}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {!isLoading && !error && !lyrics && plainLyrics && (
          <div className="lyrics-panel-plain">
            {plainLyrics.split('\n').map((line, index) => (
              <div key={index} className="lyrics-panel-line plain">
                {line || '\u00A0'}
              </div>
            ))}
          </div>
        )}

        {!isLoading && !error && !lyrics && !plainLyrics && (
          <div className="lyrics-panel-state">
            <MusicNoteIcon size={48} />
            <span>No lyrics available</span>
            <span className="lyrics-panel-hint">
              {currentTrack ? 'Lyrics not found for this track' : 'Play a track to see lyrics'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
