/**
 * Queue Page - Shows current queue with now playing, up next, and history
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayerStore, type Track } from '../stores/player-store';
import { getTrackArtwork } from '../utils/artwork';
import {
  ChevronLeftIcon,
  PlayIcon,
  MusicNoteIcon,
  CloseIcon,
  TrashIcon
} from '../components/Icons';
import styles from './QueuePage.module.css';

export function QueuePage() {
  const navigate = useNavigate();
  const {
    currentTrack,
    queue,
    queueIndex,
    isPlaying,
    play,
    removeFromQueue,
    clearQueue
  } = usePlayerStore();

  // Split queue into up next and history
  const upNext = queue.slice(queueIndex + 1);
  const history = queue.slice(0, queueIndex).reverse();

  const handlePlayTrack = (track: Track, index: number) => {
    // Calculate actual index in queue
    const actualIndex = queueIndex + 1 + index;
    usePlayerStore.setState({ queueIndex: actualIndex });
    play(track);
  };

  const handlePlayFromHistory = (track: Track, originalIndex: number) => {
    // originalIndex is reversed, convert back
    const actualIndex = queueIndex - 1 - originalIndex;
    usePlayerStore.setState({ queueIndex: actualIndex });
    play(track);
  };

  const handleRemoveFromUpNext = (index: number) => {
    const actualIndex = queueIndex + 1 + index;
    removeFromQueue(actualIndex);
  };

  const handleClearUpNext = () => {
    // Remove all tracks after current
    const toRemove = queue.length - queueIndex - 1;
    for (let i = 0; i < toRemove; i++) {
      removeFromQueue(queueIndex + 1);
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate(-1)}>
          <ChevronLeftIcon size={24} />
        </button>
        <h1 className={styles.title}>Queue</h1>
        {queue.length > 0 && (
          <button className={styles.clearButton} onClick={clearQueue}>
            <TrashIcon size={20} />
          </button>
        )}
      </header>

      <div className={styles.content}>
        {/* Now Playing */}
        {currentTrack && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Now Playing</h2>
            <div className={styles.nowPlaying}>
              <div className={styles.nowPlayingArtwork}>
                {getTrackArtwork(currentTrack, 'small') ? (
                  <img src={getTrackArtwork(currentTrack, 'small')} alt="" />
                ) : (
                  <div className={styles.artworkPlaceholder}>
                    <MusicNoteIcon size={24} />
                  </div>
                )}
                {isPlaying && <div className={styles.playingIndicator} />}
              </div>
              <div className={styles.trackInfo}>
                <span className={styles.trackTitle}>{currentTrack.title}</span>
                <span className={styles.trackArtist}>
                  {currentTrack.artists?.[0]?.name || 'Unknown Artist'}
                </span>
              </div>
            </div>
          </section>
        )}

        {/* Up Next */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Up Next</h2>
            {upNext.length > 0 && (
              <button className={styles.clearSectionButton} onClick={handleClearUpNext}>
                Clear
              </button>
            )}
          </div>

          {upNext.length === 0 ? (
            <p className={styles.emptyText}>No tracks in queue</p>
          ) : (
            <div className={styles.trackList}>
              {upNext.map((track, index) => (
                <div key={`${track.id}-${index}`} className={styles.trackItem}>
                  <button
                    className={styles.trackContent}
                    onClick={() => handlePlayTrack(track, index)}
                  >
                    <div className={styles.trackArtwork}>
                      {getTrackArtwork(track, 'small') ? (
                        <img src={getTrackArtwork(track, 'small')} alt="" />
                      ) : (
                        <div className={styles.artworkPlaceholder}>
                          <MusicNoteIcon size={20} />
                        </div>
                      )}
                    </div>
                    <div className={styles.trackInfo}>
                      <span className={styles.trackTitle}>{track.title}</span>
                      <span className={styles.trackArtist}>
                        {track.artists?.[0]?.name || 'Unknown Artist'}
                      </span>
                    </div>
                  </button>
                  <button
                    className={styles.removeButton}
                    onClick={() => handleRemoveFromUpNext(index)}
                  >
                    <CloseIcon size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* History */}
        {history.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Recently Played</h2>
            <div className={styles.trackList}>
              {history.slice(0, 10).map((track, index) => (
                <div key={`history-${track.id}-${index}`} className={styles.trackItem}>
                  <button
                    className={styles.trackContent}
                    onClick={() => handlePlayFromHistory(track, index)}
                  >
                    <div className={styles.trackArtwork}>
                      {getTrackArtwork(track, 'small') ? (
                        <img src={getTrackArtwork(track, 'small')} alt="" />
                      ) : (
                        <div className={styles.artworkPlaceholder}>
                          <MusicNoteIcon size={20} />
                        </div>
                      )}
                    </div>
                    <div className={styles.trackInfo}>
                      <span className={styles.trackTitle}>{track.title}</span>
                      <span className={styles.trackArtist}>
                        {track.artists?.[0]?.name || 'Unknown Artist'}
                      </span>
                    </div>
                  </button>
                  <button className={styles.playHistoryButton}>
                    <PlayIcon size={16} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Empty State */}
        {!currentTrack && queue.length === 0 && (
          <div className={styles.emptyState}>
            <MusicNoteIcon size={48} />
            <h3>Your queue is empty</h3>
            <p>Search for music to start playing</p>
            <button
              className={styles.searchButton}
              onClick={() => navigate('/search')}
            >
              Search Music
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
