import React from 'react';
import { useLibraryStore } from '../../stores/library-store';
import { usePlayerStore } from '../../stores/player-store';
import { useRecommendationStore, DISLIKE_REASONS } from '../../stores/recommendation-store';
import { TrackRow } from '../TrackRow/TrackRow';
import { ThumbDownIcon, PlayIcon, CloseIcon } from '@audiio/icons';

export const DislikesView: React.FC = () => {
  const { dislikedTracks, undislikeTrack } = useLibraryStore();
  const { play, setQueue, currentTrack } = usePlayerStore();
  const { getDislikeReasons, removeDislike } = useRecommendationStore();

  const getReasonLabels = (trackId: string): string[] => {
    const reasons = getDislikeReasons(trackId);
    if (!reasons) return [];
    return reasons.map(reason =>
      DISLIKE_REASONS.find(r => r.value === reason)?.label || reason
    );
  };

  const handlePlayTrack = (index: number) => {
    const track = dislikedTracks[index];
    if (track) {
      setQueue(dislikedTracks, index);
      play(track);
    }
  };

  const handlePlayAll = () => {
    if (dislikedTracks.length > 0) {
      setQueue(dislikedTracks, 0);
      play(dislikedTracks[0]!);
    }
  };

  const handleUndislike = (trackId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Remove from both stores
    removeDislike(trackId);
    undislikeTrack(trackId);
  };

  return (
    <div className="library-view">
      <header className="library-header">
        <div className="library-header-icon dislikes-icon"><ThumbDownIcon size={64} /></div>
        <div className="library-header-info">
          <span className="library-header-type">Collection</span>
          <h1 className="library-header-title">Disliked Songs</h1>
          <span className="library-header-count">{dislikedTracks.length} songs</span>
        </div>
      </header>

      {dislikedTracks.length > 0 && (
        <div className="library-actions">
          <button className="library-play-button" onClick={handlePlayAll}>
            <PlayIcon size={18} /> Play All
          </button>
        </div>
      )}

      <div className="library-tracks">
        {dislikedTracks.length === 0 ? (
          <div className="library-empty">
            <div className="library-empty-icon"><ThumbDownIcon size={48} /></div>
            <h3>Songs you dislike will appear here</h3>
            <p>Dislike songs to help improve your recommendations</p>
          </div>
        ) : (
          <div className="results-list">
            {dislikedTracks.map((track, index) => {
              const reasonLabels = getReasonLabels(track.id);
              return (
                <div key={track.id} className="dislike-track-item">
                  <TrackRow
                    track={track}
                    index={index + 1}
                    isPlaying={currentTrack?.id === track.id}
                    onClick={() => handlePlayTrack(index)}
                  />
                  <div className="dislike-reasons">
                    {reasonLabels.map((label, i) => (
                      <span key={i} className="dislike-reason-tag">{label}</span>
                    ))}
                    <button
                      className="dislike-remove-btn"
                      onClick={(e) => handleUndislike(track.id, e)}
                      title="Remove from dislikes"
                    >
                      <CloseIcon size={12} />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
