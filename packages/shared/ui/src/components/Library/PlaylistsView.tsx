import React, { useState, useMemo, useCallback } from 'react';
import { useLibraryStore } from '../../stores/library-store';
import { useNavigationStore } from '../../stores/navigation-store';
import { usePlayerStore } from '../../stores/player-store';
import { useUIStore } from '../../stores/ui-store';
import { PlaylistCover } from '../common/PlaylistCover';
import { InputModal } from '../Modals/InputModal';
import { FloatingSearch, SearchAction } from '../Search/FloatingSearch';
import {
  PlaylistIcon,
  PlayIcon,
  CloseIcon,
  AddIcon,
  SortIcon,
} from '@audiio/icons';

export const PlaylistsView: React.FC = () => {
  const { playlists, createPlaylist, deletePlaylist } = useLibraryStore();
  const { openPlaylist } = useNavigationStore();
  const { play, setQueue } = usePlayerStore();
  const {
    isCreatePlaylistModalOpen,
    openCreatePlaylistModal,
    closeCreatePlaylistModal,
  } = useUIStore();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent');

  const filteredAndSortedPlaylists = useMemo(() => {
    let filtered = [...playlists];

    // Filter by search query
    if (searchQuery?.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(playlist =>
        playlist.name.toLowerCase().includes(query)
      );
    }

    // Sort playlists
    switch (sortBy) {
      case 'name':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'tracks':
        filtered.sort((a, b) => b.tracks.length - a.tracks.length);
        break;
      case 'recent':
      default:
        break;
    }

    return filtered;
  }, [playlists, searchQuery, sortBy]);

  const handleCreatePlaylist = (name: string) => {
    const playlist = createPlaylist(name);
    openPlaylist(playlist.id);
  };

  const handleDeletePlaylist = (e: React.MouseEvent, playlistId: string) => {
    e.stopPropagation();
    setDeleteConfirmId(playlistId);
  };

  const confirmDelete = () => {
    if (deleteConfirmId) {
      deletePlaylist(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const handlePlayPlaylist = (e: React.MouseEvent, playlistId: string) => {
    e.stopPropagation();
    const playlist = playlists.find(p => p.id === playlistId);
    if (playlist && playlist.tracks.length > 0) {
      setQueue(playlist.tracks, 0);
      play(playlist.tracks[0]!);
    }
  };

  // Build actions for the search bar
  const actions: SearchAction[] = useMemo(() => {
    const result: SearchAction[] = [];

    // Create action
    result.push({
      id: 'create',
      label: 'New Playlist',
      icon: <AddIcon size={14} />,
      shortcut: 'N',
      primary: true,
      onClick: openCreatePlaylistModal,
    });

    // Sort options
    result.push({
      id: 'sort-recent',
      label: 'Recent',
      icon: <SortIcon size={14} />,
      active: sortBy === 'recent',
      onClick: () => setSortBy('recent'),
    });
    result.push({
      id: 'sort-name',
      label: 'Name',
      icon: <SortIcon size={14} />,
      active: sortBy === 'name',
      onClick: () => setSortBy('name'),
    });
    result.push({
      id: 'sort-tracks',
      label: 'Most Songs',
      icon: <SortIcon size={14} />,
      active: sortBy === 'tracks',
      onClick: () => setSortBy('tracks'),
    });

    return result;
  }, [sortBy, openCreatePlaylistModal]);

  const isSearching = searchQuery.trim().length > 0;

  const handleClose = useCallback(() => {
    setSearchQuery('');
  }, []);

  return (
    <div className={`library-view playlists-view ${isSearching ? 'searching' : ''}`}>
      <FloatingSearch
        onSearch={setSearchQuery}
        onClose={handleClose}
        isSearchActive={isSearching}
        actions={actions}
        pageContext={{
          type: 'playlists',
          label: 'Playlists',
          icon: <PlaylistIcon size={14} />,
        }}
      />

      <div className="library-content playlists-grid">
        {playlists.length === 0 ? (
          <div className="library-empty library-empty-centered">
            <div className="library-empty-icon"><PlaylistIcon size={48} /></div>
            <h3>Create your first playlist</h3>
            <p>Organize your favorite tracks</p>
            <button className="library-create-button" onClick={openCreatePlaylistModal}>
              <AddIcon size={18} /> Create Playlist
            </button>
          </div>
        ) : filteredAndSortedPlaylists.length === 0 ? (
          <div className="library-empty library-empty-centered">
            <div className="library-empty-icon"><PlaylistIcon size={48} /></div>
            <h3>No matching playlists</h3>
            <p>Try a different search term</p>
          </div>
        ) : (
          filteredAndSortedPlaylists.map((playlist) => (
            <div
              key={playlist.id}
              className="playlist-card"
              onClick={() => openPlaylist(playlist.id)}
            >
              <div className="playlist-card-artwork">
                <PlaylistCover
                  tracks={playlist.tracks}
                  name={playlist.name}
                  size="lg"
                />
                <div className="playlist-card-overlay">
                  <button
                    className="playlist-card-play"
                    onClick={(e) => handlePlayPlaylist(e, playlist.id)}
                    disabled={playlist.tracks.length === 0}
                  >
                    <PlayIcon size={24} />
                  </button>
                </div>
              </div>
              <div className="playlist-card-info">
                <div className="playlist-card-name">{playlist.name}</div>
                <div className="playlist-card-count">
                  {playlist.tracks.length} songs
                </div>
              </div>
              <button
                className="playlist-card-delete"
                onClick={(e) => handleDeletePlaylist(e, playlist.id)}
                title="Delete playlist"
              >
                <CloseIcon size={16} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Create Playlist Modal */}
      {isCreatePlaylistModalOpen && (
        <InputModal
          title="Create Playlist"
          placeholder="Playlist name"
          submitLabel="Create"
          onSubmit={handleCreatePlaylist}
          onClose={closeCreatePlaylistModal}
          icon={<PlaylistIcon size={20} />}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="modal-overlay">
          <div className="modal modal-small">
            <header className="modal-header">
              <h2>Delete Playlist?</h2>
              <button className="modal-close" onClick={() => setDeleteConfirmId(null)}>
                <CloseIcon size={20} />
              </button>
            </header>
            <div className="modal-content">
              <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
                This action cannot be undone.
              </p>
              <div className="modal-actions">
                <button
                  className="modal-button secondary"
                  onClick={() => setDeleteConfirmId(null)}
                >
                  Cancel
                </button>
                <button
                  className="modal-button primary"
                  onClick={confirmDelete}
                  style={{ background: 'var(--danger)' }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
