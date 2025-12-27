/**
 * GenreExplorerSection - Visual genre tiles with nested sub-genres
 * Allows users to explore and discover music by genre
 * Uses embedding-based playlist generation for inline track results
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { useRecommendationStore } from '../../../stores/recommendation-store';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { useEmbeddingPlaylist } from '../../../hooks/useEmbeddingPlaylist';
import { BaseSectionWrapper } from './base/BaseSection';
import type { BaseSectionProps } from '../section-registry';
import {
  getParentGenres,
  getChildGenres,
  type GenreNode,
} from '../../../constants/genre-taxonomy';
import { ChevronRightIcon, ChevronDownIcon, PlayIcon, MusicNoteIcon } from '@audiio/icons';
import { debugLog } from '../../../utils/debug';

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
  maxGenres = 8,
  onSeeAll,
}) => {
  const { getTopGenres } = useRecommendationStore();
  const { play, setQueue } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();

  const [expandedGenre, setExpandedGenre] = useState<string | null>(null);
  const [inlineGenre, setInlineGenre] = useState<GenreNode | null>(null);

  // Embedding-based playlist generation
  const {
    generateGenrePlaylist,
    getTracksFromPlaylist,
    isReady: embeddingReady,
    tracksIndexed,
  } = useEmbeddingPlaylist();

  // Get user's top genres for highlighting
  const userTopGenres = highlightedGenres ?? getTopGenres(3);
  const parentGenres = getParentGenres().slice(0, maxGenres);

  // Generate inline tracks using embedding when a genre is selected
  const inlineTracks = useMemo(() => {
    if (!inlineGenre || !embeddingReady || tracksIndexed < 5) {
      return [];
    }

    const playlist = generateGenrePlaylist(inlineGenre.id, { limit: 12 });
    if (!playlist || playlist.tracks.length === 0) {
      return [];
    }

    debugLog(
      '[GenreExplorer]',
      `Using embedding for "${inlineGenre.name}" (${playlist.tracks.length} tracks)`
    );
    return getTracksFromPlaylist(playlist);
  }, [inlineGenre, embeddingReady, tracksIndexed, generateGenrePlaylist, getTracksFromPlaylist]);

  const handleGenreClick = useCallback((genre: GenreNode) => {
    if (genre.children && genre.children.length > 0) {
      // Toggle expansion for parent genres
      setExpandedGenre(expandedGenre === genre.id ? null : genre.id);
      setInlineGenre(null);
    } else {
      // For leaf genres, show inline results using embedding
      setInlineGenre(inlineGenre?.id === genre.id ? null : genre);
      setExpandedGenre(null);
    }
  }, [expandedGenre, inlineGenre]);

  const handleSubgenreClick = useCallback((genre: GenreNode) => {
    // For subgenres, show inline results using embedding
    setInlineGenre(inlineGenre?.id === genre.id ? null : genre);
    setExpandedGenre(null);
  }, [inlineGenre]);

  const handlePlayInline = useCallback(() => {
    if (inlineTracks.length > 0 && inlineTracks[0]) {
      setQueue(inlineTracks, 0);
      play(inlineTracks[0]);
    }
  }, [inlineTracks, setQueue, play]);

  const handleTrackClick = useCallback((track: UnifiedTrack, index: number) => {
    setQueue(inlineTracks, index);
    play(track);
  }, [inlineTracks, setQueue, play]);

  const handleViewAll = useCallback(() => {
    // Just close the inline panel for now (no search fallback)
    setInlineGenre(null);
  }, []);

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
      <div className="genre-grid">
        {parentGenres.map((genre, index) => (
          <GenreTile
            key={genre.id}
            genre={genre}
            index={index}
            isExpanded={expandedGenre === genre.id}
            isHighlighted={isHighlighted(genre.id)}
            onClick={() => handleGenreClick(genre)}
            onSubgenreClick={handleSubgenreClick}
          />
        ))}
      </div>

      {/* Expanded subgenres panel */}
      {expandedGenre && (
        <ExpandedSubgenres
          parentId={expandedGenre}
          onSubgenreClick={handleSubgenreClick}
          onClose={() => setExpandedGenre(null)}
        />
      )}

      {/* Inline tracks panel (embedding-based) */}
      {inlineGenre && inlineTracks.length > 0 && (
        <div className="genre-inline-tracks" onClick={(e) => e.stopPropagation()}>
          <div className="genre-inline-header">
            <h4 className="genre-inline-title">
              <span
                className="genre-inline-dot"
                style={{ backgroundColor: inlineGenre.color }}
              />
              {inlineGenre.name}
            </h4>
            <div className="genre-inline-actions">
              <button
                className="genre-inline-play"
                onClick={handlePlayInline}
                title="Play all"
              >
                <PlayIcon size={16} />
                <span>Play</span>
              </button>
              <button
                className="genre-inline-view-all"
                onClick={handleViewAll}
              >
                View all
              </button>
              <button
                className="genre-inline-close"
                onClick={() => setInlineGenre(null)}
              >
                ×
              </button>
            </div>
          </div>

          <div className="genre-inline-scroll">
            {inlineTracks.map((track, index) => (
              <div
                key={track.id}
                className="genre-inline-track"
                onClick={() => handleTrackClick(track, index)}
                onContextMenu={(e) => showContextMenu(e, track)}
              >
                <div className="genre-inline-artwork">
                  {track.artwork?.small ? (
                    <img src={track.artwork.small} alt={track.title} loading="lazy" />
                  ) : (
                    <div className="genre-inline-placeholder">
                      <MusicNoteIcon size={16} />
                    </div>
                  )}
                  <div className="genre-inline-play-overlay">
                    <PlayIcon size={14} />
                  </div>
                </div>
                <div className="genre-inline-info">
                  <span className="genre-inline-track-title">{track.title}</span>
                  <span className="genre-inline-track-artist">
                    {track.artists.map((a) => a.name).join(', ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </BaseSectionWrapper>
  );
};

interface GenreTileProps {
  genre: GenreNode;
  index: number;
  isExpanded: boolean;
  isHighlighted: boolean;
  onClick: () => void;
  onSubgenreClick: (genre: GenreNode) => void;
}

const GenreTile: React.FC<GenreTileProps> = ({
  genre,
  index,
  isExpanded,
  isHighlighted,
  onClick,
}) => {
  const hasChildren = genre.children && genre.children.length > 0;

  return (
    <div
      className={`genre-tile ${isExpanded ? 'expanded' : ''} ${isHighlighted ? 'highlighted' : ''}`}
      style={{
        '--genre-color': genre.color,
        animationDelay: `${index * 50}ms`,
      } as React.CSSProperties}
      onClick={onClick}
    >
      <div
        className="genre-tile-bg"
        style={{
          background: `linear-gradient(135deg, ${genre.color}40 0%, ${genre.color}10 100%)`,
        }}
      />

      <div className="genre-tile-content">
        <span className="genre-tile-name">{genre.name}</span>

        {hasChildren && (
          <span className="genre-tile-expand">
            {isExpanded ? (
              <ChevronDownIcon size={16} />
            ) : (
              <ChevronRightIcon size={16} />
            )}
          </span>
        )}
      </div>

      {isHighlighted && (
        <span className="genre-tile-badge">Your Taste</span>
      )}

      {/* Decorative accent */}
      <div
        className="genre-tile-accent"
        style={{ backgroundColor: genre.color }}
      />
    </div>
  );
};

interface ExpandedSubgenresProps {
  parentId: string;
  onSubgenreClick: (genre: GenreNode) => void;
  onClose: () => void;
}

const ExpandedSubgenres: React.FC<ExpandedSubgenresProps> = ({
  parentId,
  onSubgenreClick,
  onClose,
}) => {
  const subgenres = getChildGenres(parentId);
  const parent = getParentGenres().find((g) => g.id === parentId);

  if (subgenres.length === 0 || !parent) {
    return null;
  }

  return (
    <div className="subgenres-panel" onClick={(e) => e.stopPropagation()}>
      <div className="subgenres-header">
        <h4 className="subgenres-title">
          Explore <span style={{ color: parent.color }}>{parent.name}</span>
        </h4>
        <button className="subgenres-close" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="subgenres-grid">
        {subgenres.map((subgenre, index) => (
          <button
            key={subgenre.id}
            className="subgenre-pill"
            style={{
              '--subgenre-color': subgenre.color,
              animationDelay: `${index * 30}ms`,
            } as React.CSSProperties}
            onClick={() => onSubgenreClick(subgenre)}
          >
            <span
              className="subgenre-dot"
              style={{ backgroundColor: subgenre.color }}
            />
            {subgenre.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default GenreExplorerSection;
