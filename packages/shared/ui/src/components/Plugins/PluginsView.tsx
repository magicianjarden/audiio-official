import React, { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { usePluginStore, type Plugin, type PluginCategory } from '../../stores/plugin-store';
import { useNavigationStore } from '../../stores/navigation-store';
import { useSettingsStore } from '../../stores/settings-store';
import {
  PluginIcon,
  AddIcon,
  ChevronRightIcon,
  DragHandleIcon,
  RefreshIcon,
  TrashIcon,
  DownloadIcon,
  SearchIcon,
  SettingsIcon,
  CheckIcon,
  CloseIcon,
  FolderIcon,
} from '@audiio/icons';

// Tab types
type PluginTab = 'installed' | 'browse' | 'updates' | 'repositories';

// Repository plugin from remote registry
interface RepositoryPlugin {
  id: string;
  name: string;
  version: string;
  roles: string[];
  description: string;
  author: string;
  downloadUrl: string;
  icon?: string;
  homepage?: string;
}

// Repository info
interface Repository {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  lastUpdated?: number;
  pluginCount?: number;
}

// Update info
interface UpdateInfo {
  pluginId: string;
  currentVersion: string;
  latestVersion: string;
  repositoryId: string;
}

const categoryLabels: Record<PluginCategory, string> = {
  metadata: 'Metadata',
  streaming: 'Streaming',
  lyrics: 'Lyrics',
  translation: 'Translation',
  scrobbling: 'Scrobbling',
  analysis: 'Analysis',
  audio: 'Audio',
  tool: 'Tool',
  other: 'Other',
};

const categoryColors: Record<PluginCategory, string> = {
  metadata: 'var(--color-access-metadata)',
  streaming: 'var(--color-access-streaming)',
  lyrics: 'var(--color-access-lyrics)',
  translation: 'var(--color-access-translation, var(--color-access-lyrics))',
  scrobbling: 'var(--color-access-scrobbling)',
  analysis: 'var(--color-access-analysis, var(--color-access-metadata))',
  audio: 'var(--color-access-audio, var(--color-access-streaming))',
  tool: 'var(--color-access-tool, var(--color-primary))',
  other: 'var(--color-access-other)',
};

interface PluginCardProps {
  plugin: Plugin;
  index: number;
  onClick: () => void;
  onToggle: () => void;
  isDraggable?: boolean;
}

const SortablePluginCard: React.FC<PluginCardProps> = ({ plugin, index, onClick, onToggle, isDraggable = true }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: plugin.id, disabled: !isDraggable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`plugin-card ${isDragging ? 'dragging' : ''}`}
      onClick={onClick}
    >
      {isDraggable && (
        <div
          className="plugin-card-drag-handle"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <DragHandleIcon size={20} />
          <span className="plugin-card-priority">{index + 1}</span>
        </div>
      )}
      <div className="plugin-card-icon" style={{ background: categoryColors[plugin.category] }}>
        {plugin.icon ? (
          <img src={plugin.icon} alt={plugin.name} />
        ) : (
          <PluginIcon size={28} />
        )}
      </div>
      <div className="plugin-card-info">
        <div className="plugin-card-header">
          <h3 className="plugin-card-name">{plugin.name}</h3>
          <span className="plugin-card-version">v{plugin.version}</span>
        </div>
        <p className="plugin-card-description">{plugin.description}</p>
        <div className="plugin-card-meta">
          <span className="plugin-card-category" style={{ color: categoryColors[plugin.category] }}>
            {categoryLabels[plugin.category]}
          </span>
          <span className="plugin-card-author">by {plugin.author}</span>
        </div>
      </div>
      <div className="plugin-card-actions">
        <label className="plugin-toggle" onClick={handleToggleClick}>
          <input
            type="checkbox"
            checked={plugin.enabled}
            readOnly
            disabled={!plugin.installed}
          />
          <span className="plugin-toggle-slider"></span>
        </label>
        <ChevronRightIcon size={20} className="plugin-card-arrow" />
      </div>
    </div>
  );
};

// Browse plugin card (from repository)
interface BrowsePluginCardProps {
  plugin: RepositoryPlugin;
  isInstalled: boolean;
  isInstalling: boolean;
  onInstall: () => void;
}

