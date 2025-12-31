/**
 * MixView - Dedicated view for mood/genre mixes
 */

import React, { useEffect, useState } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { useNavigationStore } from '../../stores/navigation-store';
import { usePlayerStore } from '../../stores/player-store';
import { useTrackContextMenu } from '../../contexts/ContextMenuContext';
import {
  BackIcon,
  PlayIcon,
  ShuffleIcon,
  MusicNoteIcon,
} from '@audiio/icons';

export const MixView: React.FC = () => {
  const { selectedMixData, goBack } = useNavigationStore();
  const { play, setQueue, shuffle, currentTrack, isPlaying } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();

  const [tracks, setTracks] = useState<UnifiedTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!selectedMixData) return;

    const loadMixTracks = async () => {
      setIsLoading(true);
      try {
        if (window.api) {
          const results = await window.api.search({ query: selectedMixData.query, type: 'track' });
          setTracks(results?.slice(0, 50) || []);
        }
      } catch (error) {
        console.error('Failed to load mix tracks:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMixTracks();
  }, [selectedMixData]);

  if (!selectedMixData) {
    return (
      <div className="mix-view">
        <div className="mix-error">Mix not found</div>
      </div>
    );
  }

  const handlePlayAll = () => {
    if (tracks.length > 0) {
      setQueue(tracks, 0);
      play(tracks[0]);
    }
  };

  const handleShuffle = () => {
    if (tracks.length > 0) {
      const shuffled = [...tracks].sort(() => Math.random() - 0.5);
      setQueue(shuffled, 0);
      play(shuffled[0]);
      shuffle();
    }
  };

  const handleTrackClick = (track: UnifiedTrack, index: number) => {
    setQueue(tracks, index);
    play(track);
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const gradient = selectedMixData.gradient || 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)';

  return (
    <div className="mix-view">
      {/* Header with back button */}
      <div className="mix-header">
        <button className="back-btn-round mix-back-btn-pos" onClick={goBack} aria-label="Go back">
          <BackIcon size={20} />
        </button>
      </div>

      {/* Hero section with gradient background */}
      <div className="mix-hero" style={{ background: gradient }}>
        <div className="mix-hero-content">
          <div className="mix-hero-icon">
            {selectedMixData.icon || '🎵'}
          </div>
          <div className="mix-hero-info">
            <h1 className="mix-hero-title">{selectedMixData.name}</h1>
            {selectedMixData.description && (
              <p className="mix-hero-description">{selectedMixData.description}</p>
            )}
            <p className="mix-hero-meta">{tracks.length} tracks</p>
          </div>
        </div>
        <div className="mix-hero-actions">
          <button className="mix-play-button" onClick={handlePlayAll} disabled={tracks.length === 0}>
            <PlayIcon size={24} />
            <span>Play All</span>
          </button>
          <button className="mix-shuffle-button" onClick={handleShuffle} disabled={tracks.length === 0}>
            <ShuffleIcon size={20} />
            <span>Shuffle</span>
          </button>
        </div>
      </div>

      {/* Track list */}
      <div className="mix-tracks">
        {isLoading ? (
          <div className="mix-loading">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="mix-track-skeleton" />
            ))}
          </div>
        ) : tracks.length === 0 ? (
          <div className="mix-empty">No tracks found for this mix</div>
        ) : (
          <table className="mix-track-table">
            <thead>
              <tr>
                <th className="mix-track-number">#</th>
                <th className="mix-track-title">Title</th>
                <th className="mix-track-artist">Artist</th>
                <th className="mix-track-duration">Duration</th>
              </tr>
            </thead>
            <tbody>
              {tracks.map((track, index) => {
                const isCurrentTrack = currentTrack?.id === track.id;
                return (
                  <tr
                    key={track.id}
                    className={`mix-track-row ${isCurrentTrack ? 'playing' : ''}`}
                    onClick={() => handleTrackClick(track, index)}
                    onContextMenu={(e) => showContextMenu(e, track)}
                  >
                    <td className="mix-track-number">
                      {isCurrentTrack && isPlaying ? (
                        <div className="mix-playing-indicator">
                          <span className="playing-bar" />
                          <span className="playing-bar" />
                          <span className="playing-bar" />
                        </div>
                      ) : (
                        index + 1
                      )}
                    </td>
                    <td className="mix-track-title">
                      <div className="mix-track-info">
                        <div className="mix-track-artwork">
                          {track.artwork?.small ? (
                            <img src={track.artwork.small} alt={track.title} />
                          ) : (
                            <div className="mix-track-artwork-placeholder">
                              <MusicNoteIcon size={16} />
                            </div>
                          )}
                        </div>
                        <span className="mix-track-name">{track.title}</span>
                      </div>
                    </td>
                    <td className="mix-track-artist">
                      {track.artists.map(a => a.name).join(', ')}
                    </td>
                    <td className="mix-track-duration">
                      {formatDuration(track.duration)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default MixView;
