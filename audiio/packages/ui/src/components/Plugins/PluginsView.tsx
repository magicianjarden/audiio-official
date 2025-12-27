import React, { useState } from 'react';
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
import {
  PluginIcon,
  AddIcon,
  ChevronRightIcon,
  DragHandleIcon,
} from '@audiio/icons';

const categoryLabels: Record<PluginCategory, string> = {
  metadata: 'Metadata',
  streaming: 'Streaming',
  lyrics: 'Lyrics',
  translation: 'Translation',
  scrobbling: 'Scrobbling',
  analysis: 'Analysis',
  other: 'Other',
};

const categoryColors: Record<PluginCategory, string> = {
  metadata: 'var(--color-access-metadata)',
  streaming: 'var(--color-access-streaming)',
  lyrics: 'var(--color-access-lyrics)',
  translation: 'var(--color-access-translation, var(--color-access-lyrics))',
  scrobbling: 'var(--color-access-scrobbling)',
  analysis: 'var(--color-access-analysis, var(--color-access-metadata))',
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

export const PluginsView: React.FC = () => {
  const { plugins, togglePlugin, getOrderedPlugins, pluginOrder, setPluginOrder } = usePluginStore();
  const { openPlugin } = useNavigationStore();
  const [filter, setFilter] = useState<'all' | 'installed' | 'available'>('all');

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
  const availablePlugins = orderedPlugins.filter(p => !p.installed);

  const filteredPlugins = filter === 'all'
    ? orderedPlugins
    : filter === 'installed'
      ? installedPlugins
      : availablePlugins;

  const enabledCount = plugins.filter(p => p.enabled).length;

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

  // Only allow dragging in 'all' or 'installed' view (installed plugins)
  const isDraggable = filter !== 'available';

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

      <div className="plugins-priority-hint">
        <span>Drag plugins to set priority order. Higher position = higher priority (tried first).</span>
      </div>

      <div className="plugins-filters">
        <button
          className={`plugins-filter ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({plugins.length})
        </button>
        <button
          className={`plugins-filter ${filter === 'installed' ? 'active' : ''}`}
          onClick={() => setFilter('installed')}
        >
          Installed ({installedPlugins.length})
        </button>
        <button
          className={`plugins-filter ${filter === 'available' ? 'active' : ''}`}
          onClick={() => setFilter('available')}
        >
          Available ({availablePlugins.length})
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={filteredPlugins.map(p => p.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="plugins-list">
            {filteredPlugins.length === 0 ? (
              <div className="plugins-empty">
                <PluginIcon size={48} />
                <h3>No plugins found</h3>
                <p>
                  {filter === 'available'
                    ? 'All available plugins are already installed'
                    : 'No plugins match your current filter'}
                </p>
              </div>
            ) : (
              filteredPlugins.map((plugin, index) => (
                <SortablePluginCard
                  key={plugin.id}
                  plugin={plugin}
                  index={pluginOrder.indexOf(plugin.id)}
                  onClick={() => openPlugin(plugin.id)}
                  onToggle={() => togglePlugin(plugin.id)}
                  isDraggable={isDraggable && plugin.installed}
                />
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>

      <div className="plugins-add-section">
        <button className="plugins-add-button">
          <AddIcon size={20} />
          <span>Add Plugin from URL</span>
        </button>
      </div>
    </div>
  );
};
