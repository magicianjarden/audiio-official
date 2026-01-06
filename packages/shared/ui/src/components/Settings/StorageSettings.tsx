/**
 * StorageSettings - Configure media folders (audio/video/downloads)
 *
 * All folder management is server-side. This component communicates
 * with the server via window.api to browse, add, remove, and scan folders.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useLibraryStore } from '../../stores/library-store';
import { showSuccessToast, showErrorToast } from '../../stores/toast-store';
import {
  FolderIcon,
  DownloadIcon,
  MusicNoteIcon,
  PlayIcon,
  AddIcon,
  TrashIcon,
  RefreshIcon,
  ZapIcon,
  ChevronRightIcon,
  SearchIcon,
  HomeIcon,
  CloseIcon,
} from '@audiio/icons';

// ========================================
// Types from server API
// ========================================

interface MediaFolder {
  id: string;
  name: string;
  path: string;
  type: 'audio' | 'video' | 'downloads';
  trackCount: number;
  lastScanned: number | null;
  isScanning: boolean;
  watchEnabled: boolean;
  createdAt: number;
}

interface FilesystemEntry {
  name: string;
  path: string;
}

interface BrowseResult {
  currentPath: string;
  parentPath: string | null;
  directories: FilesystemEntry[];
  canWrite: boolean;
}

interface FilesystemRoot {
  name: string;
  path: string;
}

// ========================================
// Folder Browser - Modern folder picker modal
// ========================================

interface FolderBrowserProps {
  isOpen: boolean;
  currentPath: string;
  parentPath: string | null;
  directories: FilesystemEntry[];
  roots: FilesystemRoot[];
  folderType: 'audio' | 'video' | 'downloads';
  onNavigate: (path: string) => void;
  onSelect: (path: string, folderType: 'audio' | 'video' | 'downloads') => void;
  onCancel: () => void;
  isLoading: boolean;
}

const FolderBrowser: React.FC<FolderBrowserProps> = ({
  isOpen,
  currentPath,
  parentPath,
  directories,
  roots,
  folderType,
  onNavigate,
  onSelect,
  onCancel,
  isLoading,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedIndex(-1);
    }
  }, [isOpen]);

  // Parse current path into breadcrumb segments
  const breadcrumbs = useMemo(() => {
    if (!currentPath) return [];
    // Handle Windows paths (C:\folder\subfolder) and Unix paths (/folder/subfolder)
    const isWindows = currentPath.includes('\\') || /^[A-Z]:/i.test(currentPath);
    const separator = isWindows ? '\\' : '/';
    const parts = currentPath.split(separator).filter(Boolean);

    const crumbs: { name: string; path: string }[] = [];
    let accumulated = isWindows ? '' : '/';

    for (const part of parts) {
      accumulated = isWindows
        ? (accumulated ? `${accumulated}\\${part}` : `${part}\\`)
        : `${accumulated}${part}/`;
      crumbs.push({
        name: part,
        path: accumulated.replace(/[/\\]$/, '') || (isWindows ? `${part}\\` : '/'),
      });
    }

    return crumbs;
  }, [currentPath]);

  // Filter directories by search query
  const filteredDirectories = useMemo(() => {
    if (!searchQuery.trim()) return directories;
    const query = searchQuery.toLowerCase();
    return directories.filter(d => d.name.toLowerCase().includes(query));
  }, [directories, searchQuery]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filteredDirectories.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && filteredDirectories[selectedIndex]) {
        onNavigate(filteredDirectories[selectedIndex].path);
      }
    } else if (e.key === 'Backspace' && !searchQuery && parentPath) {
      e.preventDefault();
      onNavigate(parentPath);
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  if (!isOpen) return null;

  const folderTypeLabel = folderType === 'video' ? 'Video' : folderType === 'downloads' ? 'Download' : 'Music';
  const folderTypeIcon = folderType === 'video' ? <PlayIcon size={20} /> : folderType === 'downloads' ? <DownloadIcon size={20} /> : <MusicNoteIcon size={20} />;

  return (
    <div className="folder-browser-overlay" onClick={onCancel}>
      <div className="folder-browser-modal" onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
        {/* Header */}
        <div className="folder-browser-header">
          <div className="folder-browser-header-left">
            {folderTypeIcon}
            <h2>Select {folderTypeLabel} Folder</h2>
          </div>
          <button className="folder-browser-close" onClick={onCancel} title="Close">
            <CloseIcon size={20} />
          </button>
        </div>

        {/* Quick Access Roots */}
        {roots.length > 0 && (
          <div className="folder-browser-roots">
            {roots.map(root => (
              <button
                key={root.path}
                className={`folder-browser-root ${currentPath.startsWith(root.path) ? 'active' : ''}`}
                onClick={() => onNavigate(root.path)}
                title={root.path}
              >
                {root.name === 'Home' ? <HomeIcon size={16} /> : <FolderIcon size={16} />}
                <span>{root.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Breadcrumb Navigation */}
        <div className="folder-browser-breadcrumb">
          <button
            className="folder-browser-breadcrumb-item"
            onClick={() => roots[0] && onNavigate(roots[0].path)}
          >
            <HomeIcon size={14} />
          </button>
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={crumb.path}>
              <ChevronRightIcon size={14} className="folder-browser-breadcrumb-sep" />
              <button
                className={`folder-browser-breadcrumb-item ${index === breadcrumbs.length - 1 ? 'current' : ''}`}
                onClick={() => onNavigate(crumb.path)}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Search */}
        <div className="folder-browser-search">
          <SearchIcon size={16} />
          <input
            type="text"
            placeholder="Filter folders..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            autoFocus
          />
          {searchQuery && (
            <button className="folder-browser-search-clear" onClick={() => setSearchQuery('')}>
              <CloseIcon size={14} />
            </button>
          )}
        </div>

        {/* Directory List */}
        <div className="folder-browser-list">
          {isLoading ? (
            <div className="folder-browser-loading">
              <RefreshIcon size={24} className="spinning" />
              <span>Loading folders...</span>
            </div>
          ) : (
            <>
              {/* Parent directory */}
              {parentPath && (
                <button
                  className="folder-browser-item parent"
                  onClick={() => onNavigate(parentPath)}
                >
                  <FolderIcon size={20} />
                  <span className="folder-browser-item-name">..</span>
                  <span className="folder-browser-item-hint">Parent folder</span>
                </button>
              )}

              {/* Directories */}
              {filteredDirectories.length === 0 ? (
                <div className="folder-browser-empty">
                  {searchQuery ? (
                    <>
                      <SearchIcon size={32} />
                      <p>No folders match "{searchQuery}"</p>
                    </>
                  ) : (
                    <>
                      <FolderIcon size={32} />
                      <p>No subfolders in this directory</p>
                    </>
                  )}
                </div>
              ) : (
                filteredDirectories.map((entry, index) => (
                  <button
                    key={entry.path}
                    className={`folder-browser-item ${selectedIndex === index ? 'selected' : ''}`}
                    onClick={() => onNavigate(entry.path)}
                    onDoubleClick={() => onSelect(entry.path, folderType)}
                  >
                    <FolderIcon size={20} />
                    <span className="folder-browser-item-name">{entry.name}</span>
                    <ChevronRightIcon size={16} className="folder-browser-item-arrow" />
                  </button>
                ))
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="folder-browser-footer">
          <div className="folder-browser-selected">
            <FolderIcon size={16} />
            <span className="folder-browser-selected-path" title={currentPath}>
              {currentPath}
            </span>
          </div>
          <div className="folder-browser-actions">
            <button className="folder-browser-cancel-btn" onClick={onCancel}>
              Cancel
            </button>
            <button
              className="folder-browser-select-btn"
              onClick={() => onSelect(currentPath, folderType)}
            >
              Select Folder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ========================================
// Media Folder Card
// ========================================

interface MediaFolderCardProps {
  folder: MediaFolder;
  onRemove: () => void;
  onScan: () => void;
  onToggleWatch: () => void;
  isScanning: boolean;
}

const MediaFolderCard: React.FC<MediaFolderCardProps> = ({
  folder,
  onRemove,
  onScan,
  onToggleWatch,
  isScanning,
}) => {
  const lastScannedText = folder.lastScanned
    ? new Date(folder.lastScanned).toLocaleDateString()
    : 'Never';

  const isBusy = folder.isScanning || isScanning;

  const typeIcon = folder.type === 'video' ? (
    <PlayIcon size={20} />
  ) : folder.type === 'downloads' ? (
    <DownloadIcon size={20} />
  ) : (
    <MusicNoteIcon size={20} />
  );

  const typeLabel = folder.type === 'video' ? 'Video' : folder.type === 'downloads' ? 'Downloads' : 'Music';
  const itemLabel = folder.type === 'video' ? 'videos' : 'tracks';

  return (
    <div className={`media-library-card ${isBusy ? 'scanning' : ''}`}>
      <div className="media-library-icon" data-type={folder.type}>
        {typeIcon}
      </div>
      <div className="media-library-info">
        <div className="media-library-header">
          <h4>{folder.name}</h4>
          <span className={`media-library-type-badge ${folder.type}`}>{typeLabel}</span>
        </div>
        <p className="media-library-path">{folder.path}</p>
        <div className="media-library-meta">
          {folder.type !== 'downloads' && (
            <>
              <span>{folder.trackCount} {itemLabel}</span>
              <span className="meta-separator">•</span>
              <span>Scanned: {lastScannedText}</span>
            </>
          )}
          {folder.watchEnabled && (
            <>
              {folder.type !== 'downloads' && <span className="meta-separator">•</span>}
              <span className="watch-indicator">
                <ZapIcon size={12} />
                Auto-watch
              </span>
            </>
          )}
        </div>
      </div>
      <div className="media-library-actions">
        <button
          className={`media-library-action ${folder.watchEnabled ? 'active' : ''}`}
          onClick={onToggleWatch}
          disabled={isBusy}
          title={folder.watchEnabled ? 'Disable auto-watch' : 'Enable auto-watch'}
        >
          <ZapIcon size={16} />
        </button>
        {folder.type !== 'downloads' && (
          <button
            className="media-library-action"
            onClick={onScan}
            disabled={isBusy}
            title="Rescan folder"
          >
            <RefreshIcon size={16} className={isBusy ? 'spinning' : ''} />
          </button>
        )}
        <button
          className="media-library-action danger"
          onClick={onRemove}
          disabled={isBusy}
          title="Remove library"
        >
          <TrashIcon size={16} />
        </button>
      </div>
    </div>
  );
};

// ========================================
// Add Library Type Selector
// ========================================

interface AddLibraryMenuProps {
  isOpen: boolean;
  onSelect: (type: 'audio' | 'video' | 'downloads') => void;
  onClose: () => void;
  buttonRef: React.RefObject<HTMLButtonElement>;
}

const AddLibraryMenu: React.FC<AddLibraryMenuProps> = ({
  isOpen,
  onSelect,
  onClose,
  buttonRef,
}) => {
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, buttonRef]);

  if (!isOpen) return null;

  return (
    <div className="add-library-menu" ref={menuRef}>
      <button className="add-library-option" onClick={() => onSelect('audio')}>
        <MusicNoteIcon size={18} />
        <div className="add-library-option-text">
          <span className="add-library-option-title">Music Library</span>
          <span className="add-library-option-desc">MP3, FLAC, WAV, and other audio</span>
        </div>
      </button>
      <button className="add-library-option" onClick={() => onSelect('video')}>
        <PlayIcon size={18} />
        <div className="add-library-option-text">
          <span className="add-library-option-title">Video Library</span>
          <span className="add-library-option-desc">MP4, MKV, AVI, and other video</span>
        </div>
      </button>
      <button className="add-library-option" onClick={() => onSelect('downloads')}>
        <DownloadIcon size={18} />
        <div className="add-library-option-text">
          <span className="add-library-option-title">Downloads Folder</span>
          <span className="add-library-option-desc">Where downloaded content is saved</span>
        </div>
      </button>
    </div>
  );
};

// ========================================
// Storage Settings
// ========================================

export const StorageSettings: React.FC = () => {
  const { refreshMediaFolders } = useLibraryStore();

  // State for folder management - unified list
  const [allFolders, setAllFolders] = useState<MediaFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scanningFolderIds, setScanningFolderIds] = useState<Set<string>>(new Set());

  // Add library menu state
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addButtonRef = React.useRef<HTMLButtonElement>(null);

  // Folder browser state
  const [browserOpen, setBrowserOpen] = useState(false);
  const [browserType, setBrowserType] = useState<'audio' | 'video' | 'downloads'>('audio');
  const [browserPath, setBrowserPath] = useState('/');
  const [browserParentPath, setBrowserParentPath] = useState<string | null>(null);
  const [browserDirectories, setBrowserDirectories] = useState<FilesystemEntry[]>([]);
  const [browserRoots, setBrowserRoots] = useState<FilesystemRoot[]>([]);
  const [browserLoading, setBrowserLoading] = useState(false);

  // Load folders on mount
  useEffect(() => {
    loadFolders();
  }, []);

  // Debug: log when allFolders state changes
  useEffect(() => {
    console.log('[StorageSettings] allFolders state changed:', allFolders.length, allFolders);
  }, [allFolders]);

  const loadFolders = async () => {
    setIsLoading(true);
    try {
      // Fetch ALL folders without type filter first (to catch any with unknown types)
      const allRes = await window.api?.getMediaFolders?.();
      console.log('[StorageSettings] Raw all folders response:', JSON.stringify(allRes, null, 2));

      // Fetch all folder types and combine into a single list
      const [audioRes, videoRes, downloadsRes] = await Promise.all([
        window.api?.getMediaFolders?.('audio'),
        window.api?.getMediaFolders?.('video'),
        window.api?.getMediaFolders?.('downloads'),
      ]);

      console.log('[StorageSettings] Audio response:', JSON.stringify(audioRes, null, 2));
      console.log('[StorageSettings] Video response:', JSON.stringify(videoRes, null, 2));
      console.log('[StorageSettings] Downloads response:', JSON.stringify(downloadsRes, null, 2));

      const folders: MediaFolder[] = [
        ...(audioRes?.folders || []),
        ...(videoRes?.folders || []),
        ...(downloadsRes?.folders || []),
      ];

      console.log('[StorageSettings] Combined folders array:', folders.length, folders);

      // Check for folders that exist but weren't fetched by type
      const fetchedIds = new Set(folders.map(f => f.id));
      const missingFolders = (allRes?.folders || []).filter((f: MediaFolder) => !fetchedIds.has(f.id));

      if (missingFolders.length > 0) {
        console.warn('[StorageSettings] Found folders with unknown types:', missingFolders);
        // Include them anyway so user can see and remove them
        folders.push(...missingFolders);
      }

      // Sort: audio first, then video, then downloads, then unknown
      folders.sort((a, b) => {
        const typeOrder: Record<string, number> = { audio: 0, video: 1, downloads: 2 };
        return (typeOrder[a.type] ?? 3) - (typeOrder[b.type] ?? 3);
      });

      console.log('[StorageSettings] Final folders to render:', folders.length, folders.map(f => ({ id: f.id, path: f.path, type: f.type })));

      setAllFolders(folders);
    } catch (error) {
      console.error('Failed to load folders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Open folder browser
  const openBrowser = useCallback(async (type: 'audio' | 'video' | 'downloads') => {
    setBrowserType(type);
    setBrowserOpen(true);
    setBrowserLoading(true);

    try {
      // Fetch roots and initial browse in parallel
      const [rootsResult, browseResult] = await Promise.all([
        window.api?.getFilesystemRoots?.(),
        window.api?.browseFilesystem?.(),
      ]);

      // Set roots (drives on Windows, home/root on Unix)
      if (rootsResult?.roots) {
        setBrowserRoots(rootsResult.roots);
      }

      // Set initial directory
      const result = browseResult as BrowseResult | undefined;
      if (result) {
        setBrowserPath(result.currentPath);
        setBrowserParentPath(result.parentPath);
        setBrowserDirectories(result.directories || []);
      }
    } catch (error) {
      console.error('Failed to browse filesystem:', error);
    } finally {
      setBrowserLoading(false);
    }
  }, []);

  // Navigate in folder browser
  const navigateBrowser = useCallback(async (path: string) => {
    setBrowserLoading(true);
    try {
      const result = await window.api?.browseFilesystem?.(path) as BrowseResult | undefined;
      if (result) {
        setBrowserPath(result.currentPath);
        setBrowserParentPath(result.parentPath);
        setBrowserDirectories(result.directories || []);
      }
    } catch (error) {
      console.error('Failed to navigate:', error);
    } finally {
      setBrowserLoading(false);
    }
  }, []);

  // Scan folder
  const handleScanFolder = useCallback(async (folderId: string) => {
    setScanningFolderIds((prev) => new Set(prev).add(folderId));

    try {
      await window.api?.scanFolder?.(folderId);
      await loadFolders();
      refreshMediaFolders();
    } catch (error) {
      console.error('Failed to scan folder:', error);
    } finally {
      setScanningFolderIds((prev) => {
        const next = new Set(prev);
        next.delete(folderId);
        return next;
      });
    }
  }, [refreshMediaFolders]);

  // Select folder from browser
  const selectFolder = useCallback(async (path: string, folderType: 'audio' | 'video' | 'downloads') => {
    setBrowserOpen(false);

    try {
      // Extract folder name from path
      const name = path.split(/[/\\]/).pop() || 'Media';

      console.log('[StorageSettings] Adding folder:', { path, folderType, name });

      // Add folder via API
      const result = await window.api?.addMediaFolder?.(
        path,
        folderType,
        {
          name,
          watchEnabled: true, // Auto-watch by default
        }
      );

      console.log('[StorageSettings] Add folder result:', result);

      if (result?.folder) {
        // Refresh folders
        await loadFolders();

        // Trigger scan for audio/video folders
        if (folderType === 'audio' || folderType === 'video') {
          await handleScanFolder(result.folder.id);
        }

        // Update library-store media folder playlists
        refreshMediaFolders();

        const typeLabel = folderType === 'audio' ? 'Music' : folderType === 'video' ? 'Video' : 'Downloads';
        showSuccessToast(`${typeLabel} library added`);
      } else if (result?.error) {
        console.error('[StorageSettings] Failed to add folder:', result.error);
        showErrorToast(result.error);
      }
    } catch (error) {
      console.error('Failed to add folder:', error);
      showErrorToast('Failed to add library');
    }
  }, [refreshMediaFolders, handleScanFolder]);

  // Remove folder
  const handleRemoveFolder = useCallback(async (folderId: string) => {
    try {
      const result = await window.api?.removeMediaFolder?.(folderId);
      if (result?.success !== false) {
        await loadFolders();
        refreshMediaFolders();
        showSuccessToast('Library removed');
      } else {
        showErrorToast(result?.error || 'Failed to remove library');
      }
    } catch (error) {
      console.error('Failed to remove folder:', error);
      showErrorToast('Failed to remove library');
    }
  }, [refreshMediaFolders]);

  // Toggle watch
  const handleToggleWatch = useCallback(async (folder: MediaFolder) => {
    try {
      await window.api?.updateMediaFolder?.(folder.id, {
        watchEnabled: !folder.watchEnabled,
      });
      await loadFolders();
    } catch (error) {
      console.error('Failed to toggle watch:', error);
    }
  }, []);

  // Handle add library menu selection
  const handleAddLibraryType = useCallback((type: 'audio' | 'video' | 'downloads') => {
    setAddMenuOpen(false);
    openBrowser(type);
  }, [openBrowser]);

  if (isLoading) {
    return (
      <div className="storage-settings">
        <div className="storage-loading">
          <RefreshIcon size={24} className="spinning" />
          <span>Loading libraries...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="storage-settings">
      {/* Unified Media Libraries Section */}
      <div className="media-libraries-section">
        <div className="media-libraries-header">
          <div className="media-libraries-title-area">
            <h2 className="media-libraries-title">
              <FolderIcon size={22} />
              Media Libraries
            </h2>
            <p className="media-libraries-description">
              Manage your music, video, and download folders. Audiio will index your local media for seamless playback.
            </p>
          </div>
          <div className="media-libraries-add-wrapper">
            <button
              ref={addButtonRef}
              className="media-libraries-add-btn"
              onClick={() => setAddMenuOpen(!addMenuOpen)}
            >
              <AddIcon size={18} />
              <span>Add Library</span>
              <ChevronRightIcon size={14} className={`add-chevron ${addMenuOpen ? 'open' : ''}`} />
            </button>
            <AddLibraryMenu
              isOpen={addMenuOpen}
              onSelect={handleAddLibraryType}
              onClose={() => setAddMenuOpen(false)}
              buttonRef={addButtonRef}
            />
          </div>
        </div>

        {allFolders.length === 0 ? (
          <div className="media-libraries-empty">
            <FolderIcon size={48} />
            <h3>No libraries added</h3>
            <p>Add your music, video, or download folders to get started</p>
            <button className="media-libraries-empty-btn" onClick={() => setAddMenuOpen(true)}>
              <AddIcon size={18} />
              Add Your First Library
            </button>
          </div>
        ) : (
          <div className="media-libraries-list">
            {allFolders.map((folder) => (
              <MediaFolderCard
                key={folder.id}
                folder={folder}
                onRemove={() => handleRemoveFolder(folder.id)}
                onScan={() => handleScanFolder(folder.id)}
                onToggleWatch={() => handleToggleWatch(folder)}
                isScanning={scanningFolderIds.has(folder.id)}
              />
            ))}
          </div>
        )}

        {/* Quick stats */}
        {allFolders.length > 0 && (
          <div className="media-libraries-stats">
            <div className="media-stat">
              <MusicNoteIcon size={16} />
              <span>{allFolders.filter(f => f.type === 'audio').length} music</span>
            </div>
            <div className="media-stat">
              <PlayIcon size={16} />
              <span>{allFolders.filter(f => f.type === 'video').length} video</span>
            </div>
            <div className="media-stat">
              <DownloadIcon size={16} />
              <span>{allFolders.filter(f => f.type === 'downloads').length} downloads</span>
            </div>
          </div>
        )}

        {/* Note about default downloads */}
        {allFolders.filter(f => f.type === 'downloads').length === 0 && (
          <div className="media-libraries-note">
            <DownloadIcon size={16} />
            <span>
              Downloads will be saved to the default location in your app data folder.
              Add a custom downloads folder above to save to a specific location.
            </span>
          </div>
        )}
      </div>

      {/* Folder Browser Modal */}
      <FolderBrowser
        isOpen={browserOpen}
        currentPath={browserPath}
        parentPath={browserParentPath}
        directories={browserDirectories}
        roots={browserRoots}
        folderType={browserType}
        onNavigate={navigateBrowser}
        onSelect={selectFolder}
        onCancel={() => setBrowserOpen(false)}
        isLoading={browserLoading}
      />
    </div>
  );
};

export default StorageSettings;
