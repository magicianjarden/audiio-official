import React from 'react';
import { useLibraryStore } from '../../stores/library-store';
import { usePlayerStore } from '../../stores/player-store';
import { TrackRow } from '../TrackRow/TrackRow';
import { HeartIcon, HeartOutlineIcon, PlayIcon } from '../Icons/Icons';

export const LikesView: React.FC = () => {
  const { likedTracks } = useLibraryStore();
  const { play, setQueue, currentTrack } = usePlayerStore();

  const handlePlayTrack = (index: number) => {
    const track = likedTracks[index];
    if (track) {
      setQueue(likedTracks, index);
      play(track);
    }
  };

  const handlePlayAll = () => {
    if (likedTracks.length > 0) {
      setQueue(likedTracks, 0);
      play(likedTracks[0]!);
    }
  };

  return (
    <div className="library-view">
      <header className="library-header">
        <div className="library-header-icon likes-icon"><HeartIcon size={64} /></div>
        <div className="library-header-info">
          <span className="library-header-type">Collection</span>
          <h1 className="library-header-title">Liked Songs</h1>
          <span className="library-header-count">{likedTracks.length} songs</span>
        </div>
      </header>

      {likedTracks.length > 0 && (
        <div className="library-actions">
          <button className="library-play-button" onClick={handlePlayAll}>
            <PlayIcon size={18} /> Play All
          </button>
        </div>
      )}

      <div className="library-tracks">
        {likedTracks.length === 0 ? (
          <div className="library-empty">
            <div className="library-empty-icon"><HeartOutlineIcon size={48} /></div>
            <h3>Songs you like will appear here</h3>
            <p>Save songs by tapping the heart icon</p>
          </div>
        ) : (
          <div className="results-list">
            {likedTracks.map((track, index) => (
              <TrackRow
                key={track.id}
                track={track}
                index={index + 1}
                isPlaying={currentTrack?.id === track.id}
                onClick={() => handlePlayTrack(index)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
