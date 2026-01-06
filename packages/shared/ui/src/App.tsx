import React, { useState, useEffect, useCallback } from 'react';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar/Sidebar';
import { Discover } from './components/Discover/Discover';
import { FloatingSearch } from './components/Search/FloatingSearch';
import {
  PlayIcon,
  ShuffleIcon,
  PlaylistIcon,
  FolderIcon,
  TagIcon,
  DownloadIcon,
  HeartIcon,
  CheckIcon,
  SearchIcon,
  MusicNoteIcon,
  UserIcon,
  AlbumIcon,
} from '@audiio/icons';
import { SearchResults } from './components/Search/SearchResults';
import { LikesView } from './components/Library/LikesView';
import { DislikesView } from './components/Library/DislikesView';
import { PlaylistsView } from './components/Library/PlaylistsView';
import { PlaylistDetailView } from './components/Library/PlaylistDetailView';
import { DownloadsView } from './components/Library/DownloadsView';
import { CollectionsView, CollectionView } from './components/Collections';
import { TagManager, TagDetailView } from './components/Tags';
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
import { AddToCollectionModal } from './components/Modals/AddToCollectionModal';
import { TagTrackModal } from './components/Modals/TagTrackModal';
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
import { useCollectionStore } from './stores/collection-store';
import { useTagStore } from './stores/tag-store';
import { useUIStore } from './stores/ui-store';
import { useAutoQueue, usePluginAudioFeatures, useDownloadProgress, useLibraryBridge, GlobalShortcutManager, SkipTrackingManager } from './hooks';
import { useScrobbling } from './hooks/useScrobbling';
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
  const { queue } = usePlayerStore();

  // Combine all available tracks for the fallback pool
  // Primary source is server-side ML, this is the fallback when server returns empty
  const availableTracks = React.useMemo(() => {
    const tracks: UnifiedTrack[] = [];
    const seen = new Set<string>();

    const addTrack = (track: UnifiedTrack) => {
      if (track?.id && !seen.has(track.id)) {
        seen.add(track.id);
        tracks.push(track);
      }
    };

    // 1. Add all playlist tracks (includes media folder playlists with local library)
    for (const playlist of playlists) {
      if (playlist.tracks) {
        playlist.tracks.forEach(addTrack);
      }
      // Also include smart playlist cached tracks
      if (playlist.ruleTracks) {
        playlist.ruleTracks.forEach(addTrack);
      }
    }

    // 2. Add liked tracks
    likedTracks.forEach(lt => addTrack(lt.track));

    // 3. Add current queue tracks (includes tracks user has played/queued)
    queue.forEach(addTrack);

    return tracks;
  }, [likedTracks, playlists, queue]);

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

/**
 * Component that handles automatic scrobbling to ListenBrainz
 * Watches playback state and submits scrobbles when threshold is met
 */
const ScrobblingManager: React.FC = () => {
  useScrobbling();
  return null; // This component doesn't render anything
};

/**
 * HomeFloatingSearch - FloatingSearch inside home-view for original animations
 * Matches the original design where FloatingSearch was a child of home-view
 * Shows search-specific actions when actively searching
 */
