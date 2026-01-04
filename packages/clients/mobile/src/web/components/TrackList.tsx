/**
 * TrackList - Reusable track list component with swipe actions
 */

import React, { useRef, useCallback, useMemo } from 'react';
import { usePlayerStore } from '../stores/player-store';
import { useLibraryStore } from '../stores/library-store';
import { useActionSheet } from '../contexts/ActionSheetContext';
import { getTrackArtwork } from '../utils/artwork';
import { triggerHaptic } from '../utils/haptics';
import { SwipeableRow, type SwipeAction } from './SwipeableRow';
import { MusicNoteIcon, MoreIcon, HeartIcon, HeartOutlineIcon, QueueIcon, ThumbDownIcon } from '@audiio/icons';
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
  const { play, addToQueue, currentTrack, isPlaying } = usePlayerStore();
  const { isLiked, toggleLike, addDislike } = useLibraryStore();
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
      triggerHaptic('medium');
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

  // Create swipe actions for a track
  const getSwipeActions = useCallback((track: Track): { left: SwipeAction[], right: SwipeAction[] } => {
    const liked = isLiked(track.id);

    const leftActions: SwipeAction[] = [
      {
        key: 'queue',
        icon: <QueueIcon size={22} />,
        label: 'Queue',
        color: '#fff',
        backgroundColor: '#1db954',
        onAction: () => {
          addToQueue(track as any);
          triggerHaptic('light');
        },
      },
    ];

    const rightActions: SwipeAction[] = [
      {
        key: 'like',
        icon: liked ? <HeartIcon size={22} /> : <HeartOutlineIcon size={22} />,
        label: liked ? 'Unlike' : 'Like',
        color: '#fff',
        backgroundColor: liked ? '#666' : '#ff4757',
        onAction: () => {
          toggleLike(track as any);
          triggerHaptic('light');
        },
      },
    ];

    return { left: leftActions, right: rightActions };
  }, [isLiked, toggleLike, addToQueue]);

  return (
    <div className={styles.list}>
      {tracks.map((track, index) => {
        const isCurrentTrack = currentTrack?.id === track.id;
        const artistName = track.artists?.[0]?.name || 'Unknown Artist';
        const artwork = getTrackArtwork(track, 'small');
        const swipeActions = getSwipeActions(track);

        return (
          <SwipeableRow
            key={track.id}
            leftActions={swipeActions.left}
            rightActions={swipeActions.right}
          >
            <button
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
          </SwipeableRow>
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
