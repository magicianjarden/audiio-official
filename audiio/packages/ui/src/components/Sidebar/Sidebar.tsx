import React from 'react';
import { useNavigationStore, type View } from '../../stores/navigation-store';
import { useLibraryStore } from '../../stores/library-store';
import { usePluginStore } from '../../stores/plugin-store';
import {
  DiscoverIcon,
  HeartIcon,
  ThumbDownIcon,
  PlaylistIcon,
  DownloadIcon,
  AddIcon,
  MusicNoteIcon,
  PluginIcon,
  SettingsIcon
} from '../Icons/Icons';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  view: View;
  isActive: boolean;
  onClick: () => void;
  badge?: number;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, isActive, onClick, badge }) => (
  <button
    className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
    onClick={onClick}
  >
    <span className="sidebar-nav-icon">{icon}</span>
    <span className="sidebar-nav-label">{label}</span>
    {badge !== undefined && badge > 0 && (
      <span className="sidebar-nav-badge">{badge > 99 ? '99+' : badge}</span>
    )}
  </button>
);

export const Sidebar: React.FC = () => {
  const { currentView, navigate } = useNavigationStore();
  const { likedTracks, dislikedTracks, playlists, downloads } = useLibraryStore();
  const { plugins } = usePluginStore();

  const pendingDownloads = downloads.filter(d => d.status !== 'completed').length;
  const enabledPlugins = plugins.filter(p => p.enabled).length;

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="sidebar-logo-icon"><MusicNoteIcon size={20} /></span>
        <span className="sidebar-logo-text">audiio</span>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section">
          <NavItem
            icon={<DiscoverIcon size={20} />}
            label="Discover"
            view="home"
            isActive={currentView === 'home'}
            onClick={() => navigate('home')}
          />
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-header">Your Library</div>
          <NavItem
            icon={<HeartIcon size={20} />}
            label="Liked Songs"
            view="likes"
            isActive={currentView === 'likes'}
            onClick={() => navigate('likes')}
            badge={likedTracks.length}
          />
          <NavItem
            icon={<ThumbDownIcon size={20} />}
            label="Disliked Songs"
            view="dislikes"
            isActive={currentView === 'dislikes'}
            onClick={() => navigate('dislikes')}
            badge={dislikedTracks.length}
          />
          <NavItem
            icon={<PlaylistIcon size={20} />}
            label="Playlists"
            view="playlists"
            isActive={currentView === 'playlists' || currentView === 'playlist-detail'}
            onClick={() => navigate('playlists')}
            badge={playlists.length}
          />
          <NavItem
            icon={<DownloadIcon size={20} />}
            label="Downloads"
            view="downloads"
            isActive={currentView === 'downloads'}
            onClick={() => navigate('downloads')}
            badge={pendingDownloads}
          />
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-header">Settings</div>
          <NavItem
            icon={<PluginIcon size={20} />}
            label="Plugins"
            view="plugins"
            isActive={currentView === 'plugins' || currentView === 'plugin-detail'}
            onClick={() => navigate('plugins')}
            badge={enabledPlugins}
          />
          <NavItem
            icon={<SettingsIcon size={20} />}
            label="Appearance"
            view="settings"
            isActive={currentView === 'settings'}
            onClick={() => navigate('settings')}
          />
        </div>
      </nav>

      <div className="sidebar-playlists">
        <div className="sidebar-section-header">
          Playlists
          <button
            className="sidebar-add-button"
            onClick={() => {
              const name = prompt('Playlist name:');
              if (name?.trim()) {
                useLibraryStore.getState().createPlaylist(name.trim());
              }
            }}
            title="Create Playlist"
          >
            <AddIcon size={18} />
          </button>
        </div>
        <div className="sidebar-playlist-list">
          {playlists.length === 0 ? (
            <div className="sidebar-empty">No playlists yet</div>
          ) : (
            playlists.slice(0, 10).map((playlist) => (
              <button
                key={playlist.id}
                className={`sidebar-playlist-item ${
                  currentView === 'playlist-detail' &&
                  useNavigationStore.getState().selectedPlaylistId === playlist.id
                    ? 'active'
                    : ''
                }`}
                onClick={() => useNavigationStore.getState().openPlaylist(playlist.id)}
              >
                <span className="sidebar-playlist-name">{playlist.name}</span>
                <span className="sidebar-playlist-count">{playlist.tracks.length}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </aside>
  );
};
