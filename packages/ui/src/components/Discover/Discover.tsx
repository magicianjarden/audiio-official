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
  const totalListens = useRecommendationStore((s) => s.userProfile.totalListens);
  const likedTracksCount = useLibraryStore((s) => s.likedTracks.length);
  const playlistCount = useLibraryStore((s) => s.playlists.length);
  const hasCapability = usePluginStore((s) => s.hasCapability);

  // Track recently shown sections for variety - use ref to avoid triggering re-renders
  const recentSectionsRef = React.useRef<SectionType[]>([]);
  const [selectedSections, setSelectedSections] = useState<SectionConfig[]>([]);

  // Check for lyrics capability (any lyrics provider)
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

  // Show ALL sections - only run once on mount and when key data changes
  useEffect(() => {
    const sections = sectionRegistry.getAllSectionConfigs(selectionContext);
    setSelectedSections(sections);

    // Update recent sections ref (doesn't trigger re-render)
    recentSectionsRef.current = [...sections.map((s) => s.type), ...recentSectionsRef.current].slice(0, 20);
  }, [totalListens, likedTracksCount]); // Only re-run when these key metrics change

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

  // Generate smart contextual greeting based on time and user data
  const getContextualGreeting = useMemo(() => {
    const hour = new Date().getHours();
    const dayOfWeek = new Date().getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const topGenres = selectionContext.topGenres;
    const topArtists = selectionContext.topArtists;
    const listensCount = totalListens || 0; // Use subscribed primitive value

    // Time-based base greeting
    let timeContext = '';
    if (hour >= 5 && hour < 12) {
      timeContext = isWeekend ? 'Lazy morning' : 'Morning';
    } else if (hour >= 12 && hour < 17) {
      timeContext = 'Afternoon';
    } else if (hour >= 17 && hour < 21) {
      timeContext = isWeekend ? 'Weekend vibes' : 'Evening';
    } else {
      timeContext = 'Late night';
    }

    // Context-aware suffix based on user data
    const contextPhrases: string[] = [];

    if (topGenres.length > 0) {
      const genre = topGenres[0].toLowerCase();
      contextPhrases.push(`Your ${genre} mood continues`);
      contextPhrases.push(`More ${genre} for you`);
      contextPhrases.push(`Curated with your love for ${genre}`);
    }

    if (topArtists.length > 0) {
      const artist = topArtists[0];
      contextPhrases.push(`Because you love ${artist}`);
      contextPhrases.push(`Inspired by your ${artist} plays`);
    }

    if (listensCount > 100) {
      contextPhrases.push(`Tailored from ${listensCount}+ listens`);
    }

    // Fallback generic phrases
    if (contextPhrases.length === 0) {
      contextPhrases.push('Fresh picks for you');
      contextPhrases.push('Discover something new');
      contextPhrases.push('Music curated for you');
    }

    // Pick a semi-random phrase based on the day
    const phraseIndex = dayOfWeek % contextPhrases.length;
    const contextPhrase = contextPhrases[phraseIndex];

    return { timeContext, contextPhrase };
  }, [selectionContext.topGenres, selectionContext.topArtists, totalListens]);

  return (
    <div className="discover">
      {/* Minimal contextual greeting - flows into content */}
      <header className="discover-header">
        <span className="discover-greeting-time">{getContextualGreeting.timeContext}</span>
        <span className="discover-greeting-context">{getContextualGreeting.contextPhrase}</span>
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
        whyExplanation={config.whyExplanation}
        context={context}
        onSeeAll={onSeeAll}
      />
    </div>
  );
};

export default Discover;
