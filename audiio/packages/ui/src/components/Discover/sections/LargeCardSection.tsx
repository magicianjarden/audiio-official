/**
 * LargeCardSection - 2-3 column grid with bigger cards
 */

import React from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { MusicNoteIcon, PlayIcon, PauseIcon } from '../../Icons/Icons';

export interface LargeCardSectionProps {
  id: string;
  title: string;
  subtitle?: string;
  tracks: UnifiedTrack[];
  isLoading?: boolean;
  maxItems?: number;
}

export const LargeCardSection: React.FC<LargeCardSectionProps> = ({
  title,
  subtitle,
  tracks = [],
  isLoading,
  maxItems = 6,
}) => {
  const { play, setQueue, currentTrack, isPlaying } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();

  const displayTracks = tracks?.slice(0, maxItems) ?? [];

  const handleTrackClick = (track: UnifiedTrack, index: number) => {
    setQueue(displayTracks, index);
    play(track);
  };

  if (!isLoading && (!tracks || tracks.length === 0)) {
    return null;
  }

  return (
    <section className="discover-large-card-section">
      <div className="discover-section-header">
        <div className="discover-section-title-row">
          <h2 className="discover-section-title">{title}</h2>
          {subtitle && <span className="discover-section-subtitle">{subtitle}</span>}
        </div>
      </div>

      {isLoading ? (
        <div className="large-card-grid">
          {[1, 2, 3].map(i => (
            <div key={i} className="large-card-skeleton" />
          ))}
        </div>
      ) : (
        <div className="large-card-grid">
          {displayTracks.map((track, index) => {
            const isCurrentTrack = currentTrack?.id === track.id;
            const artworkUrl = track.artwork?.medium ?? track.album?.artwork?.medium;

            return (
              <div
                key={track.id}
                className={`large-track-card ${isCurrentTrack ? 'playing' : ''}`}
                onClick={() => handleTrackClick(track, index)}
                onContextMenu={(e) => showContextMenu(e, track)}
              >
                <div className="large-track-artwork">
                  {artworkUrl ? (
                    <img src={artworkUrl} alt={track.title} />
                  ) : (
                    <div className="large-track-placeholder">
                      <MusicNoteIcon size={48} />
                    </div>
                  )}
                  <div className="large-track-overlay">
                    <button className="large-track-play">
                      {isCurrentTrack && isPlaying ? (
                        <PauseIcon size={28} />
                      ) : (
                        <PlayIcon size={28} />
                      )}
                    </button>
                  </div>
                  {isCurrentTrack && isPlaying && (
                    <div className="large-track-playing-badge">
                      <span className="playing-bar" />
                      <span className="playing-bar" />
                      <span className="playing-bar" />
                    </div>
                  )}
                </div>
                <div className="large-track-info">
                  <h3 className="large-track-title">{track.title}</h3>
                  <p className="large-track-artist">
                    {track.artists.map(a => a.name).join(', ')}
                  </p>
                  {track.album?.releaseDate && (
                    <span className="large-track-year">
                      {track.album.releaseDate.substring(0, 4)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default LargeCardSection;
