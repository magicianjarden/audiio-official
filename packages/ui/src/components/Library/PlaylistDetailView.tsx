import React from 'react';
import { useLibraryStore } from '../../stores/library-store';
import { useNavigationStore } from '../../stores/navigation-store';
import { usePlayerStore } from '../../stores/player-store';
import { TrackRow } from '../TrackRow/TrackRow';
import {
  PlayIcon,
  BackIcon,
  CloseIcon,
  MusicNoteIcon
} from '@audiio/icons';

export const PlaylistDetailView: React.FC = () => {
  const { selectedPlaylistId, goBack } = useNavigationStore();
  const { playlists, renamePlaylist, removeFromPlaylist } = useLibraryStore();
  const { play, setQueue, currentTrack } = usePlayerStore();

  const playlist = playlists.find(p => p.id === selectedPlaylistId);

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

  const handlePlayTrack = (index: number) => {
    const track = playlist.tracks[index];
    if (track) {
      setQueue(playlist.tracks, index);
      play(track);
    }
  };

  const handlePlayAll = () => {
    if (playlist.tracks.length > 0) {
      setQueue(playlist.tracks, 0);
      play(playlist.tracks[0]!);
    }
  };

  const handleRename = () => {
    const name = prompt('Enter new name:', playlist.name);
    if (name?.trim() && name !== playlist.name) {
      renamePlaylist(playlist.id, name.trim());
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
          <h1 className="library-header-title" onClick={handleRename} title="Click to rename">
            {playlist.name}
          </h1>
          <span className="library-header-count">{playlist.tracks.length} songs</span>
        </div>
      </header>

      {playlist.tracks.length > 0 && (
        <div className="library-actions">
          <button className="library-play-button" onClick={handlePlayAll}>
            <PlayIcon size={18} /> Play All
          </button>
        </div>
      )}

      <div className="library-tracks">
        {playlist.tracks.length === 0 ? (
          <div className="library-empty">
            <div className="library-empty-icon"><MusicNoteIcon size={48} /></div>
            <h3>This playlist is empty</h3>
            <p>Search for songs and add them here</p>
          </div>
        ) : (
          <div className="results-list">
            {playlist.tracks.map((track, index) => (
              <div key={track.id} className="playlist-track-row">
                <TrackRow
                  track={track}
                  index={index + 1}
                  isPlaying={currentTrack?.id === track.id}
                  onClick={() => handlePlayTrack(index)}
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
