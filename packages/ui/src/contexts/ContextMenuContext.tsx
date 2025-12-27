import React, { createContext, useContext, useState, useCallback } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import type { SearchArtist, SearchAlbum } from '../stores/search-store';
import { ContextMenu } from '../components/ContextMenu/ContextMenu';

// Context menu can handle different entity types
export type ContextMenuType = 'track' | 'artist' | 'album';

export type ContextMenuEntity =
  | { type: 'track'; data: UnifiedTrack }
  | { type: 'artist'; data: SearchArtist }
  | { type: 'album'; data: SearchAlbum };

type ContextMenuState = {
  entity: ContextMenuEntity;
  x: number;
  y: number;
} | null;

interface ContextMenuContextValue {
  // Generic show function
  showContextMenu: (e: React.MouseEvent, entity: ContextMenuEntity) => void;
  hideContextMenu: () => void;
  // Convenience methods for specific types (backward compatible)
  showTrackMenu: (e: React.MouseEvent, track: UnifiedTrack) => void;
  showArtistMenu: (e: React.MouseEvent, artist: SearchArtist) => void;
  showAlbumMenu: (e: React.MouseEvent, album: SearchAlbum) => void;
}

const ContextMenuContext = createContext<ContextMenuContextValue | null>(null);

export function useTrackContextMenu() {
  const context = useContext(ContextMenuContext);
  if (!context) {
    throw new Error('useTrackContextMenu must be used within a ContextMenuProvider');
  }
  // Return backward-compatible interface
  return {
    showContextMenu: context.showTrackMenu,
    hideContextMenu: context.hideContextMenu,
  };
}

export function useArtistContextMenu() {
  const context = useContext(ContextMenuContext);
  if (!context) {
    throw new Error('useArtistContextMenu must be used within a ContextMenuProvider');
  }
  return {
    showContextMenu: context.showArtistMenu,
    hideContextMenu: context.hideContextMenu,
  };
}

export function useAlbumContextMenu() {
  const context = useContext(ContextMenuContext);
  if (!context) {
    throw new Error('useAlbumContextMenu must be used within a ContextMenuProvider');
  }
  return {
    showContextMenu: context.showAlbumMenu,
    hideContextMenu: context.hideContextMenu,
  };
}

// Generic hook for all menu types
export function useEntityContextMenu() {
  const context = useContext(ContextMenuContext);
  if (!context) {
    throw new Error('useEntityContextMenu must be used within a ContextMenuProvider');
  }
  return context;
}

interface ContextMenuProviderProps {
  children: React.ReactNode;
  onAddToPlaylist?: (track: UnifiedTrack) => void;
  onDislike?: (track: UnifiedTrack) => void;
}

export const ContextMenuProvider: React.FC<ContextMenuProviderProps> = ({
  children,
  onAddToPlaylist,
  onDislike
}) => {
  const [menuState, setMenuState] = useState<ContextMenuState>(null);

  const showContextMenu = useCallback((e: React.MouseEvent, entity: ContextMenuEntity) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuState({ entity, x: e.clientX, y: e.clientY });
  }, []);

  const showTrackMenu = useCallback((e: React.MouseEvent, track: UnifiedTrack) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuState({ entity: { type: 'track', data: track }, x: e.clientX, y: e.clientY });
  }, []);

  const showArtistMenu = useCallback((e: React.MouseEvent, artist: SearchArtist) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuState({ entity: { type: 'artist', data: artist }, x: e.clientX, y: e.clientY });
  }, []);

  const showAlbumMenu = useCallback((e: React.MouseEvent, album: SearchAlbum) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuState({ entity: { type: 'album', data: album }, x: e.clientX, y: e.clientY });
  }, []);

  const hideContextMenu = useCallback(() => {
    setMenuState(null);
  }, []);

  return (
    <ContextMenuContext.Provider value={{
      showContextMenu,
      hideContextMenu,
      showTrackMenu,
      showArtistMenu,
      showAlbumMenu,
    }}>
      {children}
      {menuState && (
        <ContextMenu
          entity={menuState.entity}
          x={menuState.x}
          y={menuState.y}
          onClose={hideContextMenu}
          onAddToPlaylist={onAddToPlaylist}
          onDislike={onDislike}
        />
      )}
    </ContextMenuContext.Provider>
  );
};
