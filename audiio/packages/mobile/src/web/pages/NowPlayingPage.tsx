/**
 * Now Playing Page - Full-screen player view with like/dislike and controls
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayerStore } from '../stores/player-store';
import { useLibraryStore, type DislikeReason } from '../stores/library-store';
import { getTrackArtwork } from '../utils/artwork';
import { DislikeModal } from '../components/DislikeModal';
import {
  PlayIcon,
  PauseIcon,
  PrevIcon,
  NextIcon,
  MusicNoteIcon,
  ChevronDownIcon,
  VolumeHighIcon,
  VolumeMuteIcon,
  HeartIcon,
  HeartOutlineIcon,
  ThumbDownIcon,
  ShuffleIcon,
  RepeatIcon,
  QueueIcon,
  MoreIcon
} from '../components/Icons';
import styles from './NowPlayingPage.module.css';

export function NowPlayingPage() {
  const navigate = useNavigate();
  const [showDislikeModal, setShowDislikeModal] = useState(false);

  const {
    currentTrack,
    isPlaying,
    isBuffering,
    position,
    duration,
    volume,
    isShuffled,
    repeatMode,
    pause,
    resume,
    seek,
    setVolume,
    nextTrack,
    previousTrack,
    toggleShuffle,
    toggleRepeat
  } = usePlayerStore();

  const {
    isLiked,
    toggleLike,
    dislikeTrack,
    fetchLibrary
  } = useLibraryStore();

  // Fetch library on mount
  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  if (!currentTrack) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <p>No track playing</p>
          <button onClick={() => navigate('/search')}>Search for music</button>
        </div>
      </div>
    );
  }

  const artistName = currentTrack.artists?.[0]?.name || 'Unknown Artist';
  const albumName = currentTrack.album?.name;
  const artwork = getTrackArtwork(currentTrack, 'large');
  const progress = duration > 0 ? (position / duration) * 100 : 0;
  const liked = isLiked(currentTrack.id);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPosition = parseFloat(e.target.value);
    seek(newPosition);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
  };

  const handleLike = async () => {
    await toggleLike(currentTrack);
  };

  const handleDislike = () => {
    setShowDislikeModal(true);
  };

  const handleDislikeSubmit = async (reasons: DislikeReason[]) => {
    await dislikeTrack(currentTrack, reasons);
    setShowDislikeModal(false);
    // Skip to next track
    nextTrack();
  };

  const getRepeatIcon = () => {
    if (repeatMode === 'one') {
      return <span className={styles.repeatOneIndicator}>1</span>;
    }
    return null;
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate(-1)}>
          <ChevronDownIcon size={24} />
        </button>
        <span className={styles.headerTitle}>Now Playing</span>
        <button className={styles.moreButton}>
          <MoreIcon size={24} />
        </button>
      </header>

      {/* Artwork */}
      <div className={styles.artworkContainer}>
        <div className={styles.artwork}>
          {artwork ? (
            <img src={artwork} alt={currentTrack.title} />
          ) : (
            <div className={styles.artworkPlaceholder}>
              <MusicNoteIcon size={64} />
            </div>
          )}
        </div>
      </div>

      {/* Track Info */}
      <div className={styles.info}>
        <h1 className={styles.title}>{currentTrack.title}</h1>
        <p className={styles.artist}>{artistName}</p>
        {albumName && <p className={styles.album}>{albumName}</p>}
      </div>

      {/* Action Row */}
      <div className={styles.actionRow}>
        <button
          className={`${styles.actionButton} ${isShuffled ? styles.active : ''}`}
          onClick={toggleShuffle}
          title="Shuffle"
        >
          <ShuffleIcon size={22} />
        </button>

        <button
          className={`${styles.actionButton} ${liked ? styles.liked : ''}`}
          onClick={handleLike}
          title={liked ? 'Unlike' : 'Like'}
        >
          {liked ? <HeartIcon size={22} /> : <HeartOutlineIcon size={22} />}
        </button>

        <button
          className={styles.actionButton}
          onClick={handleDislike}
          title="Not for me"
        >
          <ThumbDownIcon size={22} />
        </button>

        <button
          className={`${styles.actionButton} ${repeatMode !== 'none' ? styles.active : ''}`}
          onClick={toggleRepeat}
          title="Repeat"
        >
          <RepeatIcon size={22} />
          {getRepeatIcon()}
        </button>

        <button
          className={styles.actionButton}
          onClick={() => navigate('/queue')}
          title="Queue"
        >
          <QueueIcon size={22} />
        </button>
      </div>

      {/* Progress Bar */}
      <div className={styles.progress}>
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={position}
          onChange={handleSeek}
          className={styles.progressBar}
          style={{ '--progress': `${progress}%` } as React.CSSProperties}
        />
        <div className={styles.times}>
          <span>{formatTime(position)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Main Controls */}
      <div className={styles.controls}>
        <button className={styles.secondaryControl} onClick={previousTrack}>
          <PrevIcon size={28} />
        </button>

        <button
          className={styles.playButton}
          onClick={() => isPlaying ? pause() : resume()}
          disabled={isBuffering}
        >
          {isBuffering ? (
            <div className={styles.spinner} />
          ) : isPlaying ? (
            <PauseIcon size={32} />
          ) : (
            <PlayIcon size={32} />
          )}
        </button>

        <button className={styles.secondaryControl} onClick={nextTrack}>
          <NextIcon size={28} />
        </button>
      </div>

      {/* Volume Control */}
      <div className={styles.volume}>
        {volume === 0 ? <VolumeMuteIcon size={20} /> : <VolumeHighIcon size={20} />}
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={handleVolumeChange}
          className={styles.volumeBar}
          style={{ '--volume': `${volume * 100}%` } as React.CSSProperties}
        />
      </div>

      {/* Dislike Modal */}
      <DislikeModal
        isOpen={showDislikeModal}
        trackTitle={currentTrack.title}
        trackArtist={artistName}
        onSubmit={handleDislikeSubmit}
        onClose={() => setShowDislikeModal(false)}
      />
    </div>
  );
}
