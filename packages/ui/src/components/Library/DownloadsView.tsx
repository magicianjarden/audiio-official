import React from 'react';
import { useLibraryStore } from '../../stores/library-store';
import { usePlayerStore } from '../../stores/player-store';
import {
  DownloadIcon,
  PlayIcon,
  CloseIcon,
  RefreshIcon,
  MusicNoteIcon
} from '@audiio/icons';

export const DownloadsView: React.FC = () => {
  const { downloads, removeDownload, retryDownload } = useLibraryStore();
  const { play, currentTrack } = usePlayerStore();

  const completedDownloads = downloads.filter(d => d.status === 'completed');
  const activeDownloads = downloads.filter(d => d.status !== 'completed');

  const handlePlayDownload = (download: typeof downloads[0]) => {
    if (download.status === 'completed') {
      play(download.track);
    }
  };

  const formatProgress = (progress: number) => `${Math.round(progress)}%`;

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

      <div className="downloads-content">
        {activeDownloads.length > 0 && (
          <section className="downloads-section">
            <h2 className="downloads-section-title">In Progress</h2>
            <div className="downloads-list">
              {activeDownloads.map((download) => (
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
          <h2 className="downloads-section-title">Downloaded</h2>
          {completedDownloads.length === 0 ? (
            <div className="library-empty">
              <div className="library-empty-icon"><DownloadIcon size={48} /></div>
              <h3>No downloads yet</h3>
              <p>Download songs to listen offline</p>
            </div>
          ) : (
            <div className="downloads-list">
              {completedDownloads.map((download) => (
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
                    <div className="download-status success">Downloaded</div>
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
          )}
        </section>
      </div>
    </div>
  );
};
