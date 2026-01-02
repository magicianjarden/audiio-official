/**
 * Audiio Mobile - Main App Component
 *
 * Spotify-like remote for your Audiio desktop app.
 * All settings and addons are managed on the host - this is just the remote.
 */

import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './stores/auth-store';
import { usePlayerStore } from './stores/player-store';
import { useP2PStore } from './stores/p2p-store';
import { ActionSheetProvider } from './contexts/ActionSheetContext';
import { Layout } from './components/Layout';
import { PageTransition } from './components/PageTransition';
import { HomePage } from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { NowPlayingPage } from './pages/NowPlayingPage';
import { QueuePage } from './pages/QueuePage';
import { LyricsPage } from './pages/LyricsPage';
import { LibraryPage } from './pages/LibraryPage';
import { PlaylistDetailPage } from './pages/PlaylistDetailPage';
import { ArtistPage } from './pages/ArtistPage';
import { AlbumPage } from './pages/AlbumPage';
import { SettingsPage } from './pages/SettingsPage';
import { PluginsPage } from './pages/PluginsPage';
import { PluginDetailPage } from './pages/PluginDetailPage';
import { AuthPage } from './pages/AuthPage';

// Check if we're in remote mode (GitHub Pages, etc.)
function isRemoteMode(): boolean {
  const host = window.location.hostname;
  return host.includes('github.io') ||
         host.includes('netlify') ||
         host.includes('vercel') ||
         host.includes('pages.dev');
}

export function App() {
  const { isAuthenticated, validateToken, deviceToken } = useAuthStore();
  const { connectWebSocket } = usePlayerStore();
  const p2pStatus = useP2PStore((state) => state.status);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // In remote mode, don't try to validate via HTTP - it won't work
    // Just check if we have saved credentials and let AuthPage handle P2P
    if (isRemoteMode()) {
      setIsLoading(false);
      return;
    }
    // Validate the stored device token on mount (local mode only)
    validateToken().finally(() => setIsLoading(false));
  }, [validateToken]);

  useEffect(() => {
    // In remote mode, P2P handles connection - skip WebSocket
    if (isRemoteMode()) {
      console.log('[App] Remote mode - using P2P, skipping WebSocket');
      return;
    }
    // Connect WebSocket when authenticated with device token (local mode)
    if (isAuthenticated && deviceToken) {
      connectWebSocket(deviceToken);
    }
  }, [isAuthenticated, deviceToken, connectWebSocket]);

  if (isLoading) {
    return (
      <div className="app-container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--color-bg-primary)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{
            width: 40,
            height: 40,
            border: '3px solid var(--color-bg-elevated)',
            borderTopColor: 'var(--color-accent)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p style={{ color: 'var(--color-text-secondary)' }}>Connecting...</p>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // In remote mode, require P2P connection to be authenticated
  // In local mode, just check the traditional auth state
  const isActuallyAuthenticated = isRemoteMode()
    ? (isAuthenticated && p2pStatus === 'connected')
    : isAuthenticated;

  if (!isActuallyAuthenticated) {
    return <AuthPage />;
  }

  return (
    <BrowserRouter>
      <ActionSheetProvider>
        <Layout>
          <AnimatedRoutes />
        </Layout>
      </ActionSheetProvider>
    </BrowserRouter>
  );
}

/** Routes with page transitions */
function AnimatedRoutes() {
  const location = useLocation();

  return (
    <PageTransition key={location.pathname}>
      <Routes location={location}>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/now-playing" element={<NowPlayingPage />} />
        <Route path="/lyrics" element={<LyricsPage />} />
        <Route path="/queue" element={<QueuePage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/playlist/:playlistId" element={<PlaylistDetailPage />} />
        <Route path="/artist/:artistId" element={<ArtistPage />} />
        <Route path="/album/:albumId" element={<AlbumPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/plugins" element={<PluginsPage />} />
        <Route path="/plugins/:pluginId" element={<PluginDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PageTransition>
  );
}
