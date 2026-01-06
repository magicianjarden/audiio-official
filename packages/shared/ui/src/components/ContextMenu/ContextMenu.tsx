import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import type { ContextMenuEntity } from '../../contexts/ContextMenuContext';
import { useLibraryStore, type Playlist } from '../../stores/library-store';
import { usePlayerStore } from '../../stores/player-store';
import { useRecommendationStore } from '../../stores/recommendation-store';
import { useNavigationStore } from '../../stores/navigation-store';
import { useSmartQueueStore, type RadioSeed } from '../../stores/smart-queue-store';
import { useCollectionStore } from '../../stores/collection-store';
import { useTagStore, type Tag } from '../../stores/tag-store';
import { showSuccessToast } from '../../stores/toast-store';
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
  NextIcon,
  RadioIcon,
  FolderIcon,
  TagIcon,
  CheckIcon,
  TrashIcon,
  EditIcon,
  CopyIcon,
} from '@audiio/icons';

interface ContextMenuProps {
  entity: ContextMenuEntity;
  x: number;
  y: number;
  onClose: () => void;
  onAddToPlaylist?: (track: UnifiedTrack) => void;
  onAddToCollection?: (track: UnifiedTrack) => void;
  onTagTrack?: (track: UnifiedTrack) => void;
  onDislike?: (track: UnifiedTrack) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  entity,
  x,
  y,
  onClose,
  onAddToPlaylist,
  onAddToCollection,
  onTagTrack,
  onDislike
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const [showPlaylistSubmenu, setShowPlaylistSubmenu] = useState(false);
  const [showCollectionSubmenu, setShowCollectionSubmenu] = useState(false);
  const [showTagSubmenu, setShowTagSubmenu] = useState(false);
  const [trackTags, setTrackTags] = useState<string[]>([]);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { play, addToQueue, playNext, setQueue } = usePlayerStore();
  const { isLiked, toggleLike, playlists, addToPlaylist, startDownload, undislikeTrack, likedTracks } = useLibraryStore();
  const { isDisliked, removeDislike } = useRecommendationStore();
  const { openArtist, openAlbum } = useNavigationStore();
  const { startRadio } = useSmartQueueStore();
  const { collections, addToCollection: addItemToCollection } = useCollectionStore();
  const { tags, addTagToTrack, removeTagFromTrack, getTrackTags } = useTagStore();

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  // Load track tags when entity changes
  useEffect(() => {
    if (entity.type === 'track') {
      getTrackTags(entity.data.id).then(tags => {
        setTrackTags(tags.map(t => t.tagName));
      });
    }
  }, [entity, getTrackTags]);

