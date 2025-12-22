/**
 * DiscographyTabs - Tabbed view for artist discography
 * Shows Albums, Singles, EPs, Compilations, Appears On
 */

import React from 'react';
import { PlayIcon, MusicNoteIcon } from '../Icons/Icons';
import type { SearchAlbum } from '../../stores/search-store';
import { useAlbumContextMenu } from '../../contexts/ContextMenuContext';

type TabId = 'albums' | 'singles' | 'eps' | 'compilations' | 'appears-on';

interface Tab {
  id: TabId;
  label: string;
  count: number;
}

interface DiscographyTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  albums: SearchAlbum[];
  singles: SearchAlbum[];
  eps: SearchAlbum[];
  compilations: SearchAlbum[];
  appearsOn: SearchAlbum[];
  onAlbumClick: (album: SearchAlbum) => void;
  isLoading?: boolean;
}

export const DiscographyTabs: React.FC<DiscographyTabsProps> = ({
  activeTab,
  onTabChange,
  albums,
  singles,
  eps,
  compilations,
  appearsOn,
  onAlbumClick,
  isLoading
}) => {
  const { showContextMenu } = useAlbumContextMenu();

  // Build tabs array - only show tabs with content (except albums which always shows)
  const allTabs: Tab[] = [
    { id: 'albums', label: 'Albums', count: albums.length },
    { id: 'singles', label: 'Singles', count: singles.length },
    { id: 'eps', label: 'EPs', count: eps.length },
    { id: 'compilations', label: 'Compilations', count: compilations.length },
    { id: 'appears-on', label: 'Appears On', count: appearsOn.length }
  ];
  const tabs = allTabs.filter(tab => tab.count > 0 || tab.id === 'albums');

  const getActiveContent = (): SearchAlbum[] => {
    switch (activeTab) {
      case 'albums':
        return albums;
      case 'singles':
        return singles;
      case 'eps':
        return eps;
      case 'compilations':
        return compilations;
      case 'appears-on':
        return appearsOn;
      default:
        return albums;
    }
  };

  const content = getActiveContent();

  return (
    <div className="discography-tabs">
      {/* Tab buttons */}
      <div className="tab-buttons" role="tablist">
        {tabs.map(tab => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="tab-count">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="tab-content" role="tabpanel">
        {isLoading ? (
          <div className="discography-loading">
            <div className="album-grid-skeleton">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="album-card-skeleton skeleton" />
              ))}
            </div>
          </div>
        ) : content.length > 0 ? (
          <div className="discography-grid">
            {content.map(album => (
              <div
                key={album.id}
                className="album-card"
                onClick={() => onAlbumClick(album)}
                onContextMenu={(e) => showContextMenu(e, album)}
              >
                <div className="album-card-image">
                  {album.artwork ? (
                    <img src={album.artwork} alt={album.title} loading="lazy" />
                  ) : (
                    <div className="album-card-placeholder">
                      <MusicNoteIcon size={32} />
                    </div>
                  )}
                  <div className="album-card-play">
                    <PlayIcon size={24} />
                  </div>
                </div>
                <div className="album-card-info">
                  <span className="album-card-title">{album.title}</span>
                  {album.year && (
                    <span className="album-card-year">{album.year}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="discography-empty">
            <p>No {activeTab.replace('-', ' ')} found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DiscographyTabs;
