/**
 * Queue Page - View and manage the playback queue
 *
 * Features:
 * - Current track display
 * - Up next tracks list
 * - Remove tracks from queue
 * - Clear queue
 */

import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayerStore, usePlaybackState } from '../stores/player-store';
import { getTrackArtwork } from '../utils/artwork';
import { triggerHaptic } from '../utils/haptics';
import {
  ChevronLeftIcon,
  MusicNoteIcon,
  CloseIcon,
  TrashIcon
} from '@audiio/icons';
import styles from './QueuePage.module.css';

export function QueuePage() {
  const navigate = useNavigate();
  const { currentTrack, isPlaying } = usePlaybackState();
  const { queue, queueIndex, playFromQueue, removeFromQueue, clearQueue } = usePlayerStore();

  // Get upcoming tracks (after current)
  const upNextTracks = queue.slice(queueIndex + 1);

  // Handle play track from queue
  const handlePlayTrack = useCallback((index: number) => {
    triggerHaptic('light');
    // Index in full queue = queueIndex + 1 + index (since upNext starts after current)
    playFromQueue(queueIndex + 1 + index);
  }, [queueIndex, playFromQueue]);

  // Handle remove track
  const handleRemoveTrack = useCallback((e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    triggerHaptic('light');
    // Remove from actual queue position
    removeFromQueue(queueIndex + 1 + index);
  }, [queueIndex, removeFromQueue]);

  // Handle clear queue
  const handleClearQueue = useCallback(() => {
    triggerHaptic('medium');
    clearQueue();
  }, [clearQueue]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate(-1)}>
          <ChevronLeftIcon size={28} />
        </button>
        <h1 className={styles.title}>Queue</h1>
        {upNextTracks.length > 0 && (
          <button className={styles.clearButton} onClick={handleClearQueue}>
            <TrashIcon size={20} />
          </button>
        )}
      </header>

      {/* Content */}
      <div className={styles.content}>
        {/* Now Playing */}
        {currentTrack && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Now Playing</h2>
            <div className={styles.nowPlaying}>
              <div className={styles.nowPlayingArtwork}>
                {getTrackArtwork(currentTrack, 'small') ? (
                  <img
                    src={getTrackArtwork(currentTrack, 'small') || ''}
                    alt={currentTrack.title}
                  />
                ) : (
                  <div className={styles.artworkPlaceholder}>
                    <MusicNoteIcon size={24} />
                  </div>
                )}
                {isPlaying && (
                  <div className={styles.playingIndicator}>
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                )}
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
          <h2 className={styles.sectionTitle}>
            Up Next
            {upNextTracks.length > 0 && (
              <span className={styles.trackCount}>{upNextTracks.length} tracks</span>
            )}
          </h2>

          {upNextTracks.length === 0 ? (
            <div className={styles.emptyQueue}>
              <p>No tracks in queue</p>
              <p className={styles.hint}>Add tracks from search or discover</p>
            </div>
          ) : (
            <div className={styles.trackList}>
              {upNextTracks.map((track, index) => (
                <div
                  key={`${track.id}-${index}`}
                  className={styles.trackRow}
                  onClick={() => handlePlayTrack(index)}
                >
                  <span className={styles.trackNumber}>{index + 1}</span>
                  <div className={styles.trackArtwork}>
                    {getTrackArtwork(track, 'small') ? (
                      <img
                        src={getTrackArtwork(track, 'small') || ''}
                        alt={track.title}
                      />
                    ) : (
                      <div className={styles.artworkPlaceholder}>
                        <MusicNoteIcon size={16} />
                      </div>
                    )}
                  </div>
                  <div className={styles.trackInfo}>
                    <span className={styles.trackTitle}>{track.title}</span>
                    <span className={styles.trackArtist}>
                      {track.artists?.[0]?.name || 'Unknown Artist'}
                    </span>
                  </div>
                  <button
                    className={styles.removeButton}
                    onClick={(e) => handleRemoveTrack(e, index)}
                  >
                    <CloseIcon size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
