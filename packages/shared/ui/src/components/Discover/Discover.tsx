/**
 * Discover - Main discovery page with adaptive section layout
 * Uses the SectionRegistry for dynamic section selection and rendering
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigationStore } from '../../stores/navigation-store';
import { useRecommendationStore } from '../../stores/recommendation-store';
import { useLibraryStore } from '../../stores/library-store';
import { usePluginStore } from '../../stores/plugin-store';

// Section registry imports
import {
  sectionRegistry,
  createSelectionContext,
  type SectionConfig,
  type SelectionContext,
  type SectionType,
} from './section-registry';
import { registerAllSections } from './section-definitions';

// Initialize section registry on module load
let registryInitialized = false;
if (!registryInitialized) {
  registerAllSections();
  registryInitialized = true;
}

export const Discover: React.FC = () => {
  const { openSectionDetail } = useNavigationStore();
  // Use getState() pattern for stable references - avoids re-renders from store updates
  const recStore = useRecommendationStore;

  // Subscribe only to specific primitive values we need - NOT the whole userProfile object
  // This prevents re-renders when any part of userProfile changes (e.g., on every listen event)
  const totalListens = useRecommendationStore((s) => s.userProfile?.totalListens ?? 0);
  const likedTracksCount = useLibraryStore((s) => s.likedTracks.length);
  const playlistCount = useLibraryStore((s) => s.playlists.length);
  // Subscribe to discovery layout from store
  const discoveryLayout = useRecommendationStore((s) => s.discoveryLayout);
  const fetchDiscoveryLayout = useRecommendationStore((s) => s.fetchDiscoveryLayout);

  // Track recently shown sections for variety - use ref to avoid triggering re-renders
  const recentSectionsRef = React.useRef<SectionType[]>([]);
  const [selectedSections, setSelectedSections] = useState<SectionConfig[]>([]);

  // Check for lyrics capability (any lyrics provider)
  const hasCapability = usePluginStore((s) => s.hasCapability);
  const hasLyrics = hasCapability('lyrics-provider');

  // Create selection context - only recalculate when key metrics change
  // Use getState() to get userProfile at computation time without subscribing to changes
  const selectionContext = useMemo((): SelectionContext => {
    const state = recStore.getState();
    return createSelectionContext({
      userProfile: state.userProfile, // Get at computation time, not via subscription
      likedTracksCount,
      topArtists: state.getTopArtists(5),
      topGenres: state.getTopGenres(5),
      hasLyrics,
      hasPlaylists: playlistCount > 0,
      playlistCount,
      recentSections: recentSectionsRef.current,
    });
  }, [totalListens, likedTracksCount, hasLyrics, playlistCount]); // Only primitive values

  // Fetch layout on mount
  useEffect(() => {
    fetchDiscoveryLayout();
  }, [fetchDiscoveryLayout]);

  // Update sections when layout or context changes
  useEffect(() => {
    if (discoveryLayout && discoveryLayout.length > 0) {
      // Use server-provided layout
      setSelectedSections(discoveryLayout);
    } else {
      // Fallback to client-side generation
      const sections = sectionRegistry.getAllSectionConfigs(selectionContext);
      setSelectedSections(sections);

      // Update recent sections ref
      recentSectionsRef.current = [...sections.map((s) => s.type), ...recentSectionsRef.current].slice(0, 20);
    }
  }, [discoveryLayout, totalListens, likedTracksCount, selectionContext]);

  const handleSeeAll = useCallback((config: SectionConfig) => {
    // Prefer structuredQuery for ML-aware "See All", fall back to legacy query
    if (config.structuredQuery || config.query) {
      openSectionDetail({
        title: config.title || 'Browse',
        subtitle: config.subtitle,
        type: config.type,
        query: config.query, // Legacy fallback
        structuredQuery: config.structuredQuery, // ML-aware query
      });
    }
  }, [openSectionDetail]);

  return (
    <div className="discover">
      {/* Dynamic Sections from Registry */}
      <div className="discover-sections">
        {selectedSections.map((sectionConfig, index) => (
          <DynamicSection
            key={sectionConfig.id}
            config={sectionConfig}
            context={selectionContext}
            index={index}
            onSeeAll={() => handleSeeAll(sectionConfig)}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * DynamicSection - Renders a section based on its config and registry definition
 */
interface DynamicSectionProps {
  config: SectionConfig;
  context: SelectionContext;
  index: number;
  onSeeAll?: () => void;
}

/**
 * Simple Error Boundary for individual sections
 */
class SectionErrorBoundary extends React.Component<
  { children: React.ReactNode; sectionType: string },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode; sectionType: string }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[Discover] Section "${this.props.sectionType}" crashed:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="discover-section-error">
          <p>This section couldn't load</p>
          <button onClick={() => this.setState({ hasError: false })}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const DynamicSection: React.FC<DynamicSectionProps> = ({
  config,
  context,
  index,
  onSeeAll,
}) => {
  const definition = sectionRegistry.get(config.type);

  if (!definition) {
    console.warn(`[Discover] Unknown section type: ${config.type}`);
    return null;
  }

  const SectionComponent = definition.component;

  return (
    <SectionErrorBoundary sectionType={config.type}>
      <div
        className="discover-section-wrapper"
        style={{ animationDelay: `${index * 100}ms` }}
      >
        <SectionComponent
          id={config.id}
          type={config.type}
          title={config.title}
          subtitle={config.subtitle}
          query={config.query}
          isPersonalized={config.isPersonalized}
          whyExplanation={config.whyExplanation}
          context={context}
          onSeeAll={onSeeAll}
        />
      </div>
    </SectionErrorBoundary>
  );
};

export default Discover;
