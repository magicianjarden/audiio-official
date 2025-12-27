/**
 * CompactListSection - Dense list format for recently played
 */

import React from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { MusicNoteIcon, PlayIcon } from '@audiio/icons';

export interface CompactListSectionProps {
  id: string;
  title: string;
  tracks: UnifiedTrack[];
  isLoading?: boolean;
  maxItems?: number;
}

export const CompactListSection: React.FC<CompactListSectionProps> = ({
  title,
  tracks = [],
  isLoading,
  maxItems = 5,
}) => {
  const { play, setQueue, currentTrack, isPlaying } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();

  const displayTracks = tracks?.slice(0, maxItems) ?? [];

  const handleTrackClick = (track: UnifiedTrack, index: number) => {
    setQueue(displayTracks, index);
    play(track);
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!isLoading && (!tracks || tracks.length === 0)) {
    return null;
  }

  return (
    <section className="discover-compact-section">
      <h2 className="discover-section-title">{title}</h2>

      {isLoading ? (
        <div className="compact-list-loading">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="compact-track-skeleton" />
          ))}
        </div>
      ) : (
        <div className="compact-list">
          {displayTracks.map((track, index) => {
            const isCurrentTrack = currentTrack?.id === track.id;
            return (
              <div
                key={track.id}
                className={`compact-track-item ${isCurrentTrack ? 'playing' : ''}`}
                onClick={() => handleTrackClick(track, index)}
                onContextMenu={(e) => showContextMenu(e, track)}
              >
                <div className="compact-track-artwork">
                  {track.artwork?.small ? (
                    <img src={track.artwork.small} alt={track.title} />
                  ) : (
                    <div className="compact-track-placeholder">
                      <MusicNoteIcon size={16} />
                    </div>
                  )}
                  <div className="compact-track-play-overlay">
                    {isCurrentTrack && isPlaying ? (
                      <div className="compact-playing-indicator">
                        <span className="playing-bar" />
                        <span className="playing-bar" />
                        <span className="playing-bar" />
                      </div>
                    ) : (
                      <PlayIcon size={14} />
                    )}
                  </div>
                </div>
                <div className="compact-track-info">
                  <span className="compact-track-title">{track.title}</span>
                  <span className="compact-track-artist">
                    {track.artists.map(a => a.name).join(', ')}
                  </span>
                </div>
                <span className="compact-track-duration">
                  {formatDuration(track.duration)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default CompactListSection;