const HomeFloatingSearch: React.FC = () => {
  const { isSearchActive, setSearchActive, setSearchQuery, clearSearch, searchQuery } = useNavigationStore();
  const { search, results, activeFilter, setActiveFilter } = useSearchStore();
  const { play, setQueue, shuffle } = usePlayerStore();

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setSearchActive(true);
    search(query);
  }, [setSearchQuery, setSearchActive, search]);

  const handleClose = useCallback(() => {
    clearSearch();
    setSearchActive(false);
  }, [clearSearch, setSearchActive]);

  // Play all search results
  const handlePlayAll = useCallback(() => {
    if (results.tracks.length > 0) {
      setQueue(results.tracks, 0);
      play(results.tracks[0]);
    }
  }, [results.tracks, setQueue, play]);

  // Shuffle search results
  const handleShuffle = useCallback(() => {
    if (results.tracks.length > 0) {
      shuffle();
      const shuffled = [...results.tracks].sort(() => Math.random() - 0.5);
      setQueue(shuffled, 0);
      play(shuffled[0]);
    }
  }, [results.tracks, setQueue, play, shuffle]);

  // Build search-specific actions
  const actions = React.useMemo(() => {
    if (!isSearchActive || !searchQuery) return [];

    const result: Array<{
      id: string;
      label: string;
      icon: React.ReactNode;
      shortcut?: string;
      primary?: boolean;
      active?: boolean;
      onClick: () => void;
    }> = [];

    // Play/Shuffle buttons when we have tracks
    if (results.tracks.length > 0) {
      result.push({
        id: 'play',
        label: 'Play All',
        icon: <PlayIcon size={14} />,
        shortcut: 'P',
        primary: true,
        onClick: handlePlayAll,
      });
      result.push({
        id: 'shuffle',
        label: 'Shuffle',
        icon: <ShuffleIcon size={14} />,
        shortcut: 'S',
        primary: true,
        onClick: handleShuffle,
      });
    }

    // Filter buttons
    result.push({
      id: 'filter-all',
      label: 'All',
      icon: <SearchIcon size={14} />,
      active: activeFilter === 'all',
      onClick: () => setActiveFilter('all'),
    });
    result.push({
      id: 'filter-tracks',
      label: 'Songs',
      icon: <MusicNoteIcon size={14} />,
      active: activeFilter === 'tracks',
      onClick: () => setActiveFilter('tracks'),
    });
    result.push({
      id: 'filter-artists',
      label: 'Artists',
      icon: <UserIcon size={14} />,
      active: activeFilter === 'artists',
      onClick: () => setActiveFilter('artists'),
    });
    result.push({
      id: 'filter-albums',
      label: 'Albums',
      icon: <AlbumIcon size={14} />,
      active: activeFilter === 'albums',
      onClick: () => setActiveFilter('albums'),
    });

    return result;
  }, [isSearchActive, searchQuery, results.tracks.length, activeFilter, handlePlayAll, handleShuffle, setActiveFilter]);

  // Page context for search
  const pageContext = React.useMemo(() => {
    if (!isSearchActive || !searchQuery) return undefined;
    return {
      type: 'other' as const,
      label: 'Search Results',
      icon: <SearchIcon size={14} />,
    };
  }, [isSearchActive, searchQuery]);

  return (
    <FloatingSearch
      onSearch={handleSearch}
      onClose={handleClose}
      isSearchActive={isSearchActive}
      actions={actions}
      pageContext={pageContext}
    />
  );
};

/**
 * Component that manages the floating search for non-home views
 * Provides page-adaptive actions based on current view
 */
const FloatingSearchManager: React.FC = () => {
  const { currentView, isSearchActive, setSearchActive, setSearchQuery, clearSearch } = useNavigationStore();
  const { search } = useSearchStore();
  const { likedTracks } = useLibraryStore();
  const { play, setQueue, shuffle } = usePlayerStore();

  // Handle search submission
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setSearchActive(true);
    search(query);
  }, [setSearchQuery, setSearchActive, search]);

  // Handle close
  const handleClose = useCallback(() => {
    clearSearch();
    setSearchActive(false);
  }, [clearSearch, setSearchActive]);

  // Page-adaptive actions based on current view
  const getPageActions = useCallback(() => {
    const actions: Array<{
      id: string;
      label: string;
      icon: React.ReactNode;
      shortcut?: string;
      primary?: boolean;
      onClick: () => void;
    }> = [];

    switch (currentView) {
      case 'likes': {
        const tracks = likedTracks.map(lt => lt.track);
        if (tracks.length > 0) {
          actions.push({
            id: 'play',
            label: 'Play All',
            icon: <PlayIcon size={14} />,
            shortcut: 'P',
            primary: true,
            onClick: () => { setQueue(tracks, 0); play(tracks[0]); },
          });
          actions.push({
            id: 'shuffle',
            label: 'Shuffle',
            icon: <ShuffleIcon size={14} />,
            shortcut: 'S',
            onClick: () => { shuffle(); setQueue(tracks, 0); play(tracks[0]); },
          });
        }
        break;
      }
      case 'playlists': {
        actions.push({
          id: 'create',
          label: 'New Playlist',
          icon: <PlaylistIcon size={14} />,
          shortcut: 'N',
          primary: true,
          onClick: () => window.dispatchEvent(new CustomEvent('audiio:create-playlist')),
        });
        break;
      }
      case 'downloads': {
        actions.push({
          id: 'all',
          label: 'All',
          icon: <DownloadIcon size={14} />,
          onClick: () => window.dispatchEvent(new CustomEvent('unified-search-action', { detail: { action: 'filter:all' } })),
        });
        actions.push({
          id: 'completed',
          label: 'Completed',
          icon: <CheckIcon size={14} />,
          onClick: () => window.dispatchEvent(new CustomEvent('unified-search-action', { detail: { action: 'filter:completed' } })),
        });
        break;
      }
      case 'collections': {
        actions.push({
          id: 'create',
          label: 'New Collection',
          icon: <FolderIcon size={14} />,
          shortcut: 'N',
          primary: true,
          onClick: () => window.dispatchEvent(new CustomEvent('audiio:create-collection')),
        });
        break;
      }
      case 'tags': {
        actions.push({
          id: 'create',
          label: 'New Tag',
          icon: <TagIcon size={14} />,
          shortcut: 'N',
          primary: true,
          onClick: () => window.dispatchEvent(new CustomEvent('audiio:create-tag')),
        });
        break;
      }
    }

    return actions;
  }, [currentView, likedTracks, play, setQueue, shuffle]);

  // Get page context for display
  const getPageContext = useCallback(() => {
    switch (currentView) {
      case 'likes':
        return { type: 'likes' as const, label: 'Liked Songs', icon: <HeartIcon size={14} /> };
      case 'downloads':
        return { type: 'downloads' as const, label: 'Downloads', icon: <DownloadIcon size={14} /> };
      case 'playlists':
        return { type: 'playlists' as const, label: 'Playlists', icon: <PlaylistIcon size={14} /> };
      case 'collections':
        return { type: 'collections' as const, label: 'Collections', icon: <FolderIcon size={14} /> };
      case 'tags':
        return { type: 'tags' as const, label: 'Tags', icon: <TagIcon size={14} /> };
      default:
        return undefined;
    }
  }, [currentView]);

  // Don't show on home (handled by HomeFloatingSearch) or views with their own FloatingSearch
  const shouldShowSearch = ![
    'home',
    'likes',           // Has own FloatingSearch
    'dislikes',        // Has own FloatingSearch
    'playlists',       // Has own FloatingSearch
    'playlist-detail', // Has own FloatingSearch
    'collections',     // Has own FloatingSearch
    'collection-detail', // Has own FloatingSearch
    'tags',            // Has own FloatingSearch
    'tag-detail',      // Has own FloatingSearch
    'downloads',       // Has own FloatingSearch
    'plugins',         // No search needed
    'settings',
    'plugin-detail',
    'artist-detail',
    'album-detail',
    'section-detail',
    'mix',
    'stats',
  ].includes(currentView);

  if (!shouldShowSearch) return null;

  return (
    <FloatingSearch
      onSearch={handleSearch}
      onClose={handleClose}
      isSearchActive={isSearchActive}
      actions={getPageActions()}
      pageContext={getPageContext()}
    />
  );
};

