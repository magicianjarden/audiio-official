/**
 * Layout Component - Mobile app shell with bottom navigation and player bar
 *
 * Features:
 * - Connection status banner (Plex-style)
 * - Bottom navigation with active states
 * - Mini player + Full player integration
 */

import React, { useState, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { MiniPlayer } from './MiniPlayer';
import { FullPlayer } from './FullPlayer';
import { ConnectionBanner } from './ConnectionBanner';
import { usePlayerStore } from '../stores/player-store';
import styles from './Layout.module.css';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { currentTrack } = usePlayerStore();
  const [isFullPlayerOpen, setIsFullPlayerOpen] = useState(false);

  // Hide mini player on now-playing and lyrics pages (they have their own player UI)
  const hideMiniPlayer = location.pathname === '/now-playing' || location.pathname === '/lyrics';
  const showPlayer = currentTrack && !hideMiniPlayer;

  // Check if on library-related paths
  const isLibraryActive = location.pathname === '/library' || location.pathname.startsWith('/playlist/');

  const handleExpandPlayer = useCallback(() => {
    setIsFullPlayerOpen(true);
  }, []);

  const handleClosePlayer = useCallback(() => {
    setIsFullPlayerOpen(false);
  }, []);

  return (
    <div className={`${styles.container} ${showPlayer ? styles.hasPlayer : ''}`}>
      <ConnectionBanner />

      <main className={styles.main}>
        {children}
      </main>

      {showPlayer && <MiniPlayer onExpand={handleExpandPlayer} />}

      <FullPlayer isOpen={isFullPlayerOpen} onClose={handleClosePlayer} />

      <nav className={styles.nav}>
        <NavLink to="/" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}>
          <DiscoverIcon />
          <span>Discover</span>
        </NavLink>
        <NavLink to="/library" className={() => `${styles.navItem} ${isLibraryActive ? styles.active : ''}`}>
          <LibraryIcon />
          <span>Library</span>
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}>
          <SettingsIcon />
          <span>Settings</span>
        </NavLink>
      </nav>
    </div>
  );
}

function DiscoverIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5.5-2.5l7.51-3.49L17.5 6.5 9.99 9.99 6.5 17.5zm5.5-6.6c.61 0 1.1.49 1.1 1.1s-.49 1.1-1.1 1.1-1.1-.49-1.1-1.1.49-1.1 1.1-1.1z"/>
    </svg>
  );
}

function LibraryIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 5h-3v5.5c0 1.38-1.12 2.5-2.5 2.5S10 13.88 10 12.5s1.12-2.5 2.5-2.5c.57 0 1.08.19 1.5.51V5h4v2zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6z"/>
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
    </svg>
  );
}
