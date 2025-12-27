/**
 * LibraryPage - Shows user's library (Likes, Dislikes, Playlists)
 *
 * Features:
 * - Pull-to-refresh for syncing
 * - Tabs for likes, dislikes, and playlists (like host app)
 * - Badge counts on tabs
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLibraryStore, type Track, type Playlist } from '../stores/library-store';
import { TrackList } from '../components/TrackList';
import { PullToRefresh } from '../components/PullToRefresh';
import { LibrarySkeleton } from '../components/Skeleton';
import { HeartIcon, PlaylistIcon, AddIcon, SpinnerIcon, RefreshIcon, ThumbDownIcon } from '@audiio/icons';
import { getTrackArtwork } from '../utils/artwork';
import styles from './LibraryPage.module.css';

type LibraryTab = 'likes' | 'dislikes' | 'playlists';

export function LibraryPage() {
  const [activeTab, setActiveTab] = useState<LibraryTab>('likes');
  const navigate = useNavigate();
  const {
    likedTracks,
    dislikedTracks,
    playlists,
    isLoading,
    isSynced,
    fetchLibrary,
    refreshLibrary,
    createPlaylist,
    removeDislike
  } = useLibraryStore();

  // Fetch library on mount
  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  const handleCreatePlaylist = async () => {
    const name = window.prompt('Enter playlist name:');
    if (name?.trim()) {
      const playlist = await createPlaylist(name.trim());
      if (playlist) {
        navigate(`/playlist/${playlist.id}`);
      }
    }
  };

  const handlePlaylistClick = (playlistId: string) => {
    navigate(`/playlist/${playlistId}`);
  };

  const getPlaylistArtwork = (playlist: typeof playlists[0]) => {
    // Use first track's artwork or placeholder
    if (playlist.tracks.length > 0) {
      return getTrackArtwork(playlist.tracks[0], 'medium');
    }
    return null;
  };

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    await refreshLibrary();
  }, [refreshLibrary]);

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <h1 className={styles.title}>Your Library</h1>
        <button
          className={styles.refreshButton}
          onClick={refreshLibrary}
          disabled={isLoading}
        >
          <RefreshIcon size={20} />
        </button>
      </header>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'likes' ? styles.active : ''}`}
          onClick={() => setActiveTab('likes')}
        >
          <HeartIcon size={18} />
          Likes
          {likedTracks.length > 0 && (
            <span className={styles.badge}>{likedTracks.length}</span>
          )}
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'dislikes' ? styles.active : ''}`}
          onClick={() => setActiveTab('dislikes')}
        >
          <ThumbDownIcon size={18} />
          Dislikes
          {dislikedTracks.length > 0 && (
            <span className={styles.badge}>{dislikedTracks.length}</span>
          )}
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'playlists' ? styles.active : ''}`}
          onClick={() => setActiveTab('playlists')}
        >
          <PlaylistIcon size={18} />
          Playlists
          {playlists.length > 0 && (
            <span className={styles.badge}>{playlists.length}</span>
          )}
        </button>
      </div>

      {/* Sync status */}
      {!isSynced && !isLoading && (
        <div className={styles.syncBanner}>
          <span>Library not synced with desktop</span>
          <button onClick={refreshLibrary}>Sync now</button>
        </div>
      )}

      {/* Content with pull-to-refresh */}
      <PullToRefresh onRefresh={handleRefresh} disabled={isLoading}>
        <div className={styles.content}>
          {isLoading ? (
            <LibrarySkeleton />
          ) : activeTab === 'likes' ? (
            <LikesTab tracks={likedTracks} />
          ) : activeTab === 'dislikes' ? (
            <DislikesTab tracks={dislikedTracks} onRemoveDislike={removeDislike} />
          ) : (
            <PlaylistsTab
              playlists={playlists}
              onPlaylistClick={handlePlaylistClick}
              onCreatePlaylist={handleCreatePlaylist}
              getPlaylistArtwork={getPlaylistArtwork}
            />
          )}
        </div>
      </PullToRefresh>
    </div>
  );
}

// Likes Tab Component
function LikesTab({ tracks }: { tracks: Track[] }) {
  if (tracks.length === 0) {
    return (
      <div className={styles.empty}>
        <HeartIcon size={48} />
        <h3>No liked tracks yet</h3>
        <p>Tracks you like will appear here</p>
      </div>
    );
  }

  return (
    <div className={styles.trackSection}>
      <TrackList tracks={tracks} showMoreButton={true} />
    </div>
  );
}

// Dislikes Tab Component
interface DislikesTabProps {
  tracks: Track[];
  onRemoveDislike: (trackId: string) => Promise<boolean>;
}

function DislikesTab({ tracks, onRemoveDislike }: DislikesTabProps) {
  if (tracks.length === 0) {
    return (
      <div className={styles.empty}>
        <ThumbDownIcon size={48} />
        <h3>No disliked tracks</h3>
        <p>Tracks you dislike won't be recommended</p>
      </div>
    );
  }

  return (
    <div className={styles.trackSection}>
      <p className={styles.dislikesHint}>
        These tracks won't appear in your recommendations
      </p>
      <TrackList tracks={tracks} showMoreButton={true} />
    </div>
  );
}

// Playlists Tab Component
interface PlaylistsTabProps {
  playlists: Playlist[];
  onPlaylistClick: (id: string) => void;
  onCreatePlaylist: () => void;
  getPlaylistArtwork: (playlist: Playlist) => string | null;
}

function PlaylistsTab({
  playlists,
  onPlaylistClick,
  onCreatePlaylist,
  getPlaylistArtwork
}: PlaylistsTabProps) {
  return (
    <div className={styles.playlistsSection}>
      {/* Create Playlist Button */}
      <button className={styles.createPlaylist} onClick={onCreatePlaylist}>
        <div className={styles.createPlaylistIcon}>
          <AddIcon size={24} />
        </div>
        <span>Create Playlist</span>
      </button>

      {/* Playlists Grid */}
      {playlists.length === 0 ? (
        <div className={styles.empty}>
          <PlaylistIcon size={48} />
          <h3>No playlists yet</h3>
          <p>Create your first playlist to organize your music</p>
        </div>
      ) : (
        <div className={styles.playlistGrid}>
          {playlists.map((playlist) => {
            const artwork = getPlaylistArtwork(playlist);
            return (
              <button
                key={playlist.id}
                className={styles.playlistCard}
                onClick={() => onPlaylistClick(playlist.id)}
              >
                <div className={styles.playlistArtwork}>
                  {artwork ? (
                    <img src={artwork} alt={playlist.name} />
                  ) : (
                    <div className={styles.playlistPlaceholder}>
                      <PlaylistIcon size={32} />
                    </div>
                  )}
                </div>
                <div className={styles.playlistInfo}>
                  <span className={styles.playlistName}>{playlist.name}</span>
                  <span className={styles.playlistCount}>
                    {playlist.tracks.length} {playlist.tracks.length === 1 ? 'track' : 'tracks'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
