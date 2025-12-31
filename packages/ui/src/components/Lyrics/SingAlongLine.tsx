/**
 * SingAlongLine - Modern karaoke-style word highlighting
 *
 * Performance optimizations:
 * - CSS-driven animations (not JS frame updates)
 * - GPU-accelerated properties (transform, opacity, clip-path)
 * - Re-renders only on word/line changes, not every position tick
 * - Uses CSS custom properties for dynamic durations
 *
 * Visual enhancements:
 * - Gradient fill animation for smooth highlighting
 * - Held note pulsing for sustained words
 * - Spring physics easing for natural motion
 * - Line-level entrance animations
 */

import React, { memo, useCallback } from 'react';
import type { WordTiming } from '../../stores/lyrics-store';
import './SingAlongLine.css';

// Thresholds for held note detection (in ms)
const HELD_NOTE_THRESHOLD = 800; // Words longer than this get held animation
const HELD_LONG_THRESHOLD = 1500; // Words longer than this get long held animation

interface SingAlongLineProps {
  words: WordTiming[];
  currentWordIndex: number;
  isActive: boolean;
}

interface WordProps {
  word: string;
  state: 'upcoming' | 'active' | 'sung';
  isNext?: boolean; // Next word to be sung (for anticipation glow)
  duration?: number; // ms, for active word animation
  isLastInLine?: boolean; // Last word often held longer
}

/**
 * Detect if a word should have held note animation
 * Based on duration and position in line
 */
function getHeldState(duration: number | undefined, isLastInLine: boolean): 'none' | 'held' | 'held-long' {
  if (!duration) return 'none';

  // Last words in line are more likely to be held
  const threshold = isLastInLine ? HELD_NOTE_THRESHOLD * 0.7 : HELD_NOTE_THRESHOLD;
  const longThreshold = isLastInLine ? HELD_LONG_THRESHOLD * 0.8 : HELD_LONG_THRESHOLD;

  if (duration >= longThreshold) return 'held-long';
  if (duration >= threshold) return 'held';
  return 'none';
}

/**
 * Individual word with CSS-driven animation
 * The fill animation is handled entirely by CSS @keyframes
 *
 * Key: We render the fill overlay on BOTH active and sung words
 * to prevent flicker when transitioning between words.
 */
const Word = memo<WordProps>(({ word, state, isNext, duration, isLastInLine = false }) => {
  const style = state === 'active' && duration
    ? { '--word-duration': `${duration}ms` } as React.CSSProperties
    : undefined;

  // Determine held state for active words
  const heldState = state === 'active' ? getHeldState(duration, isLastInLine) : 'none';

  const className = [
    'sal-word',
    `sal-word--${state}`,
    isNext && 'sal-word--next',
    heldState === 'held' && 'sal-word--held',
    heldState === 'held-long' && 'sal-word--held-long'
  ].filter(Boolean).join(' ');

  // Render fill on active AND sung words to prevent flicker
  const showFill = state === 'active' || state === 'sung';

  return (
    <span className={className} style={style}>
      <span className="sal-word__text">{word}</span>
      {showFill && <span className="sal-word__fill">{word}</span>}
    </span>
  );
});

Word.displayName = 'Word';

/**
 * Single line of lyrics with word-by-word highlighting
 */
export const SingAlongLine = memo<SingAlongLineProps>(({
  words,
  currentWordIndex,
  isActive
}) => {
  if (words.length === 0) return null;

  return (
    <div className={`sal-line ${isActive ? 'sal-line--active' : ''}`}>
      {words.map((wordTiming, index) => {
        let state: 'upcoming' | 'active' | 'sung';
        if (index < currentWordIndex) {
          state = 'sung';
        } else if (index === currentWordIndex) {
          state = 'active';
        } else {
          state = 'upcoming';
        }

        // Next word gets anticipation styling
        const isNext = index === currentWordIndex + 1;

        // Last word in line - often held longer in singing
        const isLastInLine = index === words.length - 1;

        const duration = state === 'active'
          ? wordTiming.endTime - wordTiming.startTime
          : undefined;

        return (
          <React.Fragment key={index}>
            <Word
              word={wordTiming.word}
              state={state}
              isNext={isNext}
              duration={duration}
              isLastInLine={isLastInLine}
            />
            {index < words.length - 1 && ' '}
          </React.Fragment>
        );
      })}
    </div>
  );
});

SingAlongLine.displayName = 'SingAlongLine';

/**
 * Full lyrics container with auto-scrolling
 */
interface SingAlongLyricsProps {
  linesWithWords: Array<{
    time: number;
    text: string;
    words: WordTiming[];
    translation?: string;
  }>;
  currentLineIndex: number;
  currentWordIndex: number;
  onLineClick?: (index: number) => void;
  showTranslations?: boolean;
}

export const SingAlongLyrics = memo<SingAlongLyricsProps>(({
  linesWithWords,
  currentLineIndex,
  currentWordIndex,
  onLineClick,
  showTranslations = false
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const activeLineRef = React.useRef<HTMLDivElement>(null);

  // Smooth scroll to active line
  React.useEffect(() => {
    if (!activeLineRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const activeLine = activeLineRef.current;
    const containerHeight = container.clientHeight;
    const lineTop = activeLine.offsetTop;
    const lineHeight = activeLine.clientHeight;

    // Center the active line
    const scrollTarget = lineTop - (containerHeight / 2) + (lineHeight / 2);

    container.scrollTo({
      top: Math.max(0, scrollTarget),
      behavior: 'smooth'
    });
  }, [currentLineIndex]);

  const handleLineClick = useCallback((index: number) => {
    onLineClick?.(index);
  }, [onLineClick]);

  return (
    <div className="sal-container" ref={containerRef}>
      <div className="sal-lyrics">
        {linesWithWords.map((line, index) => {
          const isActive = index === currentLineIndex;
          const isPast = index < currentLineIndex;

          // Determine line state
          let lineState: 'past' | 'active' | 'upcoming';
          if (isPast) lineState = 'past';
          else if (isActive) lineState = 'active';
          else lineState = 'upcoming';

          // For past lines, all words are sung
          // For active line, use currentWordIndex
          // For upcoming lines, no words are sung
          const wordIndex = isPast ? line.words.length : (isActive ? currentWordIndex : -1);

          return (
            <div
              key={index}
              ref={isActive ? activeLineRef : null}
              className={`sal-lyrics__line sal-lyrics__line--${lineState}`}
              onClick={() => handleLineClick(index)}
            >
              {line.words.length > 0 ? (
                <SingAlongLine
                  words={line.words}
                  currentWordIndex={wordIndex}
                  isActive={isActive}
                />
              ) : (
                <span className="sal-lyrics__instrumental">♪</span>
              )}
              {showTranslations && line.translation && (
                <div className="sal-lyrics__translation">
                  {line.translation}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

SingAlongLyrics.displayName = 'SingAlongLyrics';

export default SingAlongLine;