const MainContent: React.FC = () => {
  const { currentView, isSearchActive, searchQuery, selectedCollectionId } = useNavigationStore();
  const pluginUIRegistry = usePluginUIRegistry();

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

  // Home view - show search results or discover (FloatingSearch inside for animations)
  if (currentView === 'home') {
    const showSearchResults = isSearchActive && searchQuery;

    return (
      <div className={`home-view ${showSearchResults ? 'searching' : ''}`}>
        <HomeFloatingSearch />
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
    case 'collections':
      return <CollectionsView />;
    case 'collection-detail':
      return selectedCollectionId ? <CollectionView collectionId={selectedCollectionId} /> : <CollectionsView />;
    case 'tags':
      return <TagManager onTagClick={(tagName) => useNavigationStore.getState().openTagDetail(tagName)} />;
    case 'tag-detail':
      return <TagDetailView />;
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
  const [addToCollectionTrack, setAddToCollectionTrack] = useState<UnifiedTrack | null>(null);
  const [tagTrack, setTagTrack] = useState<UnifiedTrack | null>(null);
  const [dislikeTrack, setDislikeTrack] = useState<UnifiedTrack | null>(null);

  // Connection state for client mode
  const { state: connectionState, isClientMode, isLoading: connectionLoading } = useConnectionStore();

  // Get library store initialize function
  const initializeLibrary = useLibraryStore(state => state.initialize);
  const initializePlayer = usePlayerStore(state => state.initialize);
  const initializeCollections = useCollectionStore(state => state.initialize);
  const initializeTags = useTagStore(state => state.initialize);

  // Initialize plugin UIs on mount
  useEffect(() => {
    initializePluginUIs();
  }, []);

  // Initialize library store, player, collections, and tags when connected
  useEffect(() => {
    if (connectionState.connected) {
      console.log('[App] Connection established, initializing stores...');
      initializeLibrary();
      initializePlayer();
      initializeCollections();
      initializeTags();
    }
  }, [connectionState.connected, initializeLibrary, initializePlayer, initializeCollections, initializeTags]);

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
        onAddToCollection={setAddToCollectionTrack}
        onTagTrack={setTagTrack}
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
            <ScrobblingManager />
            <GlobalShortcutManager />
            <SkipTrackingManager />
            <EmbeddingManager />
            <Sidebar />
            <FloatingSearchManager />
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
          {addToCollectionTrack && (
            <AddToCollectionModal
              itemType="track"
              itemId={addToCollectionTrack.id}
              itemData={{
                title: addToCollectionTrack.title,
                artists: addToCollectionTrack.artists,
                artwork: addToCollectionTrack.artwork,
                album: addToCollectionTrack.album,
              }}
              onClose={() => setAddToCollectionTrack(null)}
            />
          )}
          {tagTrack && (
            <TagTrackModal
              track={tagTrack}
              onClose={() => setTagTrack(null)}
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
