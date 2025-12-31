/**
 * GenreExplorerSection - Clean genre pill selection with instant playback
 * Uses the plugin pipeline for data fetching and ML ranking
 */

import React, { useState, useCallback } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { useRecommendationStore } from '../../../stores/recommendation-store';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { usePluginData } from '../../../hooks/usePluginData';
import { BaseSectionWrapper } from './base/BaseSection';
import type { BaseSectionProps } from '../section-registry';
import type { StructuredSectionQuery } from '../types';
import {
  getParentGenres,
  type GenreNode,
} from '../../../constants/genre-taxonomy';
import { PlayIcon, MusicNoteIcon } from '@audiio/icons';

export interface GenreExplorerSectionProps extends BaseSectionProps {
  highlightedGenres?: string[];
  maxGenres?: number;
}

export const GenreExplorerSection: React.FC<GenreExplorerSectionProps> = ({
  id,
  title,
  subtitle,
  isPersonalized,
  context,
  highlightedGenres,
  maxGenres = 10,
  onSeeAll,
}) => {
  const { getTopGenres } = useRecommendationStore();
  const { play, setQueue } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();

  const [selectedGenre, setSelectedGenre] = useState<GenreNode | null>(null);

  // Get user's top genres for highlighting
  const userTopGenres = highlightedGenres ?? getTopGenres(3);
  const parentGenres = getParentGenres().slice(0, maxGenres);

  // Build structured query when a genre is selected
  const structuredQuery: StructuredSectionQuery | null = selectedGenre
    ? {
        strategy: 'plugin',
        sectionType: 'genre-explorer',
        title: selectedGenre.name,
        embedding: {
          method: 'genre',
          genre: selectedGenre.id,
          exploration: 0.4,
          includeCollaborative: true,
        },
        limit: 15,
      }
    : null;

  // Use plugin pipeline for data fetching
  const { tracks: genreTracks, isLoading } = usePluginData(structuredQuery, {
    enabled: !!selectedGenre,
    applyMLRanking: true,
    applyTransformers: true,
    limit: 15,
  });

  const handleGenreClick = useCallback((genre: GenreNode) => {
    if (selectedGenre?.id === genre.id) {
      setSelectedGenre(null);
    } else {
      setSelectedGenre(genre);
    }
  }, [selectedGenre]);

  const handlePlayAll = useCallback(() => {
    if (genreTracks.length > 0 && genreTracks[0]) {
      setQueue(genreTracks, 0);
      play(genreTracks[0]);
    }
  }, [genreTracks, setQueue, play]);

  const handleTrackClick = useCallback((track: UnifiedTrack, index: number) => {
    setQueue(genreTracks, index);
    play(track);
  }, [genreTracks, setQueue, play]);

  const isHighlighted = (genreId: string): boolean => {
    return userTopGenres.some((g) => g.toLowerCase().includes(genreId.toLowerCase()));
  };

  return (
    <BaseSectionWrapper
      id={id}
      type="genre-explorer"
      title={title}
      subtitle={subtitle}
      isPersonalized={isPersonalized}
      context={context}
      onSeeAll={onSeeAll}
      className="genre-explorer-section"
    >
      {/* Genre pills */}
      <div className="genre-pills">
        {parentGenres.map((genre) => (
          <button
            key={genre.id}
            className={`genre-pill ${selectedGenre?.id === genre.id ? 'active' : ''} ${isHighlighted(genre.id) ? 'highlighted' : ''}`}
            onClick={() => handleGenreClick(genre)}
            style={{ '--genre-color': genre.color } as React.CSSProperties}
          >
            <span
              className="genre-pill-dot"
              style={{ backgroundColor: genre.color }}
            />
            <span className="genre-pill-name">{genre.name}</span>
            {isHighlighted(genre.id) && (
              <span className="genre-pill-badge">For You</span>
            )}
          </button>
        ))}
      </div>

      {/* Selected genre tracks */}
      {selectedGenre && (
        <div className="genre-tracks-panel">
          <div className="genre-tracks-header">
            <div className="genre-tracks-info">
              <span
                className="genre-tracks-dot"
                style={{ backgroundColor: selectedGenre.color }}
              />
              <span className="genre-tracks-name">{selectedGenre.name}</span>
              {!isLoading && (
                <span className="genre-tracks-count">{genreTracks.length} tracks</span>
              )}
            </div>
            <button
              className="genre-play-btn"
              onClick={handlePlayAll}
              disabled={isLoading || genreTracks.length === 0}
            >
              <PlayIcon size={16} />
              <span>Play</span>
            </button>
          </div>

          {isLoading ? (
            <div className="genre-tracks-scroll">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="genre-track-item skeleton" />
              ))}
            </div>
          ) : genreTracks.length > 0 ? (
            <div className="genre-tracks-scroll">
              {genreTracks.map((track, index) => (
                <div
                  key={track.id}
                  className="genre-track-item"
                  onClick={() => handleTrackClick(track, index)}
                  onContextMenu={(e) => showContextMenu(e, track)}
                >
                  <div className="genre-track-artwork">
                    {track.artwork?.small ? (
                      <img src={track.artwork.small} alt={track.title} loading="lazy" />
                    ) : (
                      <div className="genre-track-placeholder">
                        <MusicNoteIcon size={16} />
                      </div>
                    )}
                    <div className="genre-track-play-overlay">
                      <PlayIcon size={14} />
                    </div>
                  </div>
                  <div className="genre-track-info">
                    <span className="genre-track-title">{track.title}</span>
                    <span className="genre-track-artist">
                      {track.artists.map((a) => a.name).join(', ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="genre-tracks-empty">
              <p>No tracks found for this genre</p>
            </div>
          )}
        </div>
      )}
    </BaseSectionWrapper>
  );
};

export default GenreExplorerSection;
