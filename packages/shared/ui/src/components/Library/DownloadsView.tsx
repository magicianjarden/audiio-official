/**
 * DownloadsView - Shows download queue and completed downloads
 *
 * All downloads are managed server-side. This component fetches
 * download status from library-store and displays progress.
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useLibraryStore, type Download } from '../../stores/library-store';
import { usePlayerStore } from '../../stores/player-store';
import { FloatingSearch, SearchAction } from '../Search/FloatingSearch';
import {
  DownloadIcon,
  PlayIcon,
  CloseIcon,
  RefreshIcon,
  MusicNoteIcon,
  CheckCircleIcon,
  AlertIcon,
  FilterIcon,
} from '@audiio/icons';

type StatusFilter = 'all' | 'completed' | 'in_progress' | 'failed';

// Get display title for a download
const getDownloadTitle = (download: Download): string => {
  if (download.track?.title) return download.track.title;
  if (download.filename) {
    // Remove extension and clean up filename
    return download.filename.replace(/\.[^/.]+$/, '');
  }
  return 'Unknown';
};

// Get display artist for a download
const getDownloadArtist = (download: Download): string => {
  if (download.track?.artists?.length) {
    return download.track.artists.map(a => a.name).join(', ');
  }
  return 'Unknown Artist';
};

// Get artwork URL for a download
const getDownloadArtwork = (download: Download): string | undefined => {
  if (download.track?.artwork) {
    const artwork = download.track.artwork;
    if (typeof artwork === 'string') return artwork;
    return artwork.medium || artwork.small || artwork.url;
  }
  return undefined;
};

export const DownloadsView: React.FC = () => {
  const { downloads, removeDownload, retryDownload, refreshDownloads } = useLibraryStore();
  const { play, setQueue, currentTrack } = usePlayerStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Refresh downloads on mount and periodically while there are active downloads
  useEffect(() => {
    refreshDownloads();

    const hasActive = downloads.some(d =>
      d.status === 'queued' || d.status === 'downloading' || d.status === 'processing'
    );

    if (hasActive) {
      const interval = setInterval(refreshDownloads, 2000);
      return () => clearInterval(interval);
    }
  }, [downloads.some(d => d.status === 'queued' || d.status === 'downloading')]);

  // Categorize downloads
  const completedDownloads = downloads.filter(d => d.status === 'completed');
  const activeDownloads = downloads.filter(d =>
    d.status === 'queued' || d.status === 'downloading' || d.status === 'processing'
  );
  const failedDownloads = downloads.filter(d => d.status === 'failed');

  const filteredDownloads = useMemo(() => {
    let filtered = [...downloads];

    // Filter by global search query
    if (searchQuery?.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(download => {
        const title = getDownloadTitle(download).toLowerCase();
        const artist = getDownloadArtist(download).toLowerCase();
        return title.includes(query) || artist.includes(query);
      });
    }

    // Filter by status
    switch (statusFilter) {
      case 'completed':
        filtered = filtered.filter(d => d.status === 'completed');
        break;
      case 'in_progress':
        filtered = filtered.filter(d =>
          d.status === 'queued' || d.status === 'downloading' || d.status === 'processing'
        );
        break;
      case 'failed':
        filtered = filtered.filter(d => d.status === 'failed');
        break;
    }

    // Sort downloads
    switch (sortBy) {
      case 'title':
        filtered.sort((a, b) => getDownloadTitle(a).localeCompare(getDownloadTitle(b)));
        break;
      case 'title-desc':
        filtered.sort((a, b) => getDownloadTitle(b).localeCompare(getDownloadTitle(a)));
        break;
      case 'recent':
      default:
        filtered.sort((a, b) => {
          const timeA = a.startedAt?.getTime() || 0;
          const timeB = b.startedAt?.getTime() || 0;
          return timeB - timeA;
        });
        break;
    }

    return filtered;
  }, [downloads, searchQuery, statusFilter, sortBy]);

  // Group filtered downloads by status for display
  const filteredCompleted = filteredDownloads.filter(d => d.status === 'completed');
  const filteredActive = filteredDownloads.filter(d =>
    d.status !== 'completed' && d.status !== 'cancelled'
  );

  const handlePlayDownload = (download: Download) => {
    if (download.status === 'completed' && download.track) {
      const playableTracks = filteredCompleted
        .filter(d => d.track)
        .map(d => d.track!);
      const index = playableTracks.findIndex(t => t.id === download.track?.id);
      if (index >= 0) {
        setQueue(playableTracks, index);
        play(download.track);
      }
    }
  };

  const handleRemove = (downloadId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    removeDownload(downloadId);
  };

  const handleRetry = async (downloadId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    await retryDownload(downloadId);
  };

  const formatProgress = (progress: number) => `${Math.round(progress)}%`;

  const formatSpeed = (bytesPerSec?: number) => {
    if (!bytesPerSec) return '';
    if (bytesPerSec > 1024 * 1024) {
      return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
    }
    if (bytesPerSec > 1024) {
      return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
    }
    return `${bytesPerSec} B/s`;
  };

  const formatEta = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  // Build actions for the search bar
  const actions: SearchAction[] = useMemo(() => {
    const result: SearchAction[] = [];

    // Status filters
    result.push({
      id: 'filter-all',
      label: 'All',
      icon: <FilterIcon size={14} />,
      active: statusFilter === 'all',
      onClick: () => setStatusFilter('all'),
    });
    result.push({
      id: 'filter-completed',
      label: 'Completed',
      icon: <CheckCircleIcon size={14} />,
      active: statusFilter === 'completed',
      onClick: () => setStatusFilter('completed'),
    });
    result.push({
      id: 'filter-progress',
      label: 'In Progress',
      icon: <DownloadIcon size={14} />,
      active: statusFilter === 'in_progress',
      onClick: () => setStatusFilter('in_progress'),
    });

    return result;
  }, [statusFilter]);

  const isSearching = searchQuery.trim().length > 0;

  const handleClose = useCallback(() => {
    setSearchQuery('');
  }, []);

  return (
    <div className={`library-view downloads-view ${isSearching ? 'searching' : ''}`}>
      <FloatingSearch
        onSearch={setSearchQuery}
        onClose={handleClose}
        isSearchActive={isSearching}
        actions={actions}
        pageContext={{
          type: 'downloads',
          label: 'Downloads',
          icon: <DownloadIcon size={14} />,
        }}
      />

      <div className="library-content downloads-content">
        {/* Active Downloads Section */}
        {filteredActive.length > 0 && (
          <section className="downloads-section">
            <h2 className="downloads-section-title">In Progress</h2>
            <div className="downloads-list">
              {filteredActive.map((download) => (
                <div key={download.id} className="download-item">
                  <div className="download-artwork">
                    {getDownloadArtwork(download) ? (
                      <img
                        src={getDownloadArtwork(download)}
                        alt={getDownloadTitle(download)}
                      />
                    ) : (
                      <div className="download-artwork-placeholder">
                        <MusicNoteIcon size={24} />
                      </div>
                    )}
                  </div>
                  <div className="download-info">
                    <div className="download-title">{getDownloadTitle(download)}</div>
                    <div className="download-artist">{getDownloadArtist(download)}</div>

                    {download.status === 'downloading' && (
                      <div className="download-progress">
                        <div
                          className="download-progress-bar"
                          style={{ '--progress': `${download.progress}%` } as React.CSSProperties}
                        />
                        <span className="download-progress-text">
                          {formatProgress(download.progress)}
                          {download.speed && ` · ${formatSpeed(download.speed)}`}
                          {download.eta && ` · ${formatEta(download.eta)} left`}
                        </span>
                      </div>
                    )}

                    {download.status === 'queued' && (
                      <div className="download-status">Queued...</div>
                    )}

                    {download.status === 'processing' && (
                      <div className="download-status">Processing...</div>
                    )}

                    {download.status === 'failed' && (
                      <div className="download-status error">
                        <AlertIcon size={12} />
                        {download.error || 'Download failed'}
                      </div>
                    )}
                  </div>
                  <div className="download-actions">
                    {download.status === 'failed' && (
                      <button
                        className="download-retry"
                        onClick={(e) => handleRetry(download.id, e)}
                        title="Retry"
                      >
                        <RefreshIcon size={18} />
                      </button>
                    )}
                    <button
                      className="download-remove"
                      onClick={(e) => handleRemove(download.id, e)}
                      title="Cancel"
                    >
                      <CloseIcon size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Completed Downloads Section */}
        <section className="downloads-section">
          <h2 className="downloads-section-title">
            Downloaded
            {filteredCompleted.length > 0 && (
              <span className="downloads-section-count">{filteredCompleted.length}</span>
            )}
          </h2>

          {downloads.length === 0 ? (
            <div className="library-empty">
              <div className="library-empty-icon">
                <DownloadIcon size={48} />
              </div>
              <h3>No downloads yet</h3>
              <p>Download songs to listen offline</p>
            </div>
          ) : filteredCompleted.length === 0 && statusFilter !== 'in_progress' ? (
            <div className="library-empty">
              <div className="library-empty-icon">
                <DownloadIcon size={48} />
              </div>
              <h3>No matching downloads</h3>
              <p>Try adjusting your search or filter</p>
            </div>
          ) : filteredCompleted.length > 0 ? (
            <div className="downloads-list">
              {filteredCompleted.map((download) => (
                <div
                  key={download.id}
                  className={`download-item completed ${
                    currentTrack?.id === download.track?.id ? 'playing' : ''
                  }`}
                  onClick={() => handlePlayDownload(download)}
                >
                  <div className="download-artwork">
                    {getDownloadArtwork(download) ? (
                      <img
                        src={getDownloadArtwork(download)}
                        alt={getDownloadTitle(download)}
                      />
                    ) : (
                      <div className="download-artwork-placeholder">
                        <MusicNoteIcon size={24} />
                      </div>
                    )}
                    <div className="download-play-overlay">
                      <PlayIcon size={24} />
                    </div>
                  </div>
                  <div className="download-info">
                    <div className="download-title">{getDownloadTitle(download)}</div>
                    <div className="download-artist">{getDownloadArtist(download)}</div>
                    <div className="download-status success">
                      <CheckCircleIcon size={12} /> Downloaded
                    </div>
                  </div>
                  <button
                    className="download-remove"
                    onClick={(e) => handleRemove(download.id, e)}
                    title="Remove"
                  >
                    <CloseIcon size={18} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
};

export default DownloadsView;
