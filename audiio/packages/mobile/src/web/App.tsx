/**
 * Audiio Mobile - Main App Component
 * Lite version for remote access to your music
 */

import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth-store';
import { usePlayerStore } from './stores/player-store';
import { ActionSheetProvider } from './contexts/ActionSheetContext';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { NowPlayingPage } from './pages/NowPlayingPage';
import { QueuePage } from './pages/QueuePage';
import { LibraryPage } from './pages/LibraryPage';
import { PlaylistDetailPage } from './pages/PlaylistDetailPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuthPage } from './pages/AuthPage';

export function App() {
  const { isAuthenticated, validateToken, token } = useAuthStore();
  const { connectWebSocket } = usePlayerStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for token in URL or stored token
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');

    if (urlToken) {
      // Store token and remove from URL
      useAuthStore.getState().setToken(urlToken);
      window.history.replaceState({}, '', window.location.pathname);
    }

    // Validate the stored token
    validateToken().finally(() => setIsLoading(false));
  }, [validateToken]);

  useEffect(() => {
    // Connect WebSocket when authenticated
    if (isAuthenticated && token) {
      connectWebSocket(token);
    }
  }, [isAuthenticated, token, connectWebSocket]);

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

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return (
    <BrowserRouter>
      <ActionSheetProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/now-playing" element={<NowPlayingPage />} />
            <Route path="/queue" element={<QueuePage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/playlist/:playlistId" element={<PlaylistDetailPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </ActionSheetProvider>
    </BrowserRouter>
  );
}
