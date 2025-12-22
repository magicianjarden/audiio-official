/**
 * TrackList - Reusable track list component
 */

import React, { useRef, useCallback } from 'react';
import { usePlayerStore } from '../stores/player-store';
import { useActionSheet } from '../contexts/ActionSheetContext';
import { getTrackArtwork } from '../utils/artwork';
import { MusicNoteIcon, MoreIcon } from './Icons';
import styles from './TrackList.module.css';

interface Track {
  id: string;
  title: string;
  artists: { id: string; name: string }[];
  album?: { id: string; name: string; artwork?: unknown };
  artwork?: unknown;
  duration?: number;
}

interface TrackListProps {
  tracks: Track[];
  showIndex?: boolean;
  showMoreButton?: boolean;
}

// Long press detection time in ms
const LONG_PRESS_TIME = 500;

export function TrackList({ tracks, showIndex = false, showMoreButton = true }: TrackListProps) {
  const { play, currentTrack, isPlaying } = usePlayerStore();
  const { showTrackActions } = useActionSheet();
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);

  const handleTrackClick = async (track: Track) => {
    // Don't play if this was a long press
    if (isLongPress.current) {
      isLongPress.current = false;
      return;
    }
    await play(track);
  };

  const handleTouchStart = useCallback((track: Track) => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      showTrackActions(track as any);
    }, LONG_PRESS_TIME);
  }, [showTrackActions]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleMoreClick = useCallback((e: React.MouseEvent, track: Track) => {
    e.stopPropagation();
    showTrackActions(track as any);
  }, [showTrackActions]);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={styles.list}>
      {tracks.map((track, index) => {
        const isCurrentTrack = currentTrack?.id === track.id;
        const artistName = track.artists?.[0]?.name || 'Unknown Artist';
        const artwork = getTrackArtwork(track, 'small');

        return (
          <button
            key={track.id}
            className={`${styles.item} ${isCurrentTrack ? styles.active : ''}`}
            onClick={() => handleTrackClick(track)}
            onTouchStart={() => handleTouchStart(track)}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            onContextMenu={(e) => {
              e.preventDefault();
              showTrackActions(track as any);
            }}
          >
            {showIndex && (
              <span className={styles.index}>
                {isCurrentTrack && isPlaying ? (
                  <PlayingIndicator />
                ) : (
                  index + 1
                )}
              </span>
            )}

            <div className={styles.artwork}>
              {artwork ? (
                <img src={artwork} alt={track.title} />
              ) : (
                <div className={styles.artworkPlaceholder}>
                  <MusicNoteIcon size={16} />
                </div>
              )}
              {isCurrentTrack && isPlaying && !showIndex && (
                <div className={styles.playingOverlay}>
                  <PlayingIndicator />
                </div>
              )}
            </div>

            <div className={styles.info}>
              <span className={styles.title}>{track.title}</span>
              <span className={styles.artist}>{artistName}</span>
            </div>

            {showMoreButton ? (
              <button
                className={styles.moreButton}
                onClick={(e) => handleMoreClick(e, track)}
                onTouchStart={(e) => e.stopPropagation()}
              >
                <MoreIcon size={20} />
              </button>
            ) : (
              <span className={styles.duration}>{formatDuration(track.duration)}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function PlayingIndicator() {
  return (
    <div className={styles.playingIndicator}>
      <span />
      <span />
      <span />
    </div>
  );
}
