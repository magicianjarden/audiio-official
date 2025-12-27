/**
 * ActionSheetContext - Global context for managing action sheets
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrackActionSheet } from '../components/TrackActionSheet';
import { DislikeModal } from '../components/DislikeModal';
import { usePlayerStore } from '../stores/player-store';
import { useLibraryStore, type DislikeReason } from '../stores/library-store';
import type { UnifiedTrack } from '@audiio/sdk';

interface ActionSheetContextType {
  showTrackActions: (track: UnifiedTrack) => void;
  hideActions: () => void;
  showAddToPlaylist: (track: UnifiedTrack) => void;
}

const ActionSheetContext = createContext<ActionSheetContextType | undefined>(undefined);

interface ActionSheetProviderProps {
  children: React.ReactNode;
  onAddToPlaylist?: (track: UnifiedTrack) => void;
}

export function ActionSheetProvider({ children, onAddToPlaylist }: ActionSheetProviderProps) {
  const navigate = useNavigate();
  const [activeTrack, setActiveTrack] = useState<UnifiedTrack | null>(null);
  const [showTrackSheet, setShowTrackSheet] = useState(false);
  const [showDislikeModal, setShowDislikeModal] = useState(false);

  const playerStore = usePlayerStore();
  const libraryStore = useLibraryStore();

  const showTrackActions = useCallback((track: UnifiedTrack) => {
    setActiveTrack(track);
    setShowTrackSheet(true);
  }, []);

  const hideActions = useCallback(() => {
    setShowTrackSheet(false);
    setActiveTrack(null);
  }, []);

  const showAddToPlaylist = useCallback((track: UnifiedTrack) => {
    if (onAddToPlaylist) {
      onAddToPlaylist(track);
    }
  }, [onAddToPlaylist]);

  // Track action handlers
  const handlePlayNow = useCallback((track: UnifiedTrack) => {
    playerStore.play(track);
  }, [playerStore]);

  const handlePlayNext = useCallback((track: UnifiedTrack) => {
    playerStore.addToQueue(track, true);
  }, [playerStore]);

  const handleAddToQueue = useCallback((track: UnifiedTrack) => {
    playerStore.addToQueue(track);
  }, [playerStore]);

  const handleAddToPlaylist = useCallback((track: UnifiedTrack) => {
    showAddToPlaylist(track);
  }, [showAddToPlaylist]);

  const handleLike = useCallback((track: UnifiedTrack) => {
    libraryStore.likeTrack(track);
  }, [libraryStore]);

  const handleUnlike = useCallback((track: UnifiedTrack) => {
    libraryStore.unlikeTrack(track.id);
  }, [libraryStore]);

  const handleDislike = useCallback((track: UnifiedTrack) => {
    setActiveTrack(track);
    setShowTrackSheet(false);
    setShowDislikeModal(true);
  }, []);

  const handleDislikeSubmit = useCallback((reasons: DislikeReason[]) => {
    if (activeTrack) {
      libraryStore.dislikeTrack(activeTrack, reasons);
      playerStore.next();
    }
    setShowDislikeModal(false);
    setActiveTrack(null);
  }, [activeTrack, libraryStore, playerStore]);

  const handleCloseDislike = useCallback(() => {
    setShowDislikeModal(false);
    setActiveTrack(null);
  }, []);

  const handleGoToArtist = useCallback((track: UnifiedTrack) => {
    const artist = track.artists?.[0];
    if (artist) {
      hideActions();
      navigate(`/artist/${artist.id}?name=${encodeURIComponent(artist.name)}&source=${track.source || 'deezer'}`);
    }
  }, [navigate, hideActions]);

  const handleGoToAlbum = useCallback((track: UnifiedTrack) => {
    const album = track.album;
    if (album) {
      hideActions();
      navigate(`/album/${album.id}?name=${encodeURIComponent(album.name || album.title || '')}&source=${track.source || 'deezer'}`);
    }
  }, [navigate, hideActions]);

  const isTrackLiked = activeTrack ? libraryStore.isLiked(activeTrack.id) : false;

  return (
    <ActionSheetContext.Provider value={{ showTrackActions, hideActions, showAddToPlaylist }}>
      {children}
      <TrackActionSheet
        isOpen={showTrackSheet}
        track={activeTrack}
        isLiked={isTrackLiked}
        onClose={hideActions}
        onPlayNow={handlePlayNow}
        onPlayNext={handlePlayNext}
        onAddToQueue={handleAddToQueue}
        onAddToPlaylist={handleAddToPlaylist}
        onLike={handleLike}
        onUnlike={handleUnlike}
        onDislike={handleDislike}
        onGoToArtist={handleGoToArtist}
        onGoToAlbum={handleGoToAlbum}
      />
      <DislikeModal
        isOpen={showDislikeModal}
        trackTitle={activeTrack?.title || ''}
        trackArtist={activeTrack?.artists?.[0]?.name || 'Unknown Artist'}
        onSubmit={handleDislikeSubmit}
        onClose={handleCloseDislike}
      />
    </ActionSheetContext.Provider>
  );
}

export function useActionSheet() {
  const context = useContext(ActionSheetContext);
  if (!context) {
    throw new Error('useActionSheet must be used within an ActionSheetProvider');
  }
  return context;
}
