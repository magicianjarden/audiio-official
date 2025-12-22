/**
 * QuickPicksSection - Small tile grid for quick access
 * Similar to Spotify's "Good morning" tiles - shows recently played or recommended
 * Uses ML ranking for personalized track ordering
 */

import React, { useState, useEffect } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { useMLRanking } from '../../../hooks';
import { MusicNoteIcon } from '../../Icons/Icons';
import type { BaseSectionProps } from '../section-registry';

export interface QuickPicksSectionProps extends BaseSectionProps {
  maxItems?: number;
}

export const QuickPicksSection: React.FC<QuickPicksSectionProps> = ({
  id,
  title,
  context,
  maxItems = 6,
}) => {
  const [tracks, setTracks] = useState<UnifiedTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { play, setQueue, currentTrack, isPlaying } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();
  const { rankTracks } = useMLRanking();

  useEffect(() => {
    let mounted = true;

    const fetchQuickPicks = async () => {
      setIsLoading(true);

      try {
        // Build queries based on user's top artists for personalized quick picks
        const topArtists = context?.topArtists || [];
        const queries: string[] = [];

        // Create personalized queries from top artists
        if (topArtists.length > 0) {
          topArtists.slice(0, 3).forEach(artist => {
            queries.push(`${artist} best songs`);
          });
        }

        // Add fallback queries
        queries.push('top hits 2024', 'trending music');

        // Fetch tracks from multiple queries for variety
        const allTracks: UnifiedTrack[] = [];

        if (window.api?.search) {
          // Fetch from first 2 queries for quick picks
          for (const query of queries.slice(0, 2)) {
            try {
              const results = await window.api.search({ query, type: 'track' });
              if (results?.length > 0) {
                allTracks.push(...results.slice(0, 6)); // Get more for ML ranking
              }
            } catch {
              // Continue with next query
            }
          }
        }

        // Deduplicate
        if (!mounted || allTracks.length === 0) {
          if (mounted) setIsLoading(false);
          return;
        }

        const uniqueTracks = allTracks.filter((track, index, self) =>
          index === self.findIndex(t => t.id === track.id)
        );

        // Apply ML ranking for personalized quick picks
        const ranked = await rankTracks(uniqueTracks, {
          enabled: true,
          explorationMode: 'exploit', // Familiar tracks for quick picks
          limit: maxItems,
          shuffle: true,
          shuffleIntensity: 0.15
        });

        if (mounted) {
          setTracks(ranked.map(r => r.track));
        }
      } catch (error) {
        console.error('[QuickPicksSection] Failed to fetch:', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchQuickPicks();

    return () => {
      mounted = false;
    };
  }, [context?.topArtists, maxItems, rankTracks]);

  const handleTrackClick = (track: UnifiedTrack, index: number) => {
    setQueue(tracks, index);
    play(track);
  };

  // Don't return null - let parent handle if no content
  const showEmptyState = !isLoading && tracks.length === 0;
  if (showEmptyState) {
    return null; // QuickPicks should be hidden if empty since it has no title
  }

  return (
    <section id={id} className="quick-picks-section">
      {title && (
        <div className="discover-section-header">
          <h2 className="discover-section-title">{title}</h2>
        </div>
      )}

      {isLoading ? (
        <div className="quick-picks-grid">
          {Array.from({ length: maxItems }).map((_, i) => (
            <div key={i} className="quick-pick-skeleton" />
          ))}
        </div>
      ) : (
        <div className="quick-picks-grid">
          {tracks.map((track, index) => {
            const isCurrentTrack = currentTrack?.id === track.id;
            const isCurrentlyPlaying = isCurrentTrack && isPlaying;
            const artworkUrl = track.artwork?.small || track.album?.artwork?.small;

            return (
              <div
                key={track.id}
                className={`quick-pick-tile ${isCurrentTrack ? 'playing' : ''}`}
                onClick={() => handleTrackClick(track, index)}
                onContextMenu={(e) => showContextMenu(e, track)}
              >
                <div className="quick-pick-artwork">
                  {artworkUrl ? (
                    <img src={artworkUrl} alt={track.title} loading="lazy" />
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
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default QuickPicksSection;
