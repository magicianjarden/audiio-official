import React, { useState, useMemo } from 'react';
import { useLibraryStore } from '../../stores/library-store';
import { usePlayerStore } from '../../stores/player-store';
import { LibraryActionBar, SortOption, FilterOption } from './LibraryActionBar';
import {
  DownloadIcon,
  PlayIcon,
  CloseIcon,
  RefreshIcon,
  MusicNoteIcon,
  CheckCircleIcon
} from '@audiio/icons';

type StatusFilter = 'all' | 'completed' | 'in_progress' | 'failed';

const SORT_OPTIONS: SortOption[] = [
  { value: 'recent', label: 'Recently Added' },
  { value: 'title', label: 'Title A-Z' },
  { value: 'title-desc', label: 'Title Z-A' },
  { value: 'artist', label: 'Artist A-Z' },
];

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: 'All Downloads',
  completed: 'Completed',
  in_progress: 'In Progress',
  failed: 'Failed',
};

export const DownloadsView: React.FC = () => {
  const { downloads, removeDownload, retryDownload } = useLibraryStore();
  const { play, setQueue, currentTrack } = usePlayerStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const completedDownloads = downloads.filter(d => d.status === 'completed');
  const activeDownloads = downloads.filter(d => d.status !== 'completed');
  const failedDownloads = downloads.filter(d => d.status === 'failed');

  const filteredDownloads = useMemo(() => {
    let filtered = [...downloads];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(download =>
        download.track.title.toLowerCase().includes(query) ||
        download.track.artists.some(a => a.name.toLowerCase().includes(query))
      );
    }

    // Filter by status
    switch (statusFilter) {
      case 'completed':
        filtered = filtered.filter(d => d.status === 'completed');
        break;
      case 'in_progress':
        filtered = filtered.filter(d => d.status === 'pending' || d.status === 'downloading');
        break;
      case 'failed':
        filtered = filtered.filter(d => d.status === 'failed');
        break;
      case 'all':
      default:
        break;
    }

    // Sort downloads
    switch (sortBy) {
      case 'title':
        filtered.sort((a, b) => a.track.title.localeCompare(b.track.title));
        break;
      case 'title-desc':
        filtered.sort((a, b) => b.track.title.localeCompare(a.track.title));
        break;
      case 'artist':
        filtered.sort((a, b) => {
          const artistA = a.track.artists[0]?.name || '';
          const artistB = b.track.artists[0]?.name || '';
          return artistA.localeCompare(artistB);
        });
        break;
      case 'recent':
      default:
        break;
    }

    return filtered;
  }, [downloads, searchQuery, statusFilter, sortBy]);

  // Group filtered downloads by status for display
  const filteredCompleted = filteredDownloads.filter(d => d.status === 'completed');
  const filteredActive = filteredDownloads.filter(d => d.status !== 'completed');

  const handlePlayDownload = (download: typeof downloads[0]) => {
    if (download.status === 'completed') {
      const completedTracks = filteredCompleted.map(d => d.track);
      const index = completedTracks.findIndex(t => t.id === download.track.id);
      setQueue(completedTracks, index);
      play(download.track);
    }
  };

  const formatProgress = (progress: number) => `${Math.round(progress)}%`;

  const statusCounts = {
    all: downloads.length,
    completed: completedDownloads.length,
    in_progress: activeDownloads.length - failedDownloads.length,
    failed: failedDownloads.length,
  };

  const filterOptions: FilterOption[] = (Object.keys(STATUS_LABELS) as StatusFilter[]).map(status => ({
    value: status,
    label: STATUS_LABELS[status],
    count: statusCounts[status],
  }));

  return (
    <div className="library-view">
      <header className="library-header">
        <div className="library-header-icon downloads-icon"><DownloadIcon size={64} /></div>
        <div className="library-header-info">
          <span className="library-header-type">Library</span>
          <h1 className="library-header-title">Downloads</h1>
          <span className="library-header-count">
            {completedDownloads.length} downloaded{activeDownloads.length > 0 && ` · ${activeDownloads.length} in progress`}
          </span>
        </div>
      </header>

      {downloads.length > 0 && (
        <LibraryActionBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search downloads..."
          sortOptions={SORT_OPTIONS}
          currentSort={sortBy}
          onSortChange={setSortBy}
          filterOptions={filterOptions}
          currentFilter={statusFilter}
          onFilterChange={(value) => setStatusFilter(value as StatusFilter)}
          filterLabel="Status"
          totalCount={downloads.length}
          filteredCount={filteredDownloads.length}
        />
      )}

      <div className="library-content downloads-content">
        {filteredActive.length > 0 && (
          <section className="downloads-section">
            <h2 className="downloads-section-title">In Progress</h2>
            <div className="downloads-list">
              {filteredActive.map((download) => (
                <div key={download.track.id} className="download-item">
                  <div className="download-artwork">
                    {download.track.artwork?.medium ? (
                      <img src={download.track.artwork.medium} alt={download.track.title} />
                    ) : (
                      <div className="download-artwork-placeholder"><MusicNoteIcon size={24} /></div>
                    )}
                  </div>
                  <div className="download-info">
                    <div className="download-title">{download.track.title}</div>
                    <div className="download-artist">
                      {download.track.artists.map(a => a.name).join(', ')}
                    </div>
                    {download.status === 'downloading' && (
                      <div className="download-progress">
                        <div
                          className="download-progress-bar"
                          style={{ '--progress': `${download.progress}%` } as React.CSSProperties}
                        />
                        <span className="download-progress-text">
                          {formatProgress(download.progress)}
                        </span>
                      </div>
                    )}
                    {download.status === 'pending' && (
                      <div className="download-status">Waiting...</div>
                    )}
                    {download.status === 'failed' && (
                      <div className="download-status error">
                        {download.error || 'Download failed'}
                      </div>
                    )}
                  </div>
                  <div className="download-actions">
                    {download.status === 'failed' && (
                      <button
                        className="download-retry"
                        onClick={() => retryDownload(download.track.id)}
                        title="Retry"
                      >
                        <RefreshIcon size={18} />
                      </button>
                    )}
                    <button
                      className="download-remove"
                      onClick={() => removeDownload(download.track.id)}
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

        <section className="downloads-section">
          <h2 className="downloads-section-title">
            Downloaded
            {filteredCompleted.length > 0 && (
              <span className="downloads-section-count">{filteredCompleted.length}</span>
            )}
          </h2>
          {downloads.length === 0 ? (
            <div className="library-empty">
              <div className="library-empty-icon"><DownloadIcon size={48} /></div>
              <h3>No downloads yet</h3>
              <p>Download songs to listen offline</p>
            </div>
          ) : filteredCompleted.length === 0 && statusFilter !== 'in_progress' && statusFilter !== 'failed' ? (
            <div className="library-empty">
              <div className="library-empty-icon"><DownloadIcon size={48} /></div>
              <h3>No matching downloads</h3>
              <p>Try adjusting your search or filter</p>
            </div>
          ) : filteredCompleted.length > 0 ? (
            <div className="downloads-list">
              {filteredCompleted.map((download) => (
                <div
                  key={download.track.id}
                  className={`download-item completed ${
                    currentTrack?.id === download.track.id ? 'playing' : ''
                  }`}
                  onClick={() => handlePlayDownload(download)}
                >
                  <div className="download-artwork">
                    {download.track.artwork?.medium ? (
                      <img src={download.track.artwork.medium} alt={download.track.title} />
                    ) : (
                      <div className="download-artwork-placeholder"><MusicNoteIcon size={24} /></div>
                    )}
                    <div className="download-play-overlay"><PlayIcon size={24} /></div>
                  </div>
                  <div className="download-info">
                    <div className="download-title">{download.track.title}</div>
                    <div className="download-artist">
                      {download.track.artists.map(a => a.name).join(', ')}
                    </div>
                    <div className="download-status success">
                      <CheckCircleIcon size={12} /> Downloaded
                    </div>
                  </div>
                  <button
                    className="download-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeDownload(download.track.id);
                    }}
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
