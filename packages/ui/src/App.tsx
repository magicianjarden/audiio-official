import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar/Sidebar';
import { Discover } from './components/Discover/Discover';
import { FloatingSearch } from './components/Search/FloatingSearch';
import { SearchResults } from './components/Search/SearchResults';
import { LikesView } from './components/Library/LikesView';
import { DislikesView } from './components/Library/DislikesView';
import { PlaylistsView } from './components/Library/PlaylistsView';
import { PlaylistDetailView } from './components/Library/PlaylistDetailView';
import { DownloadsView } from './components/Library/DownloadsView';
import { PluginsView } from './components/Plugins/PluginsView';
import { PluginDetailView } from './components/Plugins/PluginDetailView';
import { SettingsView } from './components/Settings/SettingsView';
import { ArtistDetailView } from './components/Artist/ArtistDetailView';
import { AlbumDetailView } from './components/Album/AlbumDetailView';
import { SectionDetailView } from './components/Discover/SectionDetailView';
import { StatsView } from './components/Stats';
import { QueuePopover } from './components/Queue/QueuePopover';
import { Player } from './components/Player/Player';
import { FullPlayer } from './components/Player/FullPlayer';
import { LyricsPanel } from './components/Player/LyricsPanel';
import { AddToPlaylistModal } from './components/Modals/AddToPlaylistModal';
import { DislikeModal } from './components/Modals/DislikeModal';
import { ToastContainer } from './components/common/Toast';
import { RecommendationExplanationProvider } from './components/RecommendationExplanation';
import { useNavigationStore } from './stores/navigation-store';
import { useSearchStore } from './stores/search-store';
import { useLibraryStore } from './stores/library-store';
import { useAutoQueue, usePluginAudioFeatures, useDownloadProgress, useLibraryBridge, GlobalShortcutManager, SkipTrackingManager } from './hooks';
import { EmbeddingManager } from './components/EmbeddingManager';
import { usePluginUIRegistry, initializePluginUIs } from './registry';
import { ContextMenuProvider } from './contexts/ContextMenuContext';
import { ThemeProvider } from './contexts/ThemeContext';
import type { UnifiedTrack } from '@audiio/core';

/**
 * Component that manages auto-queue functionality
 * Listens for queue events and replenishes when needed
 * The smart-queue-store fetches from multiple sources (likes, playlists, API, etc.)
 */
const AutoQueueManager: React.FC = () => {
  const { likedTracks, playlists } = useLibraryStore();

  // Combine liked tracks with playlist tracks for the available pool
  // The smart-queue-store will also fetch from APIs, search cache, etc.
  const availableTracks = React.useMemo(() => {
    const tracks = [...likedTracks];
    for (const playlist of playlists) {
      tracks.push(...playlist.tracks);
    }
    // Deduplicate
    const seen = new Set<string>();
    return tracks.filter(t => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  }, [likedTracks, playlists]);

  // Mount the auto-queue hook
  useAutoQueue({
    availableTracks,
    enabled: true
  });

  return null; // This component doesn't render anything
};

/**
 * Component that connects plugins to the ML audio feature system
 * Automatically registers/unregisters providers based on plugin state
 */
const PluginAudioManager: React.FC = () => {
  // Mount the plugin audio features hook
  usePluginAudioFeatures();
  return null; // This component doesn't render anything
};

/**
 * Component that manages download progress events
 * Listens for IPC events from main process and updates library store
 */
const DownloadManager: React.FC = () => {
  // Mount the download progress hook
  useDownloadProgress();
  return null; // This component doesn't render anything
};

/**
 * Component that bridges library data to main process for mobile sync
 * Responds to data requests and action commands from mobile devices
 */
const LibraryBridgeManager: React.FC = () => {
  // Mount the library bridge hook
  useLibraryBridge();
  return null; // This component doesn't render anything
};

const MainContent: React.FC = () => {
  const { currentView, isSearchActive, searchQuery, setSearchQuery, clearSearch } = useNavigationStore();
  const { search, clear: clearSearchResults } = useSearchStore();
  const pluginUIRegistry = usePluginUIRegistry();

  const handleCloseSearch = () => {
    clearSearch();
    clearSearchResults();
  };

  // Check if this is a plugin view
  if (currentView.startsWith('plugin-view-')) {
    const viewId = currentView.replace('plugin-view-', '');
    const pluginView = pluginUIRegistry.getView(viewId);
    if (pluginView) {
      const ViewComponent = pluginView.component;
      return <ViewComponent />;
    }
    // Fallback if view not found
    return <Discover />;
  }

  // Home view with integrated search
  if (currentView === 'home') {
    const showSearchResults = isSearchActive && searchQuery;

    return (
      <div className={`home-view ${showSearchResults ? 'searching' : ''}`}>
        <FloatingSearch
          onSearch={(q) => {
            setSearchQuery(q);
            if (q) search(q);
          }}
          onClose={handleCloseSearch}
          isSearchActive={!!showSearchResults}
        />
        <div className="home-content">
          {showSearchResults ? (
            <SearchResults />
          ) : (
            <Discover />
          )}
        </div>
      </div>
    );
  }

  switch (currentView) {
    case 'likes':
      return <LikesView />;
    case 'dislikes':
      return <DislikesView />;
    case 'playlists':
      return <PlaylistsView />;
    case 'playlist-detail':
      return <PlaylistDetailView />;
    case 'downloads':
      return <DownloadsView />;
    case 'plugins':
      return <PluginsView />;
    case 'plugin-detail':
      return <PluginDetailView />;
    case 'settings':
      return <SettingsView />;
    case 'stats':
      return <StatsView />;
    case 'artist-detail':
      return <ArtistDetailView />;
    case 'album-detail':
      return <AlbumDetailView />;
    case 'section-detail':
      return <SectionDetailView />;
    default:
      return <Discover />;
  }
};

export const App: React.FC = () => {
  const [addToPlaylistTrack, setAddToPlaylistTrack] = useState<UnifiedTrack | null>(null);
  const [dislikeTrack, setDislikeTrack] = useState<UnifiedTrack | null>(null);

  // Initialize plugin UIs on mount
  useEffect(() => {
    initializePluginUIs();
  }, []);

  return (
    <ThemeProvider>
      <ContextMenuProvider
        onAddToPlaylist={setAddToPlaylistTrack}
        onDislike={setDislikeTrack}
      >
        <RecommendationExplanationProvider>
        <div className="app">
          <AutoQueueManager />
          <PluginAudioManager />
          <DownloadManager />
          <LibraryBridgeManager />
          <GlobalShortcutManager />
          <SkipTrackingManager />
          <EmbeddingManager />
          <Sidebar />
          <main className="main-content">
            <MainContent />
          </main>
          <Player />
          <QueuePopover />
          <LyricsPanel />
          <FullPlayer />
        </div>
        {addToPlaylistTrack && (
          <AddToPlaylistModal
            track={addToPlaylistTrack}
            onClose={() => setAddToPlaylistTrack(null)}
          />
        )}
        {dislikeTrack && (
          <DislikeModal
            track={dislikeTrack}
            onClose={() => setDislikeTrack(null)}
          />
        )}
        <ToastContainer />
        </RecommendationExplanationProvider>
      </ContextMenuProvider>
    </ThemeProvider>
  );
};
