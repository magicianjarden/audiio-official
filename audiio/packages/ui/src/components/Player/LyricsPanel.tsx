import React, { useEffect, useRef, useCallback } from 'react';
import { useUIStore } from '../../stores/ui-store';
import { usePlayerStore } from '../../stores/player-store';
import { useLyricsStore } from '../../stores/lyrics-store';
import { usePluginStore } from '../../stores/plugin-store';
import { useTranslatedLyrics } from '../../hooks/useTranslatedLyrics';
import {
  CloseIcon,
  MusicNoteIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  BlockIcon,
  ExpandIcon,
  ContractIcon
} from '../Icons/Icons';
import { TranslationToggle } from './TranslationToggle';

export const LyricsPanel: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const { isLyricsPanelOpen, isLyricsPanelExpanded, closeLyricsPanel, toggleLyricsPanelExpanded } = useUIStore();
  const { currentTrack, position, seek } = usePlayerStore();
  const {
    isLoading,
    error,
    fetchLyrics,
    updateCurrentLine,
    clearLyrics
  } = useLyricsStore();

  const {
    lyrics,
    plainLyrics,
    currentLineIndex,
    nextLineIndex,
    offset,
    seekToLine,
    adjustOffset,
    resetOffset,
    translationEnabled
  } = useTranslatedLyrics();

  // Check if lyrics plugin is enabled
  const lyricsPlugin = usePluginStore(state => state.plugins.find(p => p.id === 'lrclib-lyrics'));
  const isLyricsEnabled = lyricsPlugin?.enabled ?? true;

  // Fetch lyrics when panel opens (only if plugin is enabled)
  useEffect(() => {
    if (isLyricsPanelOpen && currentTrack && isLyricsEnabled) {
      const artistName = currentTrack.artists[0]?.name || '';
      fetchLyrics(artistName, currentTrack.title, currentTrack.id);
    } else if (!isLyricsEnabled) {
      clearLyrics();
    }
  }, [isLyricsPanelOpen, currentTrack?.id, isLyricsEnabled, fetchLyrics, clearLyrics]);

  // Update current line based on position
  useEffect(() => {
    if (isLyricsPanelOpen) {
      updateCurrentLine(position);
    }
  }, [position, isLyricsPanelOpen, updateCurrentLine]);

  // Auto-scroll to active line with smooth animation
  useEffect(() => {
    if (activeLineRef.current && containerRef.current) {
      const container = containerRef.current;
      const activeLine = activeLineRef.current;

      const containerHeight = container.clientHeight;
      const lineTop = activeLine.offsetTop;
      const lineHeight = activeLine.clientHeight;

      // Scroll to position the active line at ~40% from top
      const scrollTarget = lineTop - containerHeight * 0.4 + lineHeight / 2;

      container.scrollTo({
        top: scrollTarget,
        behavior: 'smooth'
      });
    }
  }, [currentLineIndex]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isLyricsPanelOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeLyricsPanel();
      } else if (e.key === 'ArrowUp' && e.altKey) {
        // Alt+Up: Lyrics earlier (negative offset)
        adjustOffset(-200);
      } else if (e.key === 'ArrowDown' && e.altKey) {
        // Alt+Down: Lyrics later (positive offset)
        adjustOffset(200);
      } else if (e.key === '0' && e.altKey) {
        // Alt+0: Reset offset
        resetOffset();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isLyricsPanelOpen, closeLyricsPanel, adjustOffset, resetOffset]);

  const handleLineClick = useCallback((index: number) => {
    const time = seekToLine(index);
    if (time >= 0) {
      seek(time);
    }
  }, [seekToLine, seek]);

  const handleOffsetAdjust = useCallback((delta: number) => {
    adjustOffset(delta);
  }, [adjustOffset]);

  if (!isLyricsPanelOpen) return null;

  const artworkUrl = currentTrack?.artwork?.medium ?? currentTrack?.album?.artwork?.medium;

  return (
    <div className={`lyrics-panel ${isLyricsPanelExpanded ? 'expanded' : ''}`}>
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
          <TranslationToggle compact />
          <button
            className="lyrics-panel-expand"
            onClick={toggleLyricsPanelExpanded}
            title={isLyricsPanelExpanded ? 'Collapse' : 'Expand'}
          >
            {isLyricsPanelExpanded ? <ContractIcon size={18} /> : <ExpandIcon size={18} />}
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
            onClick={() => handleOffsetAdjust(-200)}
            title="Lyrics earlier (Alt+Up)"
          >
            <ChevronUpIcon size={16} />
          </button>
          <span className="lyrics-offset-value" onClick={resetOffset} title="Click to reset">
            {offset === 0 ? 'Synced' : `${offset > 0 ? '+' : ''}${offset}ms`}
          </span>
          <button
            className="lyrics-offset-button"
            onClick={() => handleOffsetAdjust(200)}
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
          <div className="lyrics-panel-synced">
            {lyrics.map((line, index) => (
              <div
                key={index}
                ref={index === currentLineIndex ? activeLineRef : null}
                className={`lyrics-panel-line ${
                  index === currentLineIndex ? 'active' : ''
                } ${index < currentLineIndex ? 'past' : ''} ${
                  index === nextLineIndex ? 'upcoming' : ''
                }`}
                onClick={() => handleLineClick(index)}
              >
                <span className="lyrics-panel-line-original">{line.text || '\u00A0'}</span>
                {translationEnabled && line.translation && (
                  <span className="lyrics-panel-line-translation">{line.translation}</span>
                )}
              </div>
            ))}
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

      {/* Current Line Preview (shows at bottom for quick reference) */}
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
