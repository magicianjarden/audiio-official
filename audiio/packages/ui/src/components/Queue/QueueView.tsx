import React from 'react';
import { usePlayerStore } from '../../stores/player-store';
import { useTrackContextMenu } from '../../contexts/ContextMenuContext';
import { TrackRow } from '../TrackRow/TrackRow';
import {
  QueueIcon,
  MusicNoteIcon,
  CloseIcon
} from '../Icons/Icons';

interface QueueViewProps {
  onClose?: () => void;
}

export const QueueView: React.FC<QueueViewProps> = ({ onClose }) => {
  const { currentTrack, queue, queueIndex, play, setQueue } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();

  const upNext = queue.slice(queueIndex + 1);
  const history = queue.slice(0, queueIndex).reverse();

  const handleRemoveFromQueue = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    const actualIndex = queueIndex + 1 + index;
    const newQueue = [...queue];
    newQueue.splice(actualIndex, 1);
    setQueue(newQueue, queueIndex);
  };

  const handlePlayFromQueue = (index: number) => {
    const actualIndex = queueIndex + 1 + index;
    const track = queue[actualIndex];
    if (track) {
      play(track);
    }
  };

  const handlePlayFromHistory = (index: number) => {
    const actualIndex = queueIndex - 1 - index;
    const track = queue[actualIndex];
    if (track) {
      play(track);
    }
  };

  const handleClearUpNext = () => {
    const newQueue = queue.slice(0, queueIndex + 1);
    setQueue(newQueue, queueIndex);
  };

  const artworkUrl = currentTrack?.artwork?.medium ?? currentTrack?.album?.artwork?.medium;

  return (
    <div className="queue-view">
      <header className="queue-header">
        <div className="queue-header-title">
          <QueueIcon size={24} />
          <h2>Queue</h2>
        </div>
        {onClose && (
          <button className="queue-close" onClick={onClose}>
            <CloseIcon size={20} />
          </button>
        )}
      </header>

      <div className="queue-content">
        {/* Now Playing */}
        {currentTrack && (
          <section className="queue-section">
            <h3 className="queue-section-title">Now Playing</h3>
            <div className="queue-now-playing">
              <div className="queue-now-playing-artwork">
                {artworkUrl ? (
                  <img src={artworkUrl} alt={currentTrack.title} />
                ) : (
                  <div className="queue-artwork-placeholder">
                    <MusicNoteIcon size={32} />
                  </div>
                )}
                <div className="queue-now-playing-indicator">
                  <span className="playing-bars">
                    <span /><span /><span />
                  </span>
                </div>
              </div>
              <div className="queue-now-playing-info">
                <div className="queue-now-playing-title">{currentTrack.title}</div>
                <div className="queue-now-playing-artist">
                  {currentTrack.artists.map(a => a.name).join(', ')}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Up Next */}
        <section className="queue-section">
          <div className="queue-section-header">
            <h3 className="queue-section-title">Up Next</h3>
            {upNext.length > 0 && (
              <button className="queue-clear-button" onClick={handleClearUpNext}>
                Clear
              </button>
            )}
          </div>
          {upNext.length === 0 ? (
            <div className="queue-empty">
              <p>No tracks in queue</p>
              <p className="queue-empty-hint">Add tracks from search or discover</p>
            </div>
          ) : (
            <div className="queue-list">
              {upNext.map((track, index) => (
                <div key={`${track.id}-${index}`} className="queue-item">
                  <TrackRow
                    track={track}
                    index={index + 1}
                    isPlaying={false}
                    onClick={() => handlePlayFromQueue(index)}
                    onContextMenu={showContextMenu}
                  />
                  <button
                    className="queue-item-remove"
                    onClick={(e) => handleRemoveFromQueue(e, index)}
                    title="Remove from queue"
                  >
                    <CloseIcon size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recently Played */}
        {history.length > 0 && (
          <section className="queue-section">
            <h3 className="queue-section-title">Recently Played</h3>
            <div className="queue-list history">
              {history.slice(0, 10).map((track, index) => (
                <TrackRow
                  key={`history-${track.id}-${index}`}
                  track={track}
                  index={queueIndex - index}
                  isPlaying={false}
                  onClick={() => handlePlayFromHistory(index)}
                  onContextMenu={showContextMenu}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
