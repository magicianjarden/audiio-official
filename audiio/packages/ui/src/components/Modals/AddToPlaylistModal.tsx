import React, { useState, useEffect, useRef } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { useLibraryStore } from '../../stores/library-store';
import { CloseIcon, AddIcon, PlaylistIcon, CheckIcon } from '../Icons/Icons';

interface AddToPlaylistModalProps {
  track: UnifiedTrack;
  onClose: () => void;
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  track,
  onClose
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [addedTo, setAddedTo] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const { playlists, createPlaylist, addToPlaylist } = useLibraryStore();

  // Close on escape or click outside
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Focus input when creating
  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreating]);

  // Check which playlists already contain the track
  useEffect(() => {
    const existingPlaylists = new Set<string>();
    playlists.forEach(p => {
      if (p.tracks.some(t => t.id === track.id)) {
        existingPlaylists.add(p.id);
      }
    });
    setAddedTo(existingPlaylists);
  }, [playlists, track.id]);

  const handleCreatePlaylist = () => {
    if (newPlaylistName.trim()) {
      const playlist = createPlaylist(newPlaylistName.trim());
      addToPlaylist(playlist.id, track);
      setAddedTo(prev => new Set(prev).add(playlist.id));
      setNewPlaylistName('');
      setIsCreating(false);
    }
  };

  const handleAddToPlaylist = (playlistId: string) => {
    if (!addedTo.has(playlistId)) {
      addToPlaylist(playlistId, track);
      setAddedTo(prev => new Set(prev).add(playlistId));
    }
  };

  const artworkUrl = track.artwork?.medium ?? track.album?.artwork?.medium;

  return (
    <div className="modal-overlay">
      <div className="modal" ref={modalRef}>
        <header className="modal-header">
          <h2>Add to Playlist</h2>
          <button className="modal-close" onClick={onClose}>
            <CloseIcon size={20} />
          </button>
        </header>

        <div className="modal-track-preview">
          {artworkUrl ? (
            <img src={artworkUrl} alt={track.title} />
          ) : (
            <div className="modal-track-placeholder">
              <PlaylistIcon size={24} />
            </div>
          )}
          <div className="modal-track-info">
            <div className="modal-track-title">{track.title}</div>
            <div className="modal-track-artist">
              {track.artists.map(a => a.name).join(', ')}
            </div>
          </div>
        </div>

        <div className="modal-content">
          {isCreating ? (
            <div className="modal-create-form">
              <input
                ref={inputRef}
                type="text"
                placeholder="Playlist name"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreatePlaylist();
                  if (e.key === 'Escape') setIsCreating(false);
                }}
              />
              <div className="modal-create-buttons">
                <button
                  className="modal-button secondary"
                  onClick={() => setIsCreating(false)}
                >
                  Cancel
                </button>
                <button
                  className="modal-button primary"
                  onClick={handleCreatePlaylist}
                  disabled={!newPlaylistName.trim()}
                >
                  Create
                </button>
              </div>
            </div>
          ) : (
            <button
              className="modal-create-playlist"
              onClick={() => setIsCreating(true)}
            >
              <AddIcon size={20} />
              <span>New Playlist</span>
            </button>
          )}

          <div className="modal-playlist-list">
            {playlists.length === 0 ? (
              <div className="modal-empty">
                No playlists yet. Create one above!
              </div>
            ) : (
              playlists.map((playlist) => {
                const isAdded = addedTo.has(playlist.id);
                return (
                  <button
                    key={playlist.id}
                    className={`modal-playlist-item ${isAdded ? 'added' : ''}`}
                    onClick={() => handleAddToPlaylist(playlist.id)}
                    disabled={isAdded}
                  >
                    <PlaylistIcon size={20} />
                    <span className="modal-playlist-name">{playlist.name}</span>
                    <span className="modal-playlist-count">
                      {playlist.tracks.length} songs
                    </span>
                    {isAdded && <CheckIcon size={18} />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
