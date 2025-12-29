/**
 * Discover - Main discovery page with adaptive section layout
 * Uses the SectionRegistry for dynamic section selection and rendering
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigationStore } from '../../stores/navigation-store';
import { useRecommendationStore } from '../../stores/recommendation-store';
import { useLibraryStore } from '../../stores/library-store';
import { usePluginStore } from '../../stores/plugin-store';
import { DiscoverySliderMini } from '../DiscoverySlider/DiscoverySlider';

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
  const { getTopGenres, getTopArtists, userProfile } = useRecommendationStore();
  const { likedTracks, playlists } = useLibraryStore();
  const { hasCapability } = usePluginStore();

  // Track recently shown sections for variety
  const [recentSections, setRecentSections] = useState<SectionType[]>([]);
  const [selectedSections, setSelectedSections] = useState<SectionConfig[]>([]);

  // Check for lyrics capability (any lyrics provider)
  const hasLyrics = hasCapability('lyrics-provider');

  // Create selection context
  const selectionContext = useMemo((): SelectionContext => {
    return createSelectionContext({
      userProfile,
      likedTracksCount: likedTracks.length,
      topArtists: getTopArtists(5),
      topGenres: getTopGenres(5),
      hasLyrics,
      hasPlaylists: playlists.length > 0,
      playlistCount: playlists.length,
      recentSections,
    });
  }, [userProfile, likedTracks.length, getTopArtists, getTopGenres, hasLyrics, playlists.length, recentSections]);

  // Select sections on mount and when context changes significantly
  useEffect(() => {
    // Increased from 8 to 12 sections for a fuller page
    const sections = sectionRegistry.selectSections(selectionContext, 12);
    setSelectedSections(sections);

    // Update recent sections for next selection
    setRecentSections((prev) => {
      const newRecent = [...sections.map((s) => s.type), ...prev].slice(0, 20);
      return newRecent;
    });
  }, [selectionContext.userProfile.totalListens, selectionContext.likedTracksCount]);

  const handleSeeAll = useCallback((config: SectionConfig) => {
    if (config.query) {
      openSectionDetail({
        title: config.title || 'Browse',
        subtitle: config.subtitle,
        query: config.query,
        type: config.type,
      });
    }
  }, [openSectionDetail]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="discover">
      {/* Hero Section with Greeting */}
      <header className="discover-hero">
        <div className="discover-hero-content">
          <h1 className="discover-greeting">{getGreeting()}</h1>
        </div>
        <DiscoverySliderMini className="discover-hero-slider" />
      </header>

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
        context={context}
        onSeeAll={onSeeAll}
      />
    </div>
  );
};

export default Discover;
