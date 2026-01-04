/**
 * StorageSettings - Configure download folder and local music
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useSettingsStore, type LocalMusicFolder } from '../../stores/settings-store';
import { useLibraryStore } from '../../stores/library-store';
import {
  FolderIcon,
  DownloadIcon,
  MusicNoteIcon,
  AddIcon,
  TrashIcon,
  RefreshIcon,
  ZapIcon,
} from '@audiio/icons';

// ========================================
// Folder Picker Row
// ========================================

interface FolderPickerProps {
  label: string;
  description: string;
  icon: React.ReactNode;
  value: string | null;
  placeholder: string;
  onChange: (path: string | null) => void;
  onBrowse: () => void;
}

const FolderPicker: React.FC<FolderPickerProps> = ({
  label,
  description,
  icon,
  value,
  placeholder,
  onChange,
  onBrowse,
}) => {
  return (
    <div className="storage-folder-picker">
      <div className="storage-folder-info">
        <div className="storage-folder-icon">{icon}</div>
        <div className="storage-folder-text">
          <h4>{label}</h4>
          <p>{description}</p>
        </div>
      </div>
      <div className="storage-folder-input">
        <input
          type="text"
          value={value || ''}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value || null)}
          readOnly
        />
        <button className="storage-folder-browse" onClick={onBrowse}>
          <FolderIcon size={16} />
          <span>Browse</span>
        </button>
        {value && (
          <button
            className="storage-folder-clear"
            onClick={() => onChange(null)}
            title="Reset to default"
          >
            <TrashIcon size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

// ========================================
// Local Music Folder Card
// ========================================

interface LocalMusicFolderCardProps {
  folder: LocalMusicFolder;
  onRemove: () => void;
  onScan: () => void;
  onEnrich: () => void;
  isEnriching?: boolean;
  enrichProgress?: { current: number; total: number; status: string } | null;
}

const LocalMusicFolderCard: React.FC<LocalMusicFolderCardProps> = ({
  folder,
  onRemove,
  onScan,
  onEnrich,
  isEnriching = false,
  enrichProgress = null,
}) => {
  const lastScannedText = folder.lastScanned
    ? new Date(folder.lastScanned).toLocaleDateString()
    : 'Never';

  const isBusy = folder.isScanning || isEnriching;

  return (
    <div className={`local-music-folder-card ${isBusy ? 'scanning' : ''}`}>
      <div className="local-music-folder-icon">
        <FolderIcon size={24} />
      </div>
      <div className="local-music-folder-info">
        <h4>{folder.name}</h4>
        <p className="local-music-folder-path">{folder.path}</p>
        <div className="local-music-folder-meta">
          <span>{folder.trackCount} tracks</span>
          <span>•</span>
          <span>Scanned: {lastScannedText}</span>
        </div>
        {isEnriching && enrichProgress && (
          <div className="local-music-folder-progress">
            <div className="local-music-folder-progress-bar">
              <div
                className="local-music-folder-progress-fill"
                style={{ width: `${(enrichProgress.current / enrichProgress.total) * 100}%` }}
              />
            </div>
            <span className="local-music-folder-progress-text">
              {enrichProgress.status} ({enrichProgress.current}/{enrichProgress.total})
            </span>
          </div>
        )}
      </div>
      <div className="local-music-folder-actions">
        <button
          className="local-music-folder-action enrich"
          onClick={onEnrich}
          disabled={isBusy}
          title="Fetch missing metadata & artwork"
        >
          <ZapIcon size={16} className={isEnriching ? 'spinning' : ''} />
        </button>
        <button
          className="local-music-folder-action"
          onClick={onScan}
          disabled={isBusy}
          title="Rescan folder"
        >
          <RefreshIcon size={16} className={folder.isScanning ? 'spinning' : ''} />
        </button>
        <button
          className="local-music-folder-action danger"
          onClick={onRemove}
          disabled={isBusy}
          title="Remove folder"
        >
          <TrashIcon size={16} />
        </button>
      </div>
    </div>
  );
};

// ========================================
// Storage Settings
// ========================================

export const StorageSettings: React.FC = () => {
  const {
    downloadFolder,
    localMusicFolders,
    setDownloadFolder,
    addLocalMusicFolder,
    removeLocalMusicFolder,
    updateLocalMusicFolder,
  } = useSettingsStore();

  const { setLocalFolderPlaylistTracks, deleteLocalFolderPlaylist, getLocalFolderTracks } = useLibraryStore();

  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [enrichingFolderId, setEnrichingFolderId] = useState<string | null>(null);
  const [enrichProgress, setEnrichProgress] = useState<{ current: number; total: number; status: string } | null>(null);

  // Listen for enrichment progress events
  useEffect(() => {
    if (!window.api?.onEnrichProgress) return;

    const unsubscribe = window.api.onEnrichProgress((progress) => {
      setEnrichProgress(progress);
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  // Browse for download folder
  const handleBrowseDownload = useCallback(async () => {
    if (window.api?.selectFolder) {
      const result = await window.api.selectFolder({
        title: 'Select Download Folder',
        defaultPath: downloadFolder || undefined,
      });
      if (result) {
        setDownloadFolder(result);
      }
    }
  }, [downloadFolder, setDownloadFolder]);

  // Add local music folder
  const handleAddMusicFolder = useCallback(async () => {
    if (window.api?.selectFolder) {
      setIsAddingFolder(true);
      try {
        const result = await window.api.selectFolder({
          title: 'Select Music Folder',
        });
        if (result) {
          // Extract folder name from path
          const name = result.split(/[/\\]/).pop() || 'Music';
          addLocalMusicFolder({ path: result, name });

          // Start scanning the folder
          if (window.api?.scanMusicFolder) {
            const folderId = useSettingsStore.getState().localMusicFolders.find(
              (f) => f.path === result
            )?.id;
            if (folderId) {
              updateLocalMusicFolder(folderId, { isScanning: true });
              try {
                const scanResult = await window.api.scanMusicFolder(result);
                updateLocalMusicFolder(folderId, {
                  trackCount: scanResult.trackCount,
                  lastScanned: Date.now(),
                  isScanning: false,
                });

                // Create/update playlist with scanned tracks
                if (scanResult.tracks?.length > 0) {
                  setLocalFolderPlaylistTracks(folderId, name, scanResult.tracks);
                }
              } catch (error) {
                console.error('Failed to scan folder:', error);
                updateLocalMusicFolder(folderId, { isScanning: false });
              }
            }
          }
        }
      } finally {
        setIsAddingFolder(false);
      }
    }
  }, [addLocalMusicFolder, updateLocalMusicFolder, setLocalFolderPlaylistTracks]);

  // Rescan a music folder
  const handleRescanFolder = useCallback(
    async (folder: LocalMusicFolder) => {
      if (window.api?.scanMusicFolder) {
        updateLocalMusicFolder(folder.id, { isScanning: true });
        try {
          const result = await window.api.scanMusicFolder(folder.path);
          updateLocalMusicFolder(folder.id, {
            trackCount: result.trackCount,
            lastScanned: Date.now(),
            isScanning: false,
          });

          // Update playlist with rescanned tracks
          if (result.tracks?.length > 0) {
            setLocalFolderPlaylistTracks(folder.id, folder.name, result.tracks);
          }
        } catch (error) {
          console.error('Failed to scan folder:', error);
          updateLocalMusicFolder(folder.id, { isScanning: false });
        }
      }
    },
    [updateLocalMusicFolder, setLocalFolderPlaylistTracks]
  );

  // Remove a music folder and its linked playlist
  const handleRemoveFolder = useCallback(
    (folderId: string) => {
      // Delete the linked playlist first
      deleteLocalFolderPlaylist(folderId);
      // Then remove the folder from settings
      removeLocalMusicFolder(folderId);
    },
    [removeLocalMusicFolder, deleteLocalFolderPlaylist]
  );

  // Enrich metadata for tracks in a folder
  const handleEnrichFolder = useCallback(
    async (folder: LocalMusicFolder) => {
      if (!window.api?.enrichLocalTracks) {
        console.error('Enrichment API not available');
        return;
      }

      setEnrichingFolderId(folder.id);
      setEnrichProgress({ current: 0, total: 0, status: 'Preparing...' });

      try {
        // Get tracks for this folder from the library
        const tracks = getLocalFolderTracks(folder.id);

        if (!tracks || tracks.length === 0) {
          console.log('No tracks to enrich');
          return;
        }

        // Filter tracks that need enrichment (have _localPath and missing data)
        const tracksToEnrich = tracks
          .filter((t: any) => t._localPath || t.id.startsWith('local:'))
          .map((t: any) => ({
            id: t.id,
            title: t.title,
            artists: t.artists?.map((a: any) => a.name) || ['Unknown Artist'],
            album: t.album?.title,
            duration: t.duration,
            filePath: t._localPath || (t.id.startsWith('local:')
              ? Buffer.from(t.id.slice(6), 'base64').toString('utf-8')
              : ''),
          }))
          .filter((t: any) => t.filePath);

        if (tracksToEnrich.length === 0) {
          console.log('No tracks need enrichment');
          return;
        }

        setEnrichProgress({ current: 0, total: tracksToEnrich.length, status: 'Matching tracks...' });

        // Call the enrichment API
        const result = await window.api.enrichLocalTracks(tracksToEnrich);

        console.log('Enrichment complete:', result.summary);

        // Rescan folder to pick up updated metadata
        if (result.summary.enriched > 0) {
          await handleRescanFolder(folder);
        }
      } catch (error) {
        console.error('Enrichment failed:', error);
      } finally {
        setEnrichingFolderId(null);
        setEnrichProgress(null);
      }
    },
    [getLocalFolderTracks, handleRescanFolder]
  );

  return (
    <div className="storage-settings">
      {/* Download Folder */}
      <div className="storage-section">
        <h3 className="storage-section-title">
          <DownloadIcon size={18} />
          Downloads
        </h3>
        <FolderPicker
          label="Download Location"
          description="Where downloaded tracks are saved"
          icon={<DownloadIcon size={20} />}
          value={downloadFolder}
          placeholder="~/Downloads/Audiio (default)"
          onChange={setDownloadFolder}
          onBrowse={handleBrowseDownload}
        />
      </div>

      {/* Local Music Folders */}
      <div className="storage-section">
        <div className="storage-section-header">
          <h3 className="storage-section-title">
            <MusicNoteIcon size={18} />
            Local Music
          </h3>
          <button
            className="storage-add-btn"
            onClick={handleAddMusicFolder}
            disabled={isAddingFolder}
          >
            <AddIcon size={16} />
            <span>Add Folder</span>
          </button>
        </div>
        <p className="storage-section-description">
          Add folders containing your local music files. Audiio will scan for MP3, FLAC, WAV, and other audio formats.
        </p>

        {localMusicFolders.length === 0 ? (
          <div className="storage-empty">
            <FolderIcon size={32} />
            <p>No local music folders added</p>
            <button className="storage-empty-btn" onClick={handleAddMusicFolder}>
              <AddIcon size={16} />
              Add Music Folder
            </button>
          </div>
        ) : (
          <div className="local-music-folder-list">
            {localMusicFolders.map((folder) => (
              <LocalMusicFolderCard
                key={folder.id}
                folder={folder}
                onRemove={() => handleRemoveFolder(folder.id)}
                onScan={() => handleRescanFolder(folder)}
                onEnrich={() => handleEnrichFolder(folder)}
                isEnriching={enrichingFolderId === folder.id}
                enrichProgress={enrichingFolderId === folder.id ? enrichProgress : null}
              />
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default StorageSettings;