const BrowsePluginCard: React.FC<BrowsePluginCardProps> = ({ plugin, isInstalled, isInstalling, onInstall }) => {
  const roleToCategory = (roles: string[]): PluginCategory => {
    if (roles.includes('tool')) return 'tool';
    if (roles.includes('metadata-provider')) return 'metadata';
    if (roles.includes('stream-provider')) return 'streaming';
    if (roles.includes('lyrics-provider')) return 'lyrics';
    if (roles.includes('scrobbler')) return 'scrobbling';
    if (roles.includes('audio-processor')) return 'audio';
    return 'other';
  };

  const category = roleToCategory(plugin.roles);

  return (
    <div className="plugin-card browse-plugin-card">
      <div className="plugin-card-icon" style={{ background: categoryColors[category] }}>
        {plugin.icon ? (
          <img src={plugin.icon} alt={plugin.name} />
        ) : (
          <PluginIcon size={28} />
        )}
      </div>
      <div className="plugin-card-info">
        <div className="plugin-card-header">
          <h3 className="plugin-card-name">{plugin.name}</h3>
          <span className="plugin-card-version">v{plugin.version}</span>
        </div>
        <p className="plugin-card-description">{plugin.description}</p>
        <div className="plugin-card-meta">
          <span className="plugin-card-category" style={{ color: categoryColors[category] }}>
            {categoryLabels[category]}
          </span>
          <span className="plugin-card-author">by {plugin.author}</span>
        </div>
      </div>
      <div className="plugin-card-actions">
        {isInstalled ? (
          <span className="plugin-installed-badge">
            <CheckIcon size={16} />
            Installed
          </span>
        ) : (
          <button
            className="plugin-install-button"
            onClick={onInstall}
            disabled={isInstalling}
          >
            {isInstalling ? (
              <RefreshIcon size={16} className="spinning" />
            ) : (
              <DownloadIcon size={16} />
            )}
            {isInstalling ? 'Installing...' : 'Install'}
          </button>
        )}
      </div>
    </div>
  );
};

// Update card
interface UpdateCardProps {
  update: UpdateInfo;
  pluginName: string;
  onUpdate: () => void;
  isUpdating: boolean;
}

const UpdateCard: React.FC<UpdateCardProps> = ({ update, pluginName, onUpdate, isUpdating }) => {
  return (
    <div className="plugin-card update-card">
      <div className="plugin-card-icon" style={{ background: 'var(--color-primary)' }}>
        <PluginIcon size={28} />
      </div>
      <div className="plugin-card-info">
        <div className="plugin-card-header">
          <h3 className="plugin-card-name">{pluginName}</h3>
        </div>
        <p className="plugin-card-description">
          Update available: v{update.currentVersion} → v{update.latestVersion}
        </p>
      </div>
      <div className="plugin-card-actions">
        <button
          className="plugin-update-button"
          onClick={onUpdate}
          disabled={isUpdating}
        >
          {isUpdating ? (
            <RefreshIcon size={16} className="spinning" />
          ) : (
            <DownloadIcon size={16} />
          )}
          {isUpdating ? 'Updating...' : 'Update'}
        </button>
      </div>
    </div>
  );
};

// Repository card
interface RepositoryCardProps {
  repo: Repository;
  onRemove: () => void;
  onToggle: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

const RepositoryCard: React.FC<RepositoryCardProps> = ({ repo, onRemove, onToggle, onRefresh, isRefreshing }) => {
  return (
    <div className={`repository-card ${!repo.enabled ? 'disabled' : ''}`}>
      <div className="repository-info">
        <h4 className="repository-name">{repo.name}</h4>
        <p className="repository-url">{repo.url}</p>
        <div className="repository-meta">
          <span>{repo.pluginCount || 0} plugins</span>
          {repo.lastUpdated && (
            <span>Updated {new Date(repo.lastUpdated).toLocaleDateString()}</span>
          )}
        </div>
      </div>
      <div className="repository-actions">
        <label className="plugin-toggle" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
          <input type="checkbox" checked={repo.enabled} readOnly />
          <span className="plugin-toggle-slider"></span>
        </label>
        <button className="repository-action-btn" onClick={onRefresh} disabled={isRefreshing}>
          <RefreshIcon size={18} className={isRefreshing ? 'spinning' : ''} />
        </button>
        <button className="repository-action-btn danger" onClick={onRemove}>
          <TrashIcon size={18} />
        </button>
      </div>
    </div>
  );
};

// Add Repository Modal
interface AddRepositoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (url: string) => Promise<void>;
}

