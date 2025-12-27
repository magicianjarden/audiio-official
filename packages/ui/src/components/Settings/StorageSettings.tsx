/**
 * StorageSettings - Configure download folder, local music, and plugins
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useSettingsStore, type LocalMusicFolder } from '../../stores/settings-store';
import { useLibraryStore } from '../../stores/library-store';
import {
  FolderIcon,
  DownloadIcon,
  MusicNoteIcon,
  PluginIcon,
  AddIcon,
  TrashIcon,
  RefreshIcon,
  CheckIcon,
  ChevronRightIcon,
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
}

const LocalMusicFolderCard: React.FC<LocalMusicFolderCardProps> = ({
  folder,
  onRemove,
  onScan,
}) => {
  const lastScannedText = folder.lastScanned
    ? new Date(folder.lastScanned).toLocaleDateString()
    : 'Never';

  return (
    <div className={`local-music-folder-card ${folder.isScanning ? 'scanning' : ''}`}>
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
      </div>
      <div className="local-music-folder-actions">
        <button
          className="local-music-folder-action"
          onClick={onScan}
          disabled={folder.isScanning}
          title="Rescan folder"
        >
          <RefreshIcon size={16} className={folder.isScanning ? 'spinning' : ''} />
        </button>
        <button
          className="local-music-folder-action danger"
          onClick={onRemove}
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
    pluginFolder,
    localMusicFolders,
    setDownloadFolder,
    setPluginFolder,
    addLocalMusicFolder,
    removeLocalMusicFolder,
    updateLocalMusicFolder,
  } = useSettingsStore();

  const { setLocalFolderPlaylistTracks, deleteLocalFolderPlaylist } = useLibraryStore();

  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [pluginNotification, setPluginNotification] = useState<string | null>(null);

  // Set up plugin folder watcher when pluginFolder changes
  useEffect(() => {
    if (window.api?.setPluginFolder) {
      window.api.setPluginFolder(pluginFolder);
    }
  }, [pluginFolder]);

  // Listen for plugin detection events
  useEffect(() => {
    if (!window.api?.onPluginDetected) return;

    const unsubscribe = window.api.onPluginDetected(async (data) => {
      console.log('[StorageSettings] Plugin detected:', data.filename);

      // Auto-install the plugin
      if (window.api?.installPlugin) {
        const result = await window.api.installPlugin(data.path);
        if (result.success) {
          setPluginNotification(`Installed: ${result.plugin.name}`);
          setTimeout(() => setPluginNotification(null), 3000);
        } else {
          setPluginNotification(`Failed: ${result.error}`);
          setTimeout(() => setPluginNotification(null), 5000);
        }
      }
    });

    return () => unsubscribe();
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

  // Browse for plugin folder
  const handleBrowsePlugin = useCallback(async () => {
    if (window.api?.selectFolder) {
      const result = await window.api.selectFolder({
        title: 'Select Plugin Folder',
        defaultPath: pluginFolder || undefined,
      });
      if (result) {
        setPluginFolder(result);
      }
    }
  }, [pluginFolder, setPluginFolder]);

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
              />
            ))}
          </div>
        )}
      </div>

      {/* Plugin Folder */}
      <div className="storage-section">
        <h3 className="storage-section-title">
          <PluginIcon size={18} />
          Plugins
        </h3>
        <FolderPicker
          label="Plugin Folder"
          description="Drop plugins here to install them automatically"
          icon={<PluginIcon size={20} />}
          value={pluginFolder}
          placeholder="Select a folder for plugins"
          onChange={setPluginFolder}
          onBrowse={handleBrowsePlugin}
        />
        {pluginFolder && (
          <div className="storage-plugin-hint">
            <CheckIcon size={14} />
            <span>
              Watching for new plugins. Drop <code>.audiio-plugin</code> files into this folder to install.
            </span>
          </div>
        )}
        {pluginNotification && (
          <div className={`storage-plugin-notification ${pluginNotification.startsWith('Failed') ? 'error' : 'success'}`}>
            {pluginNotification}
          </div>
        )}
      </div>
    </div>
  );
};

export default StorageSettings;
