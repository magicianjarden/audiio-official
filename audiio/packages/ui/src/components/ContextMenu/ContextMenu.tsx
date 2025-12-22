import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import type { ContextMenuEntity } from '../../contexts/ContextMenuContext';
import { useLibraryStore } from '../../stores/library-store';
import { usePlayerStore } from '../../stores/player-store';
import { useRecommendationStore } from '../../stores/recommendation-store';
import { useNavigationStore } from '../../stores/navigation-store';
import {
  PlayIcon,
  QueueIcon,
  PlaylistIcon,
  HeartIcon,
  HeartOutlineIcon,
  DownloadIcon,
  AddIcon,
  ThumbDownIcon,
  BlockIcon,
  ChevronRightIcon,
  MusicNoteIcon,
} from '../Icons/Icons';

interface ContextMenuProps {
  entity: ContextMenuEntity;
  x: number;
  y: number;
  onClose: () => void;
  onAddToPlaylist?: (track: UnifiedTrack) => void;
  onDislike?: (track: UnifiedTrack) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  entity,
  x,
  y,
  onClose,
  onAddToPlaylist,
  onDislike
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const [showPlaylistSubmenu, setShowPlaylistSubmenu] = useState(false);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { play, addToQueue } = usePlayerStore();
  const { isLiked, toggleLike, playlists, addToPlaylist, startDownload } = useLibraryStore();
  const { isDisliked, removeDislike } = useRecommendationStore();
  const { openArtist, openAlbum } = useNavigationStore();

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const handleSubmenuEnter = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setShowPlaylistSubmenu(true);
  }, []);

  const handleSubmenuLeave = useCallback(() => {
    // Delay closing to allow moving between parent and submenu
    closeTimeoutRef.current = setTimeout(() => {
      setShowPlaylistSubmenu(false);
    }, 150);
  }, []);

  // Adjust position to keep menu in viewport
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = x;
      let adjustedY = y;

      if (x + rect.width > viewportWidth) {
        adjustedX = viewportWidth - rect.width - 10;
      }
      if (y + rect.height > viewportHeight) {
        adjustedY = viewportHeight - rect.height - 10;
      }

      menuRef.current.style.left = `${adjustedX}px`;
      menuRef.current.style.top = `${adjustedY}px`;
    }
  }, [x, y]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Render track-specific menu
  if (entity.type === 'track') {
    const track = entity.data;
    const trackIsLiked = isLiked(track.id);
    const trackIsDisliked = isDisliked(track.id);

    const handlePlay = () => {
      play(track);
      onClose();
    };

    const handleAddToQueue = () => {
      addToQueue(track);
      onClose();
    };

    const handleLike = () => {
      toggleLike(track);
      onClose();
    };

    const handleDownload = () => {
      startDownload(track);
      onClose();
    };

    const handleDislike = () => {
      if (trackIsDisliked) {
        removeDislike(track.id);
      } else if (onDislike) {
        onDislike(track);
      }
      onClose();
    };

    const handleAddToPlaylistClick = (playlistId: string) => {
      addToPlaylist(playlistId, track);
      setShowPlaylistSubmenu(false);
      onClose();
    };

    const handleOpenAddToPlaylistModal = () => {
      if (onAddToPlaylist) {
        onAddToPlaylist(track);
      }
      onClose();
    };

    const handleGoToArtist = () => {
      const artist = track.artists[0];
      if (artist) {
        openArtist(artist.id, {
          id: artist.id,
          name: artist.name,
          image: track.artwork?.medium,
          source: track._meta?.metadataProvider || 'unknown',
        });
      }
      onClose();
    };

    const handleGoToAlbum = () => {
      if (track.album) {
        openAlbum(track.album.id, {
          id: track.album.id,
          title: track.album.title,
          artist: track.artists[0]?.name || 'Unknown',
          artwork: track.album.artwork?.medium,
          year: track.album.releaseDate ? parseInt(track.album.releaseDate.substring(0, 4)) : undefined,
          source: track._meta?.metadataProvider || 'unknown',
        });
      }
      onClose();
    };

    return (
      <div ref={menuRef} className="context-menu" style={{ left: x, top: y }}>
        <button className="context-menu-item" onClick={handlePlay}>
          <PlayIcon size={16} />
          <span>Play</span>
        </button>

        <button className="context-menu-item" onClick={handleAddToQueue}>
          <QueueIcon size={16} />
          <span>Add to Queue</span>
        </button>

        <div className="context-menu-divider" />

        <div
          className="context-menu-item has-submenu"
          onMouseEnter={handleSubmenuEnter}
          onMouseLeave={handleSubmenuLeave}
        >
          <PlaylistIcon size={16} />
          <span>Add to Playlist</span>
          <ChevronRightIcon size={14} className="context-menu-arrow" />

          {showPlaylistSubmenu && (
            <div
              ref={submenuRef}
              className="context-submenu"
              onMouseEnter={handleSubmenuEnter}
              onMouseLeave={handleSubmenuLeave}
            >
              {onAddToPlaylist && (
                <button className="context-menu-item" onClick={handleOpenAddToPlaylistModal}>
                  <AddIcon size={16} />
                  <span>New Playlist...</span>
                </button>
              )}
              {playlists.length > 0 && onAddToPlaylist && (
                <div className="context-menu-divider" />
              )}
              {playlists.length === 0 ? (
                <div className="context-menu-item disabled">
                  <span>No playlists</span>
                </div>
              ) : (
                playlists.map((playlist) => (
                  <button
                    key={playlist.id}
                    className="context-menu-item"
                    onClick={() => handleAddToPlaylistClick(playlist.id)}
                  >
                    <PlaylistIcon size={16} />
                    <span>{playlist.name}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="context-menu-divider" />

        {track.artists[0] && (
          <button className="context-menu-item" onClick={handleGoToArtist}>
            <MusicNoteIcon size={16} />
            <span>Go to Artist</span>
          </button>
        )}

        {track.album && (
          <button className="context-menu-item" onClick={handleGoToAlbum}>
            <MusicNoteIcon size={16} />
            <span>Go to Album</span>
          </button>
        )}

        {(track.artists[0] || track.album) && <div className="context-menu-divider" />}

        <button className="context-menu-item" onClick={handleLike}>
          {trackIsLiked ? <HeartIcon size={16} /> : <HeartOutlineIcon size={16} />}
          <span>{trackIsLiked ? 'Remove from Liked' : 'Add to Liked'}</span>
        </button>

        <button className={`context-menu-item ${trackIsDisliked ? 'active' : ''}`} onClick={handleDislike}>
          {trackIsDisliked ? <BlockIcon size={16} /> : <ThumbDownIcon size={16} />}
          <span>{trackIsDisliked ? 'Remove Dislike' : 'Not for me...'}</span>
        </button>

        <div className="context-menu-divider" />

        <button className="context-menu-item" onClick={handleDownload}>
          <DownloadIcon size={16} />
          <span>Download</span>
        </button>
      </div>
    );
  }

  // Render artist-specific menu
  if (entity.type === 'artist') {
    const artist = entity.data;

    const handlePlayArtist = () => {
      // TODO: Play artist's top tracks when API is available
      onClose();
    };

    const handleGoToArtist = () => {
      openArtist(artist.id, artist);
      onClose();
    };

    return (
      <div ref={menuRef} className="context-menu" style={{ left: x, top: y }}>
        <button className="context-menu-item" onClick={handlePlayArtist}>
          <PlayIcon size={16} />
          <span>Play Artist</span>
        </button>

        <div className="context-menu-divider" />

        <button className="context-menu-item" onClick={handleGoToArtist}>
          <MusicNoteIcon size={16} />
          <span>Go to Artist Page</span>
        </button>
      </div>
    );
  }

  // Render album-specific menu
  if (entity.type === 'album') {
    const album = entity.data;

    const handlePlayAlbum = () => {
      // TODO: Play album tracks when API is available
      onClose();
    };

    const handleAddAlbumToQueue = () => {
      // TODO: Add album tracks to queue when API is available
      onClose();
    };

    const handleGoToAlbum = () => {
      openAlbum(album.id, album);
      onClose();
    };

    const handleGoToArtist = () => {
      // Create a minimal artist object from album data
      openArtist(`artist-${album.artist}`, {
        id: `artist-${album.artist}`,
        name: album.artist,
        source: album.source,
      });
      onClose();
    };

    return (
      <div ref={menuRef} className="context-menu" style={{ left: x, top: y }}>
        <button className="context-menu-item" onClick={handlePlayAlbum}>
          <PlayIcon size={16} />
          <span>Play Album</span>
        </button>

        <button className="context-menu-item" onClick={handleAddAlbumToQueue}>
          <QueueIcon size={16} />
          <span>Add to Queue</span>
        </button>

        <div className="context-menu-divider" />

        <button className="context-menu-item" onClick={handleGoToAlbum}>
          <MusicNoteIcon size={16} />
          <span>Go to Album Page</span>
        </button>

        <button className="context-menu-item" onClick={handleGoToArtist}>
          <MusicNoteIcon size={16} />
          <span>Go to Artist</span>
        </button>
      </div>
    );
  }

  return null;
};

// Hook for managing context menu state (legacy, for backward compatibility)
export function useContextMenu() {
  const [contextMenu, setContextMenu] = useState<{
    track: UnifiedTrack;
    x: number;
    y: number;
  } | null>(null);

  const showContextMenu = (e: React.MouseEvent, track: UnifiedTrack) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ track, x: e.clientX, y: e.clientY });
  };

  const hideContextMenu = () => {
    setContextMenu(null);
  };

  return { contextMenu, showContextMenu, hideContextMenu };
}