const AddRepositoryModal: React.FC<AddRepositoryModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [url, setUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsAdding(true);
    setError(null);

    try {
      await onAdd(url.trim());
      setUrl('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add repository');
    } finally {
      setIsAdding(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add Plugin Repository</h3>
          <button className="modal-close" onClick={onClose}>
            <CloseIcon size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p className="modal-description">
              Enter the URL to a plugin repository's registry.json file.
            </p>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/registry.json"
              className="modal-input"
              autoFocus
            />
            {error && <p className="modal-error">{error}</p>}
          </div>
          <div className="modal-footer">
            <button type="button" className="modal-btn secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="modal-btn primary" disabled={isAdding || !url.trim()}>
              {isAdding ? 'Adding...' : 'Add Repository'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Install from URL Modal
interface InstallFromURLModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInstall: (url: string) => Promise<void>;
}

const InstallFromURLModal: React.FC<InstallFromURLModalProps> = ({ isOpen, onClose, onInstall }) => {
  const [url, setUrl] = useState('');
  const [isInstalling, setIsInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsInstalling(true);
    setError(null);

    try {
      await onInstall(url.trim());
      setUrl('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to install plugin');
    } finally {
      setIsInstalling(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Install Plugin from URL</h3>
          <button className="modal-close" onClick={onClose}>
            <CloseIcon size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p className="modal-description">
              Enter a plugin source URL. Supported formats:
            </p>
            <ul className="modal-list">
              <li><code>npm:@audiio/plugin-name</code></li>
              <li><code>https://github.com/user/repo</code></li>
              <li><code>git:https://github.com/user/repo.git</code></li>
            </ul>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="npm:@audiio/plugin-example"
              className="modal-input"
              autoFocus
            />
            {error && <p className="modal-error">{error}</p>}
          </div>
          <div className="modal-footer">
            <button type="button" className="modal-btn secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="modal-btn primary" disabled={isInstalling || !url.trim()}>
              {isInstalling ? 'Installing...' : 'Install Plugin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const PluginsView: React.FC = () => {
  const { plugins, togglePlugin, getOrderedPlugins, pluginOrder, setPluginOrder, syncFromBackend } = usePluginStore();
  const { openPlugin } = useNavigationStore();
  const { pluginFolder, setPluginFolder } = useSettingsStore();

  // Sync installed plugins from backend on mount and when plugins change
  useEffect(() => {
    syncFromBackend();

    // Listen for plugin changes from main process
    const cleanup = window.api?.repositories?.onPluginsChanged?.(() => {
      console.log('[PluginsView] Plugins changed, syncing...');
      syncFromBackend();
    });

    return () => {
      cleanup?.();
    };
  }, [syncFromBackend]);

  // Plugin folder notification
  const [pluginNotification, setPluginNotification] = useState<string | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<PluginTab>('installed');

  // Browse state
  const [browsePlugins, setBrowsePlugins] = useState<RepositoryPlugin[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingBrowse, setIsLoadingBrowse] = useState(false);

  // Updates state
  const [updates, setUpdates] = useState<UpdateInfo[]>([]);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);

  // Repositories state
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [refreshingRepoId, setRefreshingRepoId] = useState<string | null>(null);

  // Install state
  const [installingPluginId, setInstallingPluginId] = useState<string | null>(null);
  const [updatingPluginId, setUpdatingPluginId] = useState<string | null>(null);

  // Modal state
  const [showAddRepoModal, setShowAddRepoModal] = useState(false);
  const [showInstallURLModal, setShowInstallURLModal] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const orderedPlugins = getOrderedPlugins();
  const installedPlugins = orderedPlugins.filter(p => p.installed);
  const installedPluginIds = new Set(installedPlugins.map(p => p.id));

  const enabledCount = plugins.filter(p => p.enabled).length;

  // Browse for plugin folder
  const handleBrowsePluginFolder = useCallback(async () => {
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
      console.log('[PluginsView] Plugin detected:', data.filename);

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

  // Load repositories
  const loadRepositories = useCallback(async () => {
    if (!window.api?.repositories?.list) return;
    setIsLoadingRepos(true);
    try {
      const repos = await window.api.repositories.list();
      setRepositories(repos);
    } catch (err) {
      console.error('Failed to load repositories:', err);
    } finally {
      setIsLoadingRepos(false);
    }
  }, []);

  // Load browse plugins
  const loadBrowsePlugins = useCallback(async () => {
    if (!window.api?.repositories?.getAvailablePlugins) return;
    setIsLoadingBrowse(true);
    try {
      const plugins = await window.api.repositories.getAvailablePlugins();
      setBrowsePlugins(plugins);
    } catch (err) {
      console.error('Failed to load browse plugins:', err);
    } finally {
      setIsLoadingBrowse(false);
    }
  }, []);

  // Check for updates
  const checkForUpdates = useCallback(async () => {
    if (!window.api?.repositories?.checkUpdates) return;
    setIsCheckingUpdates(true);
    try {
      const updateList = await window.api.repositories.checkUpdates();
      setUpdates(updateList);
    } catch (err) {
      console.error('Failed to check updates:', err);
    } finally {
      setIsCheckingUpdates(false);
    }
  }, []);

  // Load data when tab changes
  useEffect(() => {
    if (activeTab === 'browse') {
      loadBrowsePlugins();
    } else if (activeTab === 'updates') {
      checkForUpdates();
    } else if (activeTab === 'repositories') {
      loadRepositories();
    }
  }, [activeTab, loadBrowsePlugins, checkForUpdates, loadRepositories]);

  // Filter browse plugins by search
  const filteredBrowsePlugins = searchQuery
    ? browsePlugins.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.author.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : browsePlugins;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = pluginOrder.indexOf(String(active.id));
      const newIndex = pluginOrder.indexOf(String(over.id));

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(pluginOrder, oldIndex, newIndex);
        setPluginOrder(newOrder);
      }
    }
  };

  // Install plugin from repository
  const handleInstallPlugin = async (plugin: RepositoryPlugin) => {
    if (!window.api?.repositories?.installFromSource) return;

    setInstallingPluginId(plugin.id);
    try {
      const result = await window.api.repositories.installFromSource(plugin.downloadUrl);
      if (result.success) {
        // Reload plugins
        await window.api?.reloadPlugins?.();
        // Refresh the view
        loadBrowsePlugins();
      } else {
        console.error('Install failed:', result.error);
      }
    } catch (err) {
      console.error('Failed to install plugin:', err);
    } finally {
      setInstallingPluginId(null);
    }
  };

  // Install plugin from URL
  const handleInstallFromURL = async (url: string) => {
    if (!window.api?.repositories?.installFromSource) {
      throw new Error('Installation API not available');
    }

    const result = await window.api.repositories.installFromSource(url);
    if (!result.success) {
      throw new Error(result.error || 'Installation failed');
    }

    // Reload plugins
    await window.api?.reloadPlugins?.();
  };

  // Update plugin
  const handleUpdatePlugin = async (update: UpdateInfo) => {
    if (!window.api?.repositories?.updatePlugin) return;

    setUpdatingPluginId(update.pluginId);
    try {
      // Find the download URL for this plugin
      const plugin = browsePlugins.find(p => p.id === update.pluginId);
      if (!plugin) {
        console.error('Plugin not found in browse list');
        return;
      }

      const result = await window.api.repositories.updatePlugin(update.pluginId, plugin.downloadUrl);
      if (result.success) {
        // Refresh updates
        checkForUpdates();
      } else {
        console.error('Update failed:', result.error);
      }
    } catch (err) {
      console.error('Failed to update plugin:', err);
    } finally {
      setUpdatingPluginId(null);
    }
  };

  // Add repository
  const handleAddRepository = async (url: string) => {
    if (!window.api?.repositories?.add) {
      throw new Error('Repository API not available');
    }

    const result = await window.api.repositories.add(url);
    if (!result.success) {
      throw new Error(result.error || 'Failed to add repository');
    }

    // Refresh repositories
    loadRepositories();
  };

  // Remove repository
  const handleRemoveRepository = async (repoId: string) => {
    if (!window.api?.repositories?.remove) return;

    try {
      await window.api.repositories.remove(repoId);
      loadRepositories();
    } catch (err) {
      console.error('Failed to remove repository:', err);
    }
  };

  // Toggle repository
  const handleToggleRepository = async (repoId: string, enabled: boolean) => {
    if (!window.api?.repositories?.setEnabled) return;

    try {
      await window.api.repositories.setEnabled(repoId, enabled);
      loadRepositories();
    } catch (err) {
      console.error('Failed to toggle repository:', err);
    }
  };

  // Refresh repository
  const handleRefreshRepository = async (repoId: string) => {
    if (!window.api?.repositories?.refresh) return;

    setRefreshingRepoId(repoId);
    try {
      await window.api.repositories.refresh(repoId);
      loadRepositories();
    } catch (err) {
      console.error('Failed to refresh repository:', err);
    } finally {
      setRefreshingRepoId(null);
    }
  };

  // Get plugin name for update display
  const getPluginName = (pluginId: string): string => {
    const installed = plugins.find(p => p.id === pluginId);
    if (installed) return installed.name;
    const browse = browsePlugins.find(p => p.id === pluginId);
    if (browse) return browse.name;
    return pluginId;
  };

  return (
    <div className="plugins-view">
      <header className="plugins-header">
        <div className="plugins-header-icon">
          <PluginIcon size={64} />
        </div>
        <div className="plugins-header-info">
          <span className="plugins-header-type">Extensions</span>
          <h1 className="plugins-header-title">Plugins</h1>
          <span className="plugins-header-count">
            {enabledCount} enabled · {installedPlugins.length} installed
          </span>
        </div>
      </header>

      {/* Tabs */}
      <div className="plugins-tabs">
        <button
          className={`plugins-tab ${activeTab === 'installed' ? 'active' : ''}`}
          onClick={() => setActiveTab('installed')}
        >
          Installed
          <span className="plugins-tab-count">{installedPlugins.length}</span>
        </button>
        <button
          className={`plugins-tab ${activeTab === 'browse' ? 'active' : ''}`}
          onClick={() => setActiveTab('browse')}
        >
          Browse
        </button>
        <button
          className={`plugins-tab ${activeTab === 'updates' ? 'active' : ''}`}
          onClick={() => setActiveTab('updates')}
        >
          Updates
          {updates.length > 0 && (
            <span className="plugins-tab-badge">{updates.length}</span>
          )}
        </button>
        <button
          className={`plugins-tab ${activeTab === 'repositories' ? 'active' : ''}`}
          onClick={() => setActiveTab('repositories')}
        >
          <SettingsIcon size={16} />
          Repos
        </button>
      </div>

      {/* Installed Tab */}
      {activeTab === 'installed' && (
        <>
          <div className="plugins-priority-hint">
            <span>Drag plugins to set priority order. Higher position = higher priority (tried first).</span>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={installedPlugins.map(p => p.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="plugins-list">
                {installedPlugins.length === 0 ? (
                  <div className="plugins-empty">
                    <PluginIcon size={48} />
                    <h3>No plugins installed</h3>
                    <p>Browse available plugins or add a repository to get started.</p>
                    <button
                      className="plugins-empty-action"
                      onClick={() => setActiveTab('browse')}
                    >
                      Browse Plugins
                    </button>
                  </div>
                ) : (
                  installedPlugins.map((plugin) => (
                    <SortablePluginCard
                      key={plugin.id}
                      plugin={plugin}
                      index={pluginOrder.indexOf(plugin.id)}
                      onClick={() => openPlugin(plugin.id)}
                      onToggle={() => togglePlugin(plugin.id)}
                      isDraggable={true}
                    />
                  ))
                )}
              </div>
            </SortableContext>
          </DndContext>

          <div className="plugins-add-section">
            <button className="plugins-add-button" onClick={() => setShowInstallURLModal(true)}>
              <AddIcon size={20} />
              <span>Install from URL</span>
            </button>
          </div>

          {/* Plugin Folder Picker */}
          <div className="plugins-folder-section">
            <div className="plugins-folder-header">
              <FolderIcon size={18} />
              <span>Plugin Drop Folder</span>
            </div>
            <p className="plugins-folder-description">
              Drop <code>.audiio-plugin</code> files into this folder to install them automatically.
            </p>
            <div className="plugins-folder-input">
              <input
                type="text"
                value={pluginFolder || ''}
                placeholder="Select a folder for plugins"
                readOnly
              />
              <button className="plugins-folder-browse" onClick={handleBrowsePluginFolder}>
                <FolderIcon size={16} />
                <span>Browse</span>
              </button>
              {pluginFolder && (
                <button
                  className="plugins-folder-clear"
                  onClick={() => setPluginFolder(null)}
                  title="Clear folder"
                >
                  <CloseIcon size={14} />
                </button>
              )}
            </div>
            {pluginFolder && (
              <div className="plugins-folder-active">
                <CheckIcon size={14} />
                <span>Watching for new plugins</span>
              </div>
            )}
            {pluginNotification && (
              <div className={`plugins-folder-notification ${pluginNotification.startsWith('Failed') ? 'error' : 'success'}`}>
                {pluginNotification}
              </div>
            )}
          </div>
        </>
      )}

      {/* Browse Tab */}
      {activeTab === 'browse' && (
        <>
          <div className="plugins-search">
            <SearchIcon size={20} />
            <input
              type="text"
              placeholder="Search plugins..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button
              className="plugins-refresh-btn"
              onClick={loadBrowsePlugins}
              disabled={isLoadingBrowse}
            >
              <RefreshIcon size={18} className={isLoadingBrowse ? 'spinning' : ''} />
            </button>
          </div>

          <div className="plugins-list">
            {isLoadingBrowse ? (
              <div className="plugins-loading">
                <RefreshIcon size={32} className="spinning" />
                <p>Loading plugins...</p>
              </div>
            ) : filteredBrowsePlugins.length === 0 ? (
              <div className="plugins-empty">
                <PluginIcon size={48} />
                <h3>No plugins available</h3>
                <p>
                  {repositories.length === 0
                    ? 'Add a plugin repository to browse available plugins.'
                    : 'No plugins found matching your search.'}
                </p>
                {repositories.length === 0 && (
                  <button
                    className="plugins-empty-action"
                    onClick={() => setActiveTab('repositories')}
                  >
                    Add Repository
                  </button>
                )}
              </div>
            ) : (
              filteredBrowsePlugins.map((plugin) => (
                <BrowsePluginCard
                  key={plugin.id}
                  plugin={plugin}
                  isInstalled={installedPluginIds.has(plugin.id)}
                  isInstalling={installingPluginId === plugin.id}
                  onInstall={() => handleInstallPlugin(plugin)}
                />
              ))
            )}
          </div>
        </>
      )}

      {/* Updates Tab */}
      {activeTab === 'updates' && (
        <>
          <div className="plugins-updates-header">
            <button
              className="plugins-check-updates-btn"
              onClick={checkForUpdates}
              disabled={isCheckingUpdates}
            >
              <RefreshIcon size={18} className={isCheckingUpdates ? 'spinning' : ''} />
              {isCheckingUpdates ? 'Checking...' : 'Check for Updates'}
            </button>
          </div>

          <div className="plugins-list">
            {isCheckingUpdates ? (
              <div className="plugins-loading">
                <RefreshIcon size={32} className="spinning" />
                <p>Checking for updates...</p>
              </div>
            ) : updates.length === 0 ? (
              <div className="plugins-empty">
                <CheckIcon size={48} />
                <h3>All plugins up to date</h3>
                <p>No updates are available for your installed plugins.</p>
              </div>
            ) : (
              updates.map((update) => (
                <UpdateCard
                  key={update.pluginId}
                  update={update}
                  pluginName={getPluginName(update.pluginId)}
                  onUpdate={() => handleUpdatePlugin(update)}
                  isUpdating={updatingPluginId === update.pluginId}
                />
              ))
            )}
          </div>
        </>
      )}

      {/* Repositories Tab */}
      {activeTab === 'repositories' && (
        <>
          <div className="plugins-repos-header">
            <p className="plugins-repos-description">
              Plugin repositories provide collections of plugins you can browse and install.
              Add repositories by entering the URL to their registry.json file.
            </p>
            <button
              className="plugins-add-repo-btn"
              onClick={() => setShowAddRepoModal(true)}
            >
              <AddIcon size={18} />
              Add Repository
            </button>
          </div>

          <div className="repositories-list">
            {isLoadingRepos ? (
              <div className="plugins-loading">
                <RefreshIcon size={32} className="spinning" />
                <p>Loading repositories...</p>
              </div>
            ) : repositories.length === 0 ? (
              <div className="plugins-empty">
                <PluginIcon size={48} />
                <h3>No repositories added</h3>
                <p>Add a plugin repository to browse and install plugins.</p>
                <button
                  className="plugins-empty-action"
                  onClick={() => setShowAddRepoModal(true)}
                >
                  Add Repository
                </button>
              </div>
            ) : (
              repositories.map((repo) => (
                <RepositoryCard
                  key={repo.id}
                  repo={repo}
                  onRemove={() => handleRemoveRepository(repo.id)}
                  onToggle={() => handleToggleRepository(repo.id, !repo.enabled)}
                  onRefresh={() => handleRefreshRepository(repo.id)}
                  isRefreshing={refreshingRepoId === repo.id}
                />
              ))
            )}
          </div>
        </>
      )}

      {/* Modals */}
      <AddRepositoryModal
        isOpen={showAddRepoModal}
        onClose={() => setShowAddRepoModal(false)}
        onAdd={handleAddRepository}
      />
      <InstallFromURLModal
        isOpen={showInstallURLModal}
        onClose={() => setShowInstallURLModal(false)}
        onInstall={handleInstallFromURL}
      />
    </div>
  );
};
