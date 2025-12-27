/**
 * TrackActionSheet - Action sheet with track-specific options
 */

import React from 'react';
import { ActionSheet, type ActionSheetOption } from './ActionSheet';
import {
  PlayIcon,
  QueueIcon,
  PlaylistIcon,
  HeartIcon,
  HeartOutlineIcon,
  ThumbDownIcon,
  MoreIcon
} from '@audiio/icons';
import { getTrackArtwork } from '../utils/artwork';
import type { UnifiedTrack } from '@audiio/sdk';
import styles from './TrackActionSheet.module.css';

interface TrackActionSheetProps {
  isOpen: boolean;
  track: UnifiedTrack | null;
  isLiked?: boolean;
  onClose: () => void;
  onPlayNow: (track: UnifiedTrack) => void;
  onPlayNext: (track: UnifiedTrack) => void;
  onAddToQueue: (track: UnifiedTrack) => void;
  onAddToPlaylist: (track: UnifiedTrack) => void;
  onLike: (track: UnifiedTrack) => void;
  onUnlike: (track: UnifiedTrack) => void;
  onDislike: (track: UnifiedTrack) => void;
  onGoToArtist?: (track: UnifiedTrack) => void;
  onGoToAlbum?: (track: UnifiedTrack) => void;
}

export function TrackActionSheet({
  isOpen,
  track,
  isLiked = false,
  onClose,
  onPlayNow,
  onPlayNext,
  onAddToQueue,
  onAddToPlaylist,
  onLike,
  onUnlike,
  onDislike,
  onGoToArtist,
  onGoToAlbum
}: TrackActionSheetProps) {
  if (!track) return null;

  const artworkUrl = getTrackArtwork(track, 'small');
  const artistName = track.artists?.[0]?.name || 'Unknown Artist';
  const albumTitle = track.album?.title;

  const options: ActionSheetOption[] = [
    {
      id: 'play-now',
      label: 'Play Now',
      icon: <PlayIcon size={20} />,
      onClick: () => onPlayNow(track)
    },
    {
      id: 'play-next',
      label: 'Play Next',
      icon: <QueueIcon size={20} />,
      onClick: () => onPlayNext(track)
    },
    {
      id: 'add-to-queue',
      label: 'Add to Queue',
      icon: <QueueIcon size={20} />,
      onClick: () => onAddToQueue(track)
    },
    {
      id: 'add-to-playlist',
      label: 'Add to Playlist',
      icon: <PlaylistIcon size={20} />,
      onClick: () => onAddToPlaylist(track)
    },
    {
      id: isLiked ? 'unlike' : 'like',
      label: isLiked ? 'Remove from Likes' : 'Add to Likes',
      icon: isLiked ? <HeartIcon size={20} /> : <HeartOutlineIcon size={20} />,
      onClick: () => isLiked ? onUnlike(track) : onLike(track)
    },
    {
      id: 'dislike',
      label: 'Not for me...',
      icon: <ThumbDownIcon size={20} />,
      onClick: () => onDislike(track),
      destructive: true
    }
  ];

  // Add navigation options if handlers are provided
  if (onGoToArtist && track.artists?.[0]) {
    options.push({
      id: 'go-to-artist',
      label: `Go to ${artistName}`,
      icon: <MoreIcon size={20} />,
      onClick: () => onGoToArtist(track)
    });
  }

  if (onGoToAlbum && track.album) {
    options.push({
      id: 'go-to-album',
      label: `Go to ${albumTitle || 'Album'}`,
      icon: <MoreIcon size={20} />,
      onClick: () => onGoToAlbum(track)
    });
  }

  const header = (
    <div className={styles.header}>
      <img
        src={artworkUrl || '/placeholder-album.svg'}
        alt={track.title}
        className={styles.artwork}
      />
      <div className={styles.info}>
        <h3 className={styles.title}>{track.title}</h3>
        <p className={styles.artist}>{artistName}</p>
        {albumTitle && <p className={styles.album}>{albumTitle}</p>}
      </div>
    </div>
  );

  return (
    <ActionSheet
      isOpen={isOpen}
      options={options}
      onClose={onClose}
      header={header}
    />
  );
}
