import React, { useState, useMemo } from 'react';
import { useLibraryStore } from '../../stores/library-store';
import { useNavigationStore } from '../../stores/navigation-store';
import { usePlayerStore } from '../../stores/player-store';
import { useTrackContextMenu } from '../../contexts/ContextMenuContext';
import { TrackRow } from '../TrackRow/TrackRow';
import { LibraryActionBar, SortOption } from './LibraryActionBar';
import {
  BackIcon,
  CloseIcon,
  MusicNoteIcon,
  EditIcon
} from '@audiio/icons';
import type { Track } from '@audiio/core';

const SORT_OPTIONS: SortOption[] = [
  { value: 'custom', label: 'Custom Order' },
  { value: 'title', label: 'Title A-Z' },
  { value: 'title-desc', label: 'Title Z-A' },
  { value: 'artist', label: 'Artist A-Z' },
  { value: 'artist-desc', label: 'Artist Z-A' },
];

const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
};

export const PlaylistDetailView: React.FC = () => {
  const { selectedPlaylistId, goBack } = useNavigationStore();
  const { playlists, renamePlaylist, removeFromPlaylist } = useLibraryStore();
  const { play, setQueue, currentTrack } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('custom');
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');

  const playlist = playlists.find(p => p.id === selectedPlaylistId);

  const filteredAndSortedTracks = useMemo(() => {
    if (!playlist) return [];
    let tracks = [...playlist.tracks];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      tracks = tracks.filter(track =>
        track.title.toLowerCase().includes(query) ||
        track.artists.some(a => a.name.toLowerCase().includes(query)) ||
        track.album?.name?.toLowerCase().includes(query)
      );
    }

    // Sort tracks
    switch (sortBy) {
      case 'title':
        tracks.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'title-desc':
        tracks.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case 'artist':
        tracks.sort((a, b) => {
          const artistA = a.artists[0]?.name || '';
          const artistB = b.artists[0]?.name || '';
          return artistA.localeCompare(artistB);
        });
        break;
      case 'artist-desc':
        tracks.sort((a, b) => {
          const artistA = a.artists[0]?.name || '';
          const artistB = b.artists[0]?.name || '';
          return artistB.localeCompare(artistA);
        });
        break;
      case 'custom':
      default:
        // Keep original order
        break;
    }

    return tracks;
  }, [playlist, searchQuery, sortBy]);

  if (!playlist) {
    return (
      <div className="library-view">
        <div className="library-empty">
          <h3>Playlist not found</h3>
          <button onClick={goBack}>Go back</button>
        </div>
      </div>
    );
  }

  const handlePlayTrack = (track: Track, index: number) => {
    setQueue(filteredAndSortedTracks, index);
    play(track);
  };

  const handlePlayAll = () => {
    if (filteredAndSortedTracks.length > 0) {
      setQueue(filteredAndSortedTracks, 0);
      play(filteredAndSortedTracks[0]!);
    }
  };

  const handleShuffle = () => {
    if (filteredAndSortedTracks.length > 0) {
      const shuffled = shuffleArray(filteredAndSortedTracks);
      setQueue(shuffled, 0);
      play(shuffled[0]!);
    }
  };

  const handleStartEdit = () => {
    setEditName(playlist.name);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (editName.trim() && editName !== playlist.name) {
      renamePlaylist(playlist.id, editName.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  const handleRemoveTrack = (e: React.MouseEvent, trackId: string) => {
    e.stopPropagation();
    removeFromPlaylist(playlist.id, trackId);
  };

  const firstTrackArtwork = playlist.tracks[0]?.artwork?.medium ?? playlist.tracks[0]?.album?.artwork?.medium;

  return (
    <div className="library-view">
      <header className="library-header playlist-detail-header">
        <button className="back-btn-round playlist-back-btn-pos" onClick={goBack} aria-label="Go back">
          <BackIcon size={20} />
        </button>
        <div className="playlist-detail-artwork">
          {firstTrackArtwork ? (
            <img src={firstTrackArtwork} alt={playlist.name} />
          ) : (
            <div className="playlist-detail-artwork-placeholder"><MusicNoteIcon size={48} /></div>
          )}
        </div>
        <div className="library-header-info">
          <span className="library-header-type">Playlist</span>
          {isEditing ? (
            <input
              type="text"
              className="playlist-name-input"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSaveEdit}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          ) : (
            <div className="playlist-title-row">
              <h1 className="library-header-title">{playlist.name}</h1>
              <button
                className="playlist-edit-btn"
                onClick={handleStartEdit}
                title="Rename playlist"
              >
                <EditIcon size={18} />
              </button>
            </div>
          )}
          <span className="library-header-count">{playlist.tracks.length} songs</span>
        </div>
      </header>

      {playlist.tracks.length > 0 && (
        <LibraryActionBar
          onPlay={handlePlayAll}
          onShuffle={handleShuffle}
          disablePlay={filteredAndSortedTracks.length === 0}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search in playlist..."
          sortOptions={SORT_OPTIONS}
          currentSort={sortBy}
          onSortChange={setSortBy}
          totalCount={playlist.tracks.length}
          filteredCount={filteredAndSortedTracks.length}
        />
      )}

      <div className="library-content">
        {playlist.tracks.length === 0 ? (
          <div className="library-empty">
            <div className="library-empty-icon"><MusicNoteIcon size={48} /></div>
            <h3>This playlist is empty</h3>
            <p>Search for songs and add them here</p>
          </div>
        ) : filteredAndSortedTracks.length === 0 ? (
          <div className="library-empty">
            <div className="library-empty-icon"><MusicNoteIcon size={48} /></div>
            <h3>No matching songs</h3>
            <p>Try adjusting your search</p>
          </div>
        ) : (
          <div className="library-track-list">
            {filteredAndSortedTracks.map((track, index) => (
              <div key={track.id} className="playlist-track-row">
                <TrackRow
                  track={track}
                  index={index + 1}
                  isPlaying={currentTrack?.id === track.id}
                  onClick={() => handlePlayTrack(track, index)}
                  onContextMenu={showContextMenu}
                />
                <button
                  className="playlist-track-remove"
                  onClick={(e) => handleRemoveTrack(e, track.id)}
                  title="Remove from playlist"
                >
                  <CloseIcon size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
