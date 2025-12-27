/**
 * SingAlongLine - Renders a lyric line with word-by-word highlighting
 *
 * Words are highlighted progressively as the song plays, creating
 * a karaoke-style sing-along experience.
 */

import React, { useMemo } from 'react';
import type { WordTiming } from '../../stores/lyrics-store';
import './SingAlongLine.css';

interface SingAlongLineProps {
  words: WordTiming[];
  currentWordIndex: number;
  isActive: boolean;
  positionMs: number;
  offset: number;
}

interface WordProps {
  word: string;
  isHighlighted: boolean;
  isPast: boolean;
  isNext: boolean; // Next word to be sung
  progress: number; // 0-1, for partial word highlighting
  isTransitionStart: boolean; // First frame of transition
}

const Word: React.FC<WordProps> = ({ word, isHighlighted, isPast, isNext, progress, isTransitionStart }) => {
  const isTransitioning = isHighlighted && progress > 0 && progress < 1;

  const className = [
    'sing-along-word',
    isHighlighted && !isTransitioning && 'highlighted',
    isPast && 'past',
    isNext && 'next-word',
    isTransitioning && 'transitioning',
    isTransitionStart && 'transitioning-start'
  ].filter(Boolean).join(' ');

  // For smoother effect, use CSS gradient to fill word progressively
  const style = isTransitioning
    ? {
        '--word-progress': `${Math.round(progress * 100)}%`
      } as React.CSSProperties
    : undefined;

  return (
    <span className={className} style={style}>
      {word}
    </span>
  );
};

export const SingAlongLine: React.FC<SingAlongLineProps> = ({
  words,
  currentWordIndex,
  isActive,
  positionMs,
  offset
}) => {
  const adjustedPosition = positionMs + offset;
  const prevWordIndexRef = React.useRef<number>(-1);

  // Track if we just started a new word (for entrance animation)
  const isNewWord = prevWordIndexRef.current !== currentWordIndex;
  React.useEffect(() => {
    prevWordIndexRef.current = currentWordIndex;
  }, [currentWordIndex]);

  // Calculate word states with improved timing
  const wordStates = useMemo(() => {
    return words.map((wordTiming, index) => {
      const isPast = index < currentWordIndex;
      const isHighlighted = index === currentWordIndex;
      const isNext = index === currentWordIndex + 1;

      // Calculate progress within the current word (0-1)
      let progress = 0;
      if (isHighlighted && wordTiming.startTime < wordTiming.endTime) {
        const elapsed = adjustedPosition - wordTiming.startTime;
        const duration = wordTiming.endTime - wordTiming.startTime;

        // Use eased progress for smoother visual timing
        // Apply slight ease-out for more natural feel
        const rawProgress = Math.max(0, Math.min(1, elapsed / duration));
        progress = easeOutQuad(rawProgress);
      } else if (isPast) {
        progress = 1;
      }

      return {
        word: wordTiming.word,
        isHighlighted,
        isPast,
        isNext,
        progress,
        isTransitionStart: isHighlighted && isNewWord && progress < 0.1
      };
    });
  }, [words, currentWordIndex, adjustedPosition, isNewWord]);

  // Easing function for smoother progress
  function easeOutQuad(t: number): number {
    return t * (2 - t);
  }

  if (words.length === 0) {
    return null;
  }

  return (
    <div className={`sing-along-line ${isActive ? 'active' : ''}`}>
      {wordStates.map((state, index) => (
        <React.Fragment key={index}>
          <Word {...state} />
          {index < wordStates.length - 1 && <span className="sing-along-space"> </span>}
        </React.Fragment>
      ))}
    </div>
  );
};

/**
 * SingAlongLyrics - Full lyrics display with sing-along highlighting and autoscroll
 */
interface SingAlongLyricsProps {
  linesWithWords: Array<{ time: number; text: string; words: WordTiming[]; translation?: string }>;
  currentLineIndex: number;
  currentWordIndex: number;
  positionMs: number;
  offset: number;
  onLineClick?: (index: number) => void;
  showTranslations?: boolean;
}

export const SingAlongLyrics: React.FC<SingAlongLyricsProps> = ({
  linesWithWords,
  currentLineIndex,
  currentWordIndex,
  positionMs,
  offset,
  onLineClick,
  showTranslations = false
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const activeLineRef = React.useRef<HTMLDivElement>(null);

  // Autoscroll to active line with smooth animation
  React.useEffect(() => {
    if (!activeLineRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const activeLine = activeLineRef.current;

    // Calculate scroll position to center the active line
    const containerHeight = container.clientHeight;
    const lineTop = activeLine.offsetTop;
    const lineHeight = activeLine.clientHeight;
    const scrollTarget = lineTop - (containerHeight / 2) + (lineHeight / 2);

    // Smooth scroll with easing
    container.scrollTo({
      top: Math.max(0, scrollTarget),
      behavior: 'smooth'
    });
  }, [currentLineIndex]);

  return (
    <div className="sing-along-lyrics" ref={containerRef}>
      {linesWithWords.map((line, index) => {
        const isActive = index === currentLineIndex;
        const isPast = index < currentLineIndex;
        const isFuture = index > currentLineIndex;

        return (
          <div
            key={index}
            ref={isActive ? activeLineRef : null}
            className={`sing-along-lyrics-line ${isActive ? 'active' : ''} ${isPast ? 'past' : ''} ${isFuture ? 'future' : ''}`}
            onClick={() => onLineClick?.(index)}
          >
            <div className="sing-along-lyrics-original">
              {line.words.length > 0 ? (
                <SingAlongLine
                  words={line.words}
                  currentWordIndex={isActive ? currentWordIndex : isPast ? line.words.length : -1}
                  isActive={isActive}
                  positionMs={positionMs}
                  offset={offset}
                />
              ) : (
                <span className="sing-along-empty-line">{line.text || '♪'}</span>
              )}
            </div>
            {showTranslations && line.translation && (
              <div className="sing-along-lyrics-translation">
                {line.translation}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default SingAlongLine;
