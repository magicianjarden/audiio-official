import React, { useState, useEffect } from 'react';
import { TitleBar } from './components/TitleBar';
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
import { VideoPlayerModal } from './components/Modals/VideoPlayerModal';
import { AddToPlaylistModal } from './components/Modals/AddToPlaylistModal';
import { DislikeModal } from './components/Modals/DislikeModal';
import { ToastContainer } from './components/common/Toast';
import { RecommendationExplanationProvider } from './components/RecommendationExplanation';
import { ConnectionScreen } from './components/Connection';
import { useNavigationStore } from './stores/navigation-store';
import { useSearchStore } from './stores/search-store';
import { useLibraryStore } from './stores/library-store';
import { usePlayerStore } from './stores/player-store';
import { useLyricsStore } from './stores/lyrics-store';
import { useConnectionStore } from './stores/connection-store';
import { useAutoQueue, usePluginAudioFeatures, useDownloadProgress, useLibraryBridge, GlobalShortcutManager, SkipTrackingManager } from './hooks';
import { EmbeddingManager } from './components/EmbeddingManager';
import { usePluginUIRegistry, initializePluginUIs } from './registry';
import { ContextMenuProvider } from './contexts/ContextMenuContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { pluginPipelineRegistry } from './components/Discover/plugin-pipeline-registry';
import { registerBuiltinTransformers } from './components/Discover/builtin-transformers';
import { registerCoreProviders } from './components/Discover/core-providers';
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
    // NOTE: likedTracks is LibraryTrack[] (wrapper objects), extract the actual UnifiedTrack
    const tracks = likedTracks.map(lt => lt.track);
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

/**
 * Component that prefetches lyrics when a track starts playing
 * Ensures instant lyrics display when the panel is opened
 */
const LyricsPrefetchManager: React.FC = () => {
  const currentTrack = usePlayerStore(state => state.currentTrack);
  const prefetchLyrics = useLyricsStore(state => state.prefetchLyrics);

  useEffect(() => {
    if (currentTrack) {
      const artistName = currentTrack.artists[0]?.name || '';
      // Prefetch lyrics in background (non-blocking)
      prefetchLyrics(artistName, currentTrack.title, currentTrack.id);
    }
  }, [currentTrack?.id, prefetchLyrics]);

  return null; // This component doesn't render anything
};

/**
 * Component that initializes the plugin pipeline with built-in transformers
 * and core data providers. Registers default transformers for artist diversity,
 * duplicates, etc., and providers for trending, search, artist-radio, etc.
 */
const PipelineManager: React.FC = () => {
  useEffect(() => {
    // Register core data providers (trending, search, artist-radio, etc.)
    registerCoreProviders();

    // Register built-in transformers on mount
    registerBuiltinTransformers(pluginPipelineRegistry);

    // Log pipeline stats
    const stats = pluginPipelineRegistry.getStats();
    console.log(
      `[PipelineManager] Initialized with ${stats.transformers} transformers, ` +
      `${stats.providers} providers, ${stats.enhancers} enhancers`
    );
  }, []);

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

  // Connection state for client mode
  const { state: connectionState, isClientMode, isLoading: connectionLoading } = useConnectionStore();

  // Initialize plugin UIs on mount
  useEffect(() => {
    initializePluginUIs();
  }, []);

  // Show connection screen if in client mode and not connected
  if (isClientMode && !connectionState.connected && !connectionLoading) {
    return (
      <ThemeProvider>
        <TitleBar />
        <ConnectionScreen />
      </ThemeProvider>
    );
  }

  // Show loading state while checking connection
  if (connectionLoading) {
    return (
      <ThemeProvider>
        <TitleBar />
        <div className="app app-loading">
          <div className="app-loading-content">
            <div className="app-loading-spinner" />
            <p>Loading...</p>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <ContextMenuProvider
        onAddToPlaylist={setAddToPlaylistTrack}
        onDislike={setDislikeTrack}
      >
        <RecommendationExplanationProvider>
        <TitleBar />
        <div className="app">
          <AutoQueueManager />
          <PluginAudioManager />
          <DownloadManager />
          <LibraryBridgeManager />
          <LyricsPrefetchManager />
          <PipelineManager />
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
          <VideoPlayerModal />
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
