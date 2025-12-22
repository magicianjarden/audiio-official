import React from 'react';
import { useLibraryStore } from '../../stores/library-store';
import { useNavigationStore } from '../../stores/navigation-store';
import {
  PlaylistIcon,
  PlayIcon,
  AddIcon,
  CloseIcon,
  MusicNoteIcon
} from '../Icons/Icons';

export const PlaylistsView: React.FC = () => {
  const { playlists, createPlaylist, deletePlaylist } = useLibraryStore();
  const { openPlaylist } = useNavigationStore();

  const handleCreatePlaylist = () => {
    const name = prompt('Enter playlist name:');
    if (name?.trim()) {
      const playlist = createPlaylist(name.trim());
      openPlaylist(playlist.id);
    }
  };

  const handleDeletePlaylist = (e: React.MouseEvent, playlistId: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this playlist?')) {
      deletePlaylist(playlistId);
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
        <button className="library-create-button" onClick={handleCreatePlaylist}>
          <AddIcon size={18} /> Create Playlist
        </button>
      </div>

      <div className="playlists-grid">
        {playlists.length === 0 ? (
          <div className="library-empty">
            <div className="library-empty-icon"><PlaylistIcon size={48} /></div>
            <h3>Create your first playlist</h3>
            <p>Organize your favorite tracks</p>
            <button className="library-create-button" onClick={handleCreatePlaylist}>
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
                {playlist.tracks.length > 0 && playlist.tracks[0]?.artwork?.medium ? (
                  <img
                    src={playlist.tracks[0].artwork.medium}
                    alt={playlist.name}
                    loading="lazy"
                  />
                ) : (
                  <div className="playlist-card-artwork-placeholder"><MusicNoteIcon size={48} /></div>
                )}
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
    </div>
  );
};
