/**
 * LyricsHighlightSection - Quote cards featuring lyrics with artwork backdrop
 * Displays memorable lyrics from trending/personalized tracks
 */

import React, { useState, useEffect } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { usePlayerStore } from '../../../stores/player-store';
import { usePluginStore } from '../../../stores/plugin-store';
import { BaseSectionWrapper, useSectionTracks } from './base/BaseSection';
import type { BaseSectionProps } from '../section-registry';
import { PlayIcon, MusicNoteIcon, QuoteIcon } from '@audiio/icons';

export interface LyricsQuote {
  trackId: string;
  track: UnifiedTrack;
  line: string;
  startTime?: number; // For synced lyrics
}

export interface LyricsHighlightSectionProps extends BaseSectionProps {
  quotes?: LyricsQuote[];
}

// Sample lyrics for demo when lyrics API isn't available
const SAMPLE_QUOTES = [
  "Just keep swimming through the waves",
  "Dancing in the moonlight tonight",
  "We're all just searching for a feeling",
  "Every ending is a new beginning",
  "The rhythm takes control of me",
];

export const LyricsHighlightSection: React.FC<LyricsHighlightSectionProps> = ({
  id,
  title,
  subtitle,
  query,
  isPersonalized,
  context,
  quotes: propQuotes,
  onSeeAll,
}) => {
  const { play, setQueue, currentTrack, isPlaying } = usePlayerStore();
  const { getPlugin } = usePluginStore();

  // Check if lyrics addon is enabled
  const lyricsPlugin = getPlugin('lrclib-lyrics');
  const hasLyrics = lyricsPlugin?.enabled ?? false;

  // Fetch tracks if no quotes provided
  const { tracks, isLoading, error } = useSectionTracks(
    propQuotes ? undefined : query,
    { limit: 4 }
  );

  const [quotes, setQuotes] = useState<LyricsQuote[]>(propQuotes ?? []);

  // Generate demo quotes from tracks when no real lyrics available
  useEffect(() => {
    if (propQuotes || tracks.length === 0) return;

    // In a real implementation, this would fetch lyrics from the lrclib addon
    // For now, use sample quotes with track data
    const generatedQuotes: LyricsQuote[] = tracks.slice(0, 4).map((track, i) => ({
      trackId: track.id,
      track,
      line: SAMPLE_QUOTES[i % SAMPLE_QUOTES.length],
    }));

    setQuotes(generatedQuotes);
  }, [propQuotes, tracks]);

  const handleQuoteClick = (quote: LyricsQuote) => {
    const allTracks = quotes.map((q) => q.track);
    setQueue(allTracks, allTracks.indexOf(quote.track));
    play(quote.track);
  };

  if (!isLoading && quotes.length === 0) {
    return null;
  }

  return (
    <BaseSectionWrapper
      id={id}
      type="lyrics-highlight"
      title={title}
      subtitle={subtitle}
      isPersonalized={isPersonalized}
      isLoading={isLoading}
      error={error}
      context={context}
      onSeeAll={onSeeAll}
      className="lyrics-highlight-section"
    >
      <div className="lyrics-grid">
        {quotes.map((quote, index) => (
          <LyricsCard
            key={quote.trackId}
            quote={quote}
            index={index}
            isPlaying={currentTrack?.id === quote.trackId && isPlaying}
            onClick={() => handleQuoteClick(quote)}
          />
        ))}
      </div>
    </BaseSectionWrapper>
  );
};

interface LyricsCardProps {
  quote: LyricsQuote;
  index: number;
  isPlaying: boolean;
  onClick: () => void;
}

const LyricsCard: React.FC<LyricsCardProps> = ({
  quote,
  index,
  isPlaying,
  onClick,
}) => {
  const { track, line } = quote;
  const artwork = track.artwork?.large ?? track.artwork?.medium;

  return (
    <div
      className={`lyrics-card ${isPlaying ? 'playing' : ''}`}
      style={{ animationDelay: `${index * 100}ms` }}
      onClick={onClick}
    >
      {/* Background artwork with blur */}
      <div className="lyrics-card-bg">
        {artwork ? (
          <img src={artwork} alt="" aria-hidden="true" />
        ) : (
          <div className="lyrics-card-bg-placeholder" />
        )}
        <div className="lyrics-card-bg-overlay" />
      </div>

      {/* Content */}
      <div className="lyrics-card-content">
        <QuoteIcon size={24} className="lyrics-quote-icon" />

        <blockquote className="lyrics-quote">
          "{line}"
        </blockquote>

        <div className="lyrics-card-track">
          <div className="lyrics-track-artwork">
            {artwork ? (
              <img src={artwork} alt={track.title} />
            ) : (
              <MusicNoteIcon size={16} />
            )}
          </div>

          <div className="lyrics-track-info">
            <span className="lyrics-track-title">{track.title}</span>
            <span className="lyrics-track-artist">
              {track.artists.map((a) => a.name).join(', ')}
            </span>
          </div>
        </div>

        <button className="lyrics-card-play">
          <PlayIcon size={20} />
        </button>

        {isPlaying && (
          <div className="lyrics-card-playing">
            <span className="playing-bar" />
            <span className="playing-bar" />
            <span className="playing-bar" />
          </div>
        )}
      </div>
    </div>
  );
};

export default LyricsHighlightSection;
