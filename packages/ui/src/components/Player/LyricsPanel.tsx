/**
 * LyricsPanel - Unified lyrics experience
 *
 * Two modes:
 * 1. Sidebar mode (default): Compact panel on right side
 * 2. Full-screen mode: Immersive lyrics experience with optional vocal removal
 *
 * Full-screen works independently - vocal removal is an optional toggle.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { useUIStore } from '../../stores/ui-store';
import { usePlayerStore } from '../../stores/player-store';
import { useLyricsStore } from '../../stores/lyrics-store';
import { usePluginStore } from '../../stores/plugin-store';
import { useKaraokeStore } from '../../stores/karaoke-store';
import { useTranslatedLyrics } from '../../hooks/useTranslatedLyrics';
import {
  CloseIcon,
  MusicNoteIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  BlockIcon,
  ExpandIcon,
  ContractIcon,
  MicIcon,
  PlayIcon,
  PauseIcon,
  NextIcon,
  PrevIcon
} from '@audiio/icons';
import { TranslationToggle } from './TranslationToggle';
import { SingAlongLine, SingAlongLyrics } from '../Lyrics/SingAlongLine';

export const LyricsPanel: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

  // UI State
  const { isLyricsPanelOpen, isLyricsPanelExpanded, closeLyricsPanel, toggleLyricsPanelExpanded } = useUIStore();

  // Player State
  const { currentTrack, position, seek, isPlaying, pause, resume, next, previous } = usePlayerStore();

  // Karaoke State (Apple Music "Sing" style)
  const {
    isAvailable: karaokeAvailable,
    isEnabled: karaokeEnabled,
    isProcessing: karaokeProcessing,
    vocalReduction,
    setVocalReduction,
    toggle: toggleKaraoke
  } = useKaraokeStore();

  // Lyrics State
  const {
    isLoading,
    error,
    fetchLyrics,
    updateCurrentLine,
    clearLyrics,
    singAlongEnabled,
    setSingAlongEnabled,
    linesWithWords,
    currentWordIndex,
    updateCurrentWord,
    getWordTimingsForLine,
    offset,
    updatePositionAtomic
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

  // Check if lyrics plugin is enabled
  const lyricsPlugin = usePluginStore(state => state.plugins.find(p => p.id === 'lrclib-lyrics'));
  const isLyricsEnabled = lyricsPlugin?.enabled ?? true;

  // Ref for basic lyrics mode auto-scroll
  const basicLyricsRef = useRef<HTMLDivElement>(null);
  const basicActiveLineRef = useRef<HTMLDivElement>(null);

  // Fetch lyrics when panel opens
  useEffect(() => {
    if (isLyricsPanelOpen && currentTrack && isLyricsEnabled) {
      const artistName = currentTrack.artists[0]?.name || '';
      fetchLyrics(artistName, currentTrack.title, currentTrack.id);
    } else if (!isLyricsEnabled) {
      clearLyrics();
    }
  }, [isLyricsPanelOpen, currentTrack?.id, isLyricsEnabled, fetchLyrics, clearLyrics]);

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

  const handleVocalSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // Slider shows vocal level (0-100%), store uses reduction (inverted)
    setVocalReduction(1 - parseFloat(e.target.value));
  }, [setVocalReduction]);

  const handleClose = useCallback(() => {
    if (isLyricsPanelExpanded) {
      toggleLyricsPanelExpanded();
    }
    closeLyricsPanel();
  }, [isLyricsPanelExpanded, toggleLyricsPanelExpanded, closeLyricsPanel]);

  if (!isLyricsPanelOpen) return null;

  const artworkUrl = currentTrack?.artwork?.large ?? currentTrack?.artwork?.medium ?? currentTrack?.album?.artwork?.large;

  // Full-screen karaoke mode
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
            {/* Lyrics Mode Toggle - Switch between word-by-word and basic synced */}
            <button
              className={`lyrics-fullscreen-btn ${!singAlongEnabled ? 'active' : ''}`}
              onClick={() => setSingAlongEnabled(!singAlongEnabled)}
              title={singAlongEnabled ? 'Switch to Basic Lyrics' : 'Switch to Sing-Along Mode'}
            >
              <MusicNoteIcon size={20} />
              <span>{singAlongEnabled ? 'Sing-Along' : 'Lyrics'}</span>
            </button>

            {/* Karaoke Toggle - Apple Music "Sing" style */}
            {karaokeAvailable && (
              <>
                <button
                  className={`lyrics-fullscreen-btn ${karaokeEnabled ? 'active' : ''} ${karaokeProcessing ? 'processing' : ''}`}
                  onClick={toggleKaraoke}
                  title={karaokeEnabled ? (karaokeProcessing ? 'Processing...' : 'Disable Karaoke') : 'Enable Karaoke'}
                >
                  <MicIcon size={20} />
                  <span>{karaokeProcessing ? 'Processing...' : karaokeEnabled ? 'Sing' : 'Karaoke'}</span>
                </button>

                {karaokeEnabled && !karaokeProcessing && (
                  <div className="lyrics-fullscreen-slider karaoke-slider">
                    <label>Vocals</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={1 - vocalReduction}
                      onChange={handleVocalSliderChange}
                    />
                    <span>{Math.round((1 - vocalReduction) * 100)}%</span>
                  </div>
                )}
              </>
            )}

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
          {!isLyricsEnabled && (
            <div className="lyrics-fullscreen-message">
              <BlockIcon size={64} />
              <span>Lyrics plugin is disabled</span>
              <span className="lyrics-fullscreen-hint">Enable LRCLIB Lyrics in Settings</span>
            </div>
          )}

          {isLyricsEnabled && isLoading && (
            <div className="lyrics-fullscreen-message">
              <div className="lyrics-fullscreen-spinner" />
              <span>Loading lyrics...</span>
            </div>
          )}

          {isLyricsEnabled && !isLoading && !lyrics && !linesWithWords && (
            <div className="lyrics-fullscreen-message">
              <MusicNoteIcon size={64} />
              <span>No synced lyrics available</span>
              <span className="lyrics-fullscreen-hint">Play a track with lyrics to get started</span>
            </div>
          )}

          {/* Sing-Along Mode - Word-by-word highlighting */}
          {isLyricsEnabled && !isLoading && singAlongEnabled && linesWithWords && linesWithWords.length > 0 && (
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
              positionMs={position}
              offset={offset}
              onLineClick={handleLineClick}
              showTranslations={translationEnabled}
            />
          )}

          {/* Basic Lyrics Mode - Line-by-line highlighting (like sidebar) */}
          {isLyricsEnabled && !isLoading && !singAlongEnabled && lyrics && lyrics.length > 0 && (
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
          {lyrics && lyrics.length > 0 && (
            <button
              className={`lyrics-panel-singalong ${singAlongEnabled ? 'active' : ''}`}
              onClick={() => setSingAlongEnabled(!singAlongEnabled)}
              title={singAlongEnabled ? 'Disable Sing-Along' : 'Enable Sing-Along'}
            >
              <MicIcon size={18} />
            </button>
          )}
          <TranslationToggle compact />
          <button
            className="lyrics-panel-expand"
            onClick={toggleLyricsPanelExpanded}
            title="Full-Screen Karaoke"
          >
            <ExpandIcon size={18} />
          </button>
          <button className="lyrics-panel-close" onClick={closeLyricsPanel} title="Close (Esc)">
            <CloseIcon size={20} />
          </button>
        </div>
      </header>

      {/* Offset Controls */}
      {lyrics && lyrics.length > 0 && (
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
        {!isLyricsEnabled && (
          <div className="lyrics-panel-state">
            <BlockIcon size={48} />
            <span>Lyrics Disabled</span>
            <span className="lyrics-panel-hint">
              Enable the LRCLIB Lyrics plugin in Settings → Plugins to see lyrics
            </span>
          </div>
        )}

        {isLyricsEnabled && isLoading && (
          <div className="lyrics-panel-state">
            <div className="lyrics-panel-spinner" />
            <span>Loading lyrics...</span>
          </div>
        )}

        {isLyricsEnabled && error && (
          <div className="lyrics-panel-state">
            <span className="lyrics-panel-error">{error}</span>
          </div>
        )}

        {isLyricsEnabled && !isLoading && !error && lyrics && lyrics.length > 0 && (
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
                      positionMs={position}
                      offset={offset}
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

        {isLyricsEnabled && !isLoading && !error && !lyrics && plainLyrics && (
          <div className="lyrics-panel-plain">
            {plainLyrics.split('\n').map((line, index) => (
              <div key={index} className="lyrics-panel-line plain">
                {line || '\u00A0'}
              </div>
            ))}
          </div>
        )}

        {isLyricsEnabled && !isLoading && !error && !lyrics && !plainLyrics && (
          <div className="lyrics-panel-state">
            <MusicNoteIcon size={48} />
            <span>No lyrics available</span>
            <span className="lyrics-panel-hint">
              {currentTrack ? 'Lyrics not found for this track' : 'Play a track to see lyrics'}
            </span>
          </div>
        )}
      </div>

      {/* Current Line Preview */}
      {isLyricsEnabled && lyrics && currentLineIndex >= 0 && lyrics[currentLineIndex] && (
        <div className="lyrics-panel-current">
          <div className="lyrics-panel-current-line">
            {lyrics[currentLineIndex]?.text || '...'}
          </div>
          {nextLineIndex >= 0 && lyrics[nextLineIndex] && (
            <div className="lyrics-panel-next-line">
              {lyrics[nextLineIndex]?.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
