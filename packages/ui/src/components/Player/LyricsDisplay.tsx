import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useLyricsStore } from '../../stores/lyrics-store';
import { usePluginStore } from '../../stores/plugin-store';
import { usePlayerStore } from '../../stores/player-store';
import { useTranslatedLyrics } from '../../hooks/useTranslatedLyrics';
import { ChevronUpIcon, ChevronDownIcon, BlockIcon, SingAlongIcon } from '@audiio/icons';
import { TranslationToggle } from './TranslationToggle';
import { SingAlongLine } from '../Lyrics/SingAlongLine';

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
    error,
    singAlongEnabled,
    setSingAlongEnabled,
    currentWordIndex,
    getWordTimingsForLine
  } = useLyricsStore();

  const { position } = usePlayerStore();

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

  // Check if any lyrics provider is enabled
  const isLyricsEnabled = usePluginStore(state => state.hasCapability('lyrics-provider'));

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
      <div className={`lyrics-display lyrics-synced ${compact ? 'compact' : ''} ${singAlongEnabled ? 'sing-along-mode' : ''}`}>
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
            <button
              className={`lyrics-singalong-btn ${singAlongEnabled ? 'active' : ''}`}
              onClick={() => setSingAlongEnabled(!singAlongEnabled)}
              title={singAlongEnabled ? 'Disable Sing-Along' : 'Enable Sing-Along'}
            >
              <SingAlongIcon size={16} />
            </button>
            <TranslationToggle />
          </div>
        )}

        <div
          className="lyrics-scroll-container"
          ref={containerRef}
          onScroll={handleScroll}
        >
          <div className="lyrics-content">
            {lyrics.map((line, index) => {
              const isActive = index === currentLineIndex;
              const isPast = index < currentLineIndex;
              const isUpcoming = index === nextLineIndex;
              const wordTimings = singAlongEnabled ? getWordTimingsForLine(index) : [];

              return (
                <div
                  key={index}
                  ref={isActive ? activeLineRef : null}
                  className={`lyrics-line ${isActive ? 'active' : ''} ${isPast ? 'past' : ''} ${isUpcoming ? 'upcoming' : ''}`}
                  onClick={() => handleLineClick(index)}
                >
                  {singAlongEnabled && wordTimings.length > 0 ? (
                    <SingAlongLine
                      words={wordTimings}
                      currentWordIndex={isActive ? currentWordIndex : isPast ? wordTimings.length : -1}
                      isActive={isActive}
                    />
                  ) : (
                    <span className="lyrics-line-original">{line.text || '\u00A0'}</span>
                  )}
                  {translationEnabled && line.translation && (
                    <span className="lyrics-line-translation">{line.translation}</span>
                  )}
                </div>
              );
            })}
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