  const handlePlaylistSubmenuEnter = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setShowPlaylistSubmenu(true);
    setShowCollectionSubmenu(false);
    setShowTagSubmenu(false);
  }, []);

  const handlePlaylistSubmenuLeave = useCallback(() => {
    closeTimeoutRef.current = setTimeout(() => {
      setShowPlaylistSubmenu(false);
    }, 150);
  }, []);

  const handleCollectionSubmenuEnter = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setShowCollectionSubmenu(true);
    setShowPlaylistSubmenu(false);
    setShowTagSubmenu(false);
  }, []);

  const handleCollectionSubmenuLeave = useCallback(() => {
    closeTimeoutRef.current = setTimeout(() => {
      setShowCollectionSubmenu(false);
    }, 150);
  }, []);

  const handleTagSubmenuEnter = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setShowTagSubmenu(true);
    setShowPlaylistSubmenu(false);
    setShowCollectionSubmenu(false);
  }, []);

  const handleTagSubmenuLeave = useCallback(() => {
    closeTimeoutRef.current = setTimeout(() => {
      setShowTagSubmenu(false);
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

    const handlePlayNext = () => {
      playNext(track);
      showSuccessToast(`"${track.title}" will play next`);
      onClose();
    };

    const handleAddToQueue = () => {
      addToQueue(track);
      showSuccessToast(`Added "${track.title}" to queue`);
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
        // Remove from both stores
        removeDislike(track.id);
        undislikeTrack(track.id);
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
      const artist = track.artists?.[0];
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

        <button className="context-menu-item" onClick={handlePlayNext}>
          <NextIcon size={16} />
          <span>Play Next</span>
        </button>

        <button className="context-menu-item" onClick={handleAddToQueue}>
          <QueueIcon size={16} />
          <span>Add to Queue</span>
        </button>

        <div className="context-menu-divider" />

        <div
          className="context-menu-item has-submenu"
          onMouseEnter={handlePlaylistSubmenuEnter}
          onMouseLeave={handlePlaylistSubmenuLeave}
        >
          <PlaylistIcon size={16} />
          <span>Add to Playlist</span>
          <ChevronRightIcon size={14} className="context-menu-arrow" />

          {showPlaylistSubmenu && (
            <div
              ref={submenuRef}
              className="context-submenu"
              onMouseEnter={handlePlaylistSubmenuEnter}
              onMouseLeave={handlePlaylistSubmenuLeave}
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

        {/* Add to Collection submenu */}
        {onAddToCollection && (
          <div
            className="context-menu-item has-submenu"
            onMouseEnter={handleCollectionSubmenuEnter}
            onMouseLeave={handleCollectionSubmenuLeave}
          >
            <FolderIcon size={16} />
            <span>Add to Collection</span>
            <ChevronRightIcon size={14} className="context-menu-arrow" />

            {showCollectionSubmenu && (
              <div
                className="context-submenu"
                onMouseEnter={handleCollectionSubmenuEnter}
                onMouseLeave={handleCollectionSubmenuLeave}
              >
                <button className="context-menu-item" onClick={() => { onAddToCollection(track); onClose(); }}>
                  <AddIcon size={16} />
                  <span>New Collection...</span>
                </button>
                {collections.length > 0 && <div className="context-menu-divider" />}
                {collections.length === 0 ? (
                  <div className="context-menu-item disabled">
                    <span>No collections</span>
                  </div>
                ) : (
                  collections.map((collection) => (
                    <button
                      key={collection.id}
                      className="context-menu-item"
                      onClick={async () => {
                        await addItemToCollection(collection.id, 'track', track.id, {
                          title: track.title,
                          artists: track.artists,
                          artwork: track.artwork,
                          album: track.album,
                        });
                        showSuccessToast(`Added to "${collection.name}"`);
                        onClose();
                      }}
                    >
                      <FolderIcon size={16} />
                      <span>{collection.name}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Tag Track submenu */}
        {onTagTrack && (
          <div
            className="context-menu-item has-submenu"
            onMouseEnter={handleTagSubmenuEnter}
            onMouseLeave={handleTagSubmenuLeave}
          >
            <TagIcon size={16} />
            <span>Tag Track</span>
            <ChevronRightIcon size={14} className="context-menu-arrow" />

            {showTagSubmenu && (
              <div
                className="context-submenu context-submenu-tags"
                onMouseEnter={handleTagSubmenuEnter}
                onMouseLeave={handleTagSubmenuLeave}
              >
                <button className="context-menu-item" onClick={() => { onTagTrack(track); onClose(); }}>
                  <AddIcon size={16} />
                  <span>Create New Tag...</span>
                </button>
                {tags.length > 0 && <div className="context-menu-divider" />}
                {tags.length === 0 ? (
                  <div className="context-menu-item disabled">
                    <span>No tags</span>
                  </div>
                ) : (
                  tags.map((tag) => {
                    const hasTag = trackTags.includes(tag.name);
                    return (
                      <button
                        key={tag.id}
                        className={`context-menu-item ${hasTag ? 'has-check' : ''}`}
                        onClick={async () => {
                          if (hasTag) {
                            await removeTagFromTrack(track.id, tag.name);
                            setTrackTags(prev => prev.filter(t => t !== tag.name));
                            showSuccessToast(`Removed "${tag.name}" tag`);
                          } else {
                            await addTagToTrack(track.id, tag.name, tag.color);
                            setTrackTags(prev => [...prev, tag.name]);
                            showSuccessToast(`Added "${tag.name}" tag`);
                          }
                          onClose();
                        }}
                      >
                        <span className="context-menu-tag-dot" style={{ backgroundColor: tag.color || 'var(--accent)' }} />
                        <span>{tag.name}</span>
                        {hasTag && <CheckIcon size={14} className="context-menu-check" />}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        <div className="context-menu-divider" />

        {track.artists?.[0] && (
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

        {(track.artists?.[0] || track.album) && <div className="context-menu-divider" />}

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

    const handleStartArtistRadio = async () => {
      const seed: RadioSeed = {
        type: 'artist',
        id: artist.id,
        name: `${artist.name} Radio`,
        artwork: artist.image,
        artistIds: [artist.id],
      };
      await startRadio(seed, likedTracks);
      showSuccessToast(`Started ${artist.name} Radio`);
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

        <button className="context-menu-item" onClick={handleStartArtistRadio}>
          <RadioIcon size={16} />
          <span>Start {artist.name} Radio</span>
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

  // Render playlist-specific menu
  if (entity.type === 'playlist') {
    const playlist = entity.data as Playlist;

    const handlePlayPlaylist = () => {
      if (playlist.tracks && playlist.tracks.length > 0) {
        setQueue(playlist.tracks as UnifiedTrack[], 0);
      }
      onClose();
    };

    const handleAddToQueue = () => {
      if (playlist.tracks && playlist.tracks.length > 0) {
        playlist.tracks.forEach(track => addToQueue(track as never));
        showSuccessToast(`Added ${playlist.tracks.length} tracks to queue`);
      }
      onClose();
    };

    const handleAddToCollection = async (collectionId: string) => {
      await addItemToCollection(collectionId, 'playlist', playlist.id, {
        name: playlist.name,
        trackCount: playlist.tracks?.length || 0,
        artwork: (playlist as Record<string, unknown>).artwork,
      });
      showSuccessToast(`Added "${playlist.name}" to collection`);
      onClose();
    };

    return (
      <div ref={menuRef} className="context-menu" style={{ left: x, top: y }}>
        <button className="context-menu-item" onClick={handlePlayPlaylist}>
          <PlayIcon size={16} />
          <span>Play Playlist</span>
        </button>

        <button className="context-menu-item" onClick={handleAddToQueue}>
          <QueueIcon size={16} />
          <span>Add to Queue</span>
        </button>

        <div className="context-menu-divider" />

        {/* Add to Collection submenu */}
        <div
          className="context-menu-item has-submenu"
          onMouseEnter={handleCollectionSubmenuEnter}
          onMouseLeave={handleCollectionSubmenuLeave}
        >
          <FolderIcon size={16} />
          <span>Add to Collection</span>
          <ChevronRightIcon size={14} className="context-menu-arrow" />

          {showCollectionSubmenu && (
            <div
              className="context-submenu"
              onMouseEnter={handleCollectionSubmenuEnter}
              onMouseLeave={handleCollectionSubmenuLeave}
            >
              {collections.length === 0 ? (
                <div className="context-menu-item disabled">
                  <span>No collections</span>
                </div>
              ) : (
                collections.map((collection) => (
                  <button
                    key={collection.id}
                    className="context-menu-item"
                    onClick={() => handleAddToCollection(collection.id)}
                  >
                    <FolderIcon size={16} />
                    <span>{collection.name}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render tag-specific menu
  if (entity.type === 'tag') {
    const tag = entity.data as Tag;

    const handleAddToCollection = async (collectionId: string) => {
      await addItemToCollection(collectionId, 'tag', tag.id, {
        name: tag.name,
        color: tag.color,
        usageCount: tag.usageCount,
      });
      showSuccessToast(`Added "${tag.name}" tag to collection`);
      onClose();
    };

    return (
      <div ref={menuRef} className="context-menu" style={{ left: x, top: y }}>
        {/* Add to Collection submenu */}
        <div
          className="context-menu-item has-submenu"
          onMouseEnter={handleCollectionSubmenuEnter}
          onMouseLeave={handleCollectionSubmenuLeave}
        >
          <FolderIcon size={16} />
          <span>Add to Collection</span>
          <ChevronRightIcon size={14} className="context-menu-arrow" />

          {showCollectionSubmenu && (
            <div
              className="context-submenu"
              onMouseEnter={handleCollectionSubmenuEnter}
              onMouseLeave={handleCollectionSubmenuLeave}
            >
              {collections.length === 0 ? (
                <div className="context-menu-item disabled">
                  <span>No collections</span>
                </div>
              ) : (
                collections.map((collection) => (
                  <button
                    key={collection.id}
                    className="context-menu-item"
                    onClick={() => handleAddToCollection(collection.id)}
                  >
                    <FolderIcon size={16} />
                    <span>{collection.name}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
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
