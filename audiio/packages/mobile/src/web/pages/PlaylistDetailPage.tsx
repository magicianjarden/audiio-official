/**
 * PlaylistDetailPage - Shows a playlist's tracks with management options
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLibraryStore } from '../stores/library-store';
import { usePlayerStore } from '../stores/player-store';
import { TrackList } from '../components/TrackList';
import {
  BackIcon,
  PlayIcon,
  ShuffleIcon,
  MoreIcon,
  TrashIcon,
  PlaylistIcon,
  SpinnerIcon
} from '../components/Icons';
import { getTrackArtwork } from '../utils/artwork';
import styles from './PlaylistDetailPage.module.css';

export function PlaylistDetailPage() {
  const { playlistId } = useParams<{ playlistId: string }>();
  const navigate = useNavigate();
  const { getPlaylist, deletePlaylist, renamePlaylist, fetchLibrary } = useLibraryStore();
  const { play, setQueue, shuffle } = usePlayerStore();
  const [showMenu, setShowMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const playlist = playlistId ? getPlaylist(playlistId) : undefined;

  // Fetch library if not loaded
  useEffect(() => {
    if (!playlist) {
      fetchLibrary();
    }
  }, [playlist, fetchLibrary]);

  if (!playlist) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <button className={styles.backButton} onClick={() => navigate(-1)}>
            <BackIcon size={24} />
          </button>
        </header>
        <div className={styles.loading}>
          <SpinnerIcon size={32} />
          <p>Loading playlist...</p>
        </div>
      </div>
    );
  }

  const artwork = playlist.tracks.length > 0
    ? getTrackArtwork(playlist.tracks[0], 'large')
    : null;

  const handlePlayAll = async () => {
    if (playlist.tracks.length === 0) return;
    setQueue(playlist.tracks);
    await play(playlist.tracks[0]);
  };

  const handleShuffle = async () => {
    if (playlist.tracks.length === 0) return;
    const shuffled = [...playlist.tracks].sort(() => Math.random() - 0.5);
    setQueue(shuffled);
    await play(shuffled[0]);
  };

  const handleRename = async () => {
    const newName = window.prompt('Enter new playlist name:', playlist.name);
    if (newName?.trim() && newName !== playlist.name) {
      setIsLoading(true);
      await renamePlaylist(playlist.id, newName.trim());
      setIsLoading(false);
    }
    setShowMenu(false);
  };

  const handleDelete = async () => {
    if (window.confirm(`Delete playlist "${playlist.name}"?`)) {
      setIsLoading(true);
      await deletePlaylist(playlist.id);
      navigate('/library');
    }
    setShowMenu(false);
  };

  const totalDuration = playlist.tracks.reduce((sum, track) => sum + (track.duration || 0), 0);
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours} hr ${mins} min`;
    }
    return `${mins} min`;
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate(-1)}>
          <BackIcon size={24} />
        </button>
        <div className={styles.headerActions}>
          <button
            className={styles.menuButton}
            onClick={() => setShowMenu(!showMenu)}
          >
            <MoreIcon size={24} />
          </button>
        </div>
      </header>

      {/* Menu Dropdown */}
      {showMenu && (
        <>
          <div className={styles.menuOverlay} onClick={() => setShowMenu(false)} />
          <div className={styles.menu}>
            <button onClick={handleRename}>Rename Playlist</button>
            <button onClick={handleDelete} className={styles.deleteAction}>
              <TrashIcon size={18} />
              Delete Playlist
            </button>
          </div>
        </>
      )}

      {/* Playlist Info */}
      <div className={styles.info}>
        <div className={styles.artwork}>
          {artwork ? (
            <img src={artwork} alt={playlist.name} />
          ) : (
            <div className={styles.artworkPlaceholder}>
              <PlaylistIcon size={64} />
            </div>
          )}
        </div>
        <h1 className={styles.title}>{playlist.name}</h1>
        {playlist.description && (
          <p className={styles.description}>{playlist.description}</p>
        )}
        <p className={styles.meta}>
          {playlist.tracks.length} {playlist.tracks.length === 1 ? 'track' : 'tracks'}
          {playlist.tracks.length > 0 && ` • ${formatDuration(totalDuration)}`}
        </p>
      </div>

      {/* Action Buttons */}
      <div className={styles.actions}>
        <button
          className={styles.playButton}
          onClick={handlePlayAll}
          disabled={playlist.tracks.length === 0}
        >
          <PlayIcon size={24} />
          Play
        </button>
        <button
          className={styles.shuffleButton}
          onClick={handleShuffle}
          disabled={playlist.tracks.length === 0}
        >
          <ShuffleIcon size={20} />
          Shuffle
        </button>
      </div>

      {/* Track List */}
      <div className={styles.trackList}>
        {playlist.tracks.length === 0 ? (
          <div className={styles.empty}>
            <PlaylistIcon size={48} />
            <h3>Playlist is empty</h3>
            <p>Add tracks to this playlist from any track's menu</p>
          </div>
        ) : (
          <TrackList tracks={playlist.tracks} showIndex={true} showMoreButton={true} />
        )}
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className={styles.loadingOverlay}>
          <SpinnerIcon size={32} />
        </div>
      )}
    </div>
  );
}
