import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useLyricsStore } from '../../stores/lyrics-store';
import { usePluginStore } from '../../stores/plugin-store';
import { useTranslatedLyrics } from '../../hooks/useTranslatedLyrics';
import { ChevronUpIcon, ChevronDownIcon, BlockIcon } from '../Icons/Icons';
import { TranslationToggle } from './TranslationToggle';

interface LyricsDisplayProps {
  onSeek: (positionMs: number) => void;
  compact?: boolean;
}

export const LyricsDisplay: React.FC<LyricsDisplayProps> = ({ onSeek, compact = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const [userScrolling, setUserScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();

  const {
    isLoading,
    error
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

  // Detect user scrolling and temporarily disable auto-scroll
  const handleScroll = useCallback(() => {
    setUserScrolling(true);
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setUserScrolling(false);
    }, 3000); // Resume auto-scroll after 3s of no scrolling
  }, []);

  // Auto-scroll to active line (unless user is scrolling)
  useEffect(() => {
    if (userScrolling) return;
    if (activeLineRef.current && containerRef.current) {
      const container = containerRef.current;
      const activeLine = activeLineRef.current;

      // Use getBoundingClientRect for accurate positioning
      const containerRect = container.getBoundingClientRect();
      const lineRect = activeLine.getBoundingClientRect();

      // Calculate where the line currently is relative to container
      const lineRelativeTop = lineRect.top - containerRect.top + container.scrollTop;

      // Position active line at ~40% from top for better visibility
      const targetPosition = lineRelativeTop - containerRect.height * 0.4 + lineRect.height / 2;

      container.scrollTo({
        top: Math.max(0, targetPosition),
        behavior: 'smooth'
      });
    }
  }, [currentLineIndex, userScrolling]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const handleLineClick = useCallback((index: number) => {
    const time = seekToLine(index);
    if (time >= 0) {
      onSeek(time);
    }
  }, [seekToLine, onSeek]);

  // Show disabled state if lyrics plugin is off
  if (!isLyricsEnabled) {
    return (
      <div className="lyrics-display lyrics-disabled">
        <BlockIcon size={32} />
        <span>Lyrics Disabled</span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="lyrics-display lyrics-loading">
        <div className="lyrics-loading-spinner" />
        <span>Loading lyrics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="lyrics-display lyrics-error">
        <span>{error}</span>
      </div>
    );
  }

  // Show synced lyrics
  if (lyrics && lyrics.length > 0) {
    return (
      <div className={`lyrics-display lyrics-synced ${compact ? 'compact' : ''}`}>
        {/* Lyrics controls */}
        {!compact && (
          <div className="lyrics-controls">
            <div className="lyrics-offset-controls">
              <button
                className="lyrics-offset-btn"
                onClick={() => adjustOffset(-200)}
                title="Lyrics earlier"
              >
                <ChevronUpIcon size={16} />
              </button>
              <span
                className="lyrics-offset-label"
                onClick={resetOffset}
                title="Click to reset"
              >
                {offset === 0 ? 'Synced' : `${offset > 0 ? '+' : ''}${offset}ms`}
              </span>
              <button
                className="lyrics-offset-btn"
                onClick={() => adjustOffset(200)}
                title="Lyrics later"
              >
                <ChevronDownIcon size={16} />
              </button>
            </div>
            <TranslationToggle />
          </div>
        )}

        <div
          className="lyrics-scroll-container"
          ref={containerRef}
          onScroll={handleScroll}
        >
          <div className="lyrics-content">
            {lyrics.map((line, index) => (
              <div
                key={index}
                ref={index === currentLineIndex ? activeLineRef : null}
                className={`lyrics-line ${index === currentLineIndex ? 'active' : ''} ${
                  index < currentLineIndex ? 'past' : ''
                } ${index === nextLineIndex ? 'upcoming' : ''}`}
                onClick={() => handleLineClick(index)}
              >
                <span className="lyrics-line-original">{line.text || '\u00A0'}</span>
                {translationEnabled && line.translation && (
                  <span className="lyrics-line-translation">{line.translation}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Show plain lyrics as fallback
  if (plainLyrics) {
    return (
      <div className={`lyrics-display lyrics-plain ${compact ? 'compact' : ''}`} ref={containerRef}>
        <div className="lyrics-content">
          {plainLyrics.split('\n').map((line, index) => (
            <div key={index} className="lyrics-line plain">
              {line || '\u00A0'}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // No lyrics available
  return (
    <div className="lyrics-display lyrics-empty">
      <span>No lyrics available</span>
    </div>
  );
};
