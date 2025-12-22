/**
 * ChartListSection - Numbered list of top/trending tracks
 * Compact format similar to Apple Music charts
 */

import React, { useState, useEffect } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { MusicNoteIcon } from '../../Icons/Icons';
import type { BaseSectionProps } from '../section-registry';

export interface ChartListSectionProps extends BaseSectionProps {
  maxItems?: number;
}

export const ChartListSection: React.FC<ChartListSectionProps> = ({
  id,
  title,
  subtitle,
  query,
  onSeeAll,
  maxItems = 10, // Increased from 5 to 10 for fuller section
}) => {
  const [tracks, setTracks] = useState<UnifiedTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { play, setQueue, currentTrack, isPlaying } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();

  useEffect(() => {
    let mounted = true;

    const fetchChartTracks = async () => {
      setIsLoading(true);
      try {
        // Try getTrending API first for chart data
        if (window.api?.getTrending) {
          const trending = await window.api.getTrending();
          if (mounted && trending?.tracks?.length > 0) {
            const unifiedTracks = trending.tracks.slice(0, maxItems).map(track => ({
              ...track,
              streamSources: [],
              _meta: {
                metadataProvider: track._provider || 'chart',
                matchConfidence: 1,
                externalIds: track.externalIds || {},
                lastUpdated: new Date()
              }
            })) as UnifiedTrack[];
            setTracks(unifiedTracks);
            setIsLoading(false);
            return;
          }
        }

        // Fallback to search
        if (window.api?.search) {
          const searchQuery = query || 'chart top 50 2024';
          const results = await window.api.search({ query: searchQuery, type: 'track' });
          if (mounted) {
            setTracks((results || []).slice(0, maxItems));
          }
        }
      } catch (error) {
        console.error('[ChartListSection] Failed to fetch:', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchChartTracks();

    return () => {
      mounted = false;
    };
  }, [query, maxItems]);

  const handleTrackClick = (track: UnifiedTrack, index: number) => {
    setQueue(tracks, index);
    play(track);
  };

  const formatDuration = (ms?: number): string => {
    if (!ms) return '--:--';
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Don't hide section completely - show placeholder if empty
  const showEmptyState = !isLoading && tracks.length === 0;

  return (
    <section id={id} className="chart-list-section">
      <div className="discover-section-header">
        <div className="discover-section-title-row">
          <h2 className="discover-section-title">{title}</h2>
          {subtitle && <span className="discover-section-subtitle">{subtitle}</span>}
        </div>
        {onSeeAll && (
          <button className="discover-section-more" onClick={onSeeAll}>
            See all
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="chart-list">
          {Array.from({ length: maxItems }).map((_, i) => (
            <div key={i} className="chart-item-skeleton">
              <div className="skeleton-rank" />
              <div className="skeleton-artwork" />
              <div className="skeleton-info">
                <div className="skeleton-title" />
                <div className="skeleton-artist" />
              </div>
            </div>
          ))}
        </div>
      ) : showEmptyState ? (
        <div className="discover-empty-state">
          <p>Unable to load chart data</p>
        </div>
      ) : (
        <div className="chart-list">
          {tracks.map((track, index) => {
            const isCurrentTrack = currentTrack?.id === track.id;
            const isCurrentlyPlaying = isCurrentTrack && isPlaying;
            const artworkUrl = track.artwork?.small || track.album?.artwork?.small;

            return (
              <div
                key={track.id}
                className={`chart-item ${isCurrentTrack ? 'playing' : ''}`}
                onClick={() => handleTrackClick(track, index)}
                onContextMenu={(e) => showContextMenu(e, track)}
              >
                <span className="chart-rank">{index + 1}</span>

                <div className="chart-artwork">
                  {artworkUrl ? (
                    <img src={artworkUrl} alt={track.title} loading="lazy" />
                  ) : (
                    <div className="chart-artwork-placeholder">
                      <MusicNoteIcon size={20} />
                    </div>
                  )}
                  {isCurrentlyPlaying && (
                    <div className="chart-playing-indicator">
                      <span className="bar" />
                      <span className="bar" />
                      <span className="bar" />
                    </div>
                  )}
                </div>

                <div className="chart-info">
                  <div className="chart-title">
                    {track.title}
                    {track.explicit && <span className="chart-explicit">E</span>}
                  </div>
                  <div className="chart-artist">
                    {track.artists.map(a => a.name).join(', ')}
                  </div>
                </div>

                <span className="chart-duration">{formatDuration(track.duration)}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default ChartListSection;
