/**
 * QuickPickSection - Rapid discovery with compact tiles
 * Grid of compact track tiles for fast music discovery.
 * Uses the ML recommendations API for personalized picks.
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { usePlayerStore } from '../../../stores/player-store';
import { useLibraryStore } from '../../../stores/library-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { useMLRecommendations } from '../../../hooks/useRecommendations';
import {
  PlayIcon,
  PauseIcon,
  HeartIcon,
  RefreshIcon,
  MusicNoteIcon,
} from '@audiio/icons';

export interface QuickPickSectionProps {
  id: string;
  title?: string;
  subtitle?: string;
  maxItems?: number;
}

export const QuickPickSection: React.FC<QuickPickSectionProps> = ({
  id,
  title = 'Quick Picks',
  subtitle = 'Fast discoveries',
  maxItems = 12,
}) => {
  const { play, pause, currentTrack, isPlaying, setQueue } = usePlayerStore();
  const { addToLiked, likedTracks } = useLibraryStore();
  const { showContextMenu } = useTrackContextMenu();
  const [isVisible, setIsVisible] = useState(false);

  // Use the ML recommendations API directly
  const { data: tracks, isLoading, refetch } = useMLRecommendations(maxItems, 'discovery');

  // Track which items are liked (for UI feedback)
  const likedIds = new Set(likedTracks.map(lt => lt.track.id));

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const handlePlay = useCallback((track: UnifiedTrack, index: number) => {
    if (isPlaying && currentTrack?.id === track.id) {
      pause();
    } else {
      setQueue(tracks, index);
      play(track);
    }
  }, [tracks, currentTrack, isPlaying, play, pause, setQueue]);

  const handleLike = useCallback((e: React.MouseEvent, track: UnifiedTrack) => {
    e.stopPropagation();
    addToLiked(track);
  }, [addToLiked]);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const showEmptyState = !isLoading && tracks.length === 0;

  if (showEmptyState) return null;

  return (
    <section
      id={id}
      className={`discover-section quick-picks-section ${isVisible ? 'is-visible' : ''}`}
      style={{ animationDelay: '300ms' }}
    >
      <div className="discover-section-header">
        <div className="discover-section-title-row">
          <h2 className="discover-section-title">{title}</h2>
          <span className="discover-section-subtitle">{subtitle}</span>
        </div>
        <div className="discover-section-actions">
          <button
            className="pill-btn pill-btn--sm pill-btn--glass"
            onClick={handleRefresh}
            title="Refresh picks"
          >
            <RefreshIcon size={14} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="quick-picks-grid">
          {Array.from({ length: maxItems }).map((_, i) => (
            <div key={i} className="quick-pick-tile skeleton" style={{ animationDelay: `${i * 30}ms` }} />
          ))}
        </div>
      ) : (
        <div className="quick-picks-grid">
          {tracks.map((track, index) => {
            const isCurrentlyPlaying = isPlaying && currentTrack?.id === track.id;
            const isLiked = likedIds.has(track.id);
            const artworkUrl = track.artwork?.small || track.artwork?.medium;

            return (
              <div
                key={track.id}
                className={`quick-pick-tile ${isCurrentlyPlaying ? 'playing' : ''}`}
                onClick={() => handlePlay(track, index)}
                onContextMenu={(e) => showContextMenu(e, track)}
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className="quick-pick-artwork">
                  {artworkUrl ? (
                    <img src={artworkUrl} alt={track.title} />
                  ) : (
                    <div className="quick-pick-artwork-placeholder">
                      <MusicNoteIcon size={20} />
                    </div>
                  )}
                  {isCurrentlyPlaying && (
                    <div className="quick-pick-playing">
                      <span className="bar" />
                      <span className="bar" />
                      <span className="bar" />
                    </div>
                  )}
                </div>
                <div className="quick-pick-info">
                  <span className="quick-pick-title">{track.title}</span>
                </div>
                <button
                  className={`quick-pick-like ${isLiked ? 'liked' : ''}`}
                  onClick={(e) => handleLike(e, track)}
                  title={isLiked ? 'Already liked' : 'Like'}
                >
                  <HeartIcon size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default QuickPickSection;
