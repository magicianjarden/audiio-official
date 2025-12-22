/**
 * MiniPlayer - Compact player bar for bottom navigation
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayerStore } from '../stores/player-store';
import { getTrackArtwork } from '../utils/artwork';
import { PlayIcon, PauseIcon, MusicNoteIcon } from './Icons';
import styles from './MiniPlayer.module.css';

export function MiniPlayer() {
  const navigate = useNavigate();
  const { currentTrack, isPlaying, isBuffering, pause, resume, position, duration } = usePlayerStore();

  if (!currentTrack) return null;

  const progress = duration > 0 ? (position / duration) * 100 : 0;
  const artistName = currentTrack.artists?.[0]?.name || 'Unknown Artist';
  const artwork = getTrackArtwork(currentTrack, 'small');

  const handlePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPlaying) {
      pause();
    } else {
      resume();
    }
  };

  return (
    <div className={styles.container} onClick={() => navigate('/now-playing')}>
      <div className={styles.progress} style={{ width: `${progress}%` }} />

      <div className={styles.content}>
        <div className={styles.artwork}>
          {artwork ? (
            <img src={artwork} alt={currentTrack.title} />
          ) : (
            <div className={styles.artworkPlaceholder}>
              <MusicNoteIcon size={20} />
            </div>
          )}
        </div>

        <div className={styles.info}>
          <span className={styles.title}>{currentTrack.title}</span>
          <span className={styles.artist}>{artistName}</span>
        </div>

        <button
          className={styles.playButton}
          onClick={handlePlayPause}
          disabled={isBuffering}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isBuffering ? (
            <div className={styles.spinner} />
          ) : isPlaying ? (
            <PauseIcon size={24} />
          ) : (
            <PlayIcon size={24} />
          )}
        </button>
      </div>
    </div>
  );
}
