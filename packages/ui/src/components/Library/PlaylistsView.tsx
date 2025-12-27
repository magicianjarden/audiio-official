import React, { useState } from 'react';
import { useLibraryStore } from '../../stores/library-store';
import { useNavigationStore } from '../../stores/navigation-store';
import { useUIStore } from '../../stores/ui-store';
import { PlaylistCover } from '../common/PlaylistCover';
import { InputModal } from '../Modals/InputModal';
import {
  PlaylistIcon,
  PlayIcon,
  AddIcon,
  CloseIcon,
} from '@audiio/icons';

export const PlaylistsView: React.FC = () => {
  const { playlists, createPlaylist, deletePlaylist } = useLibraryStore();
  const { openPlaylist } = useNavigationStore();
  const {
    isCreatePlaylistModalOpen,
    openCreatePlaylistModal,
    closeCreatePlaylistModal,
  } = useUIStore();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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

  return (
    <div className="library-view">
      <header className="library-header">
        <div className="library-header-icon playlists-icon"><PlaylistIcon size={64} /></div>
        <div className="library-header-info">
          <span className="library-header-type">Library</span>
          <h1 className="library-header-title">Playlists</h1>
          <span className="library-header-count">{playlists.length} playlists</span>
        </div>
      </header>

      <div className="library-actions">
        <button className="library-create-button" onClick={openCreatePlaylistModal}>
          <AddIcon size={18} /> Create Playlist
        </button>
      </div>

      <div className="playlists-grid">
        {playlists.length === 0 ? (
          <div className="library-empty library-empty-centered">
            <div className="library-empty-icon"><PlaylistIcon size={48} /></div>
            <h3>Create your first playlist</h3>
            <p>Organize your favorite tracks</p>
            <button className="library-create-button" onClick={openCreatePlaylistModal}>
              <AddIcon size={18} /> Create Playlist
            </button>
          </div>
        ) : (
          playlists.map((playlist) => (
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
                  <button className="playlist-card-play"><PlayIcon size={24} /></button>
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
