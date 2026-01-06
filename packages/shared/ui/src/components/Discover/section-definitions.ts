/**
 * Section Definitions - Register sections with the SectionRegistry
 * Simplified to only include Hero and TrendingTracks sections
 */

import { sectionRegistry, type SectionDefinition } from './section-registry';
import {
  HeroSection,
  TrendingTracksSection,
} from './sections';

// ============================================
// Hero Section Definition
// ============================================

const heroSectionDef: SectionDefinition = {
  type: 'hero',
  component: HeroSection as React.ComponentType<any>,
  displayName: 'Featured',
  description: 'Compact featured content with ambient background',
  requirements: {},
  constraints: {
    maxPerPage: 1,
    preferredPosition: 'top',
  },
  weights: {
    base: 100,
    personalizedBoost: 0,
  },
  generateConfig: (ctx) => {
    let subtitle = 'Discover something new';

    if (ctx.isNewUser) {
      subtitle = 'Popular tracks right now';
    } else if (ctx.topGenres.length > 0) {
      const genre = ctx.topGenres[0].toLowerCase();
      const phrases = [
        `Your ${genre} mood continues`,
        `Curated for your ${genre} taste`,
        `More ${genre} for you`,
      ];
      subtitle = phrases[new Date().getDay() % phrases.length];
    } else if (ctx.topArtists.length > 0) {
      subtitle = `Because you love ${ctx.topArtists[0]}`;
    }

    return {
      title: ctx.isNewUser ? 'Trending Now' : 'Made For You',
      subtitle,
      isPersonalized: !ctx.isNewUser,
    };
  },
};

// ============================================
// Trending Tracks Section Definition
// ============================================

const trendingTracksSectionDef: SectionDefinition = {
  type: 'trending-tracks',
  component: TrendingTracksSection as React.ComponentType<any>,
  displayName: 'Top Charts',
  description: 'What everyone is listening to',
  requirements: {},
  constraints: {
    maxPerPage: 1,
    preferredPosition: 'top',
  },
  weights: {
    base: 90,
    personalizedBoost: 0,
    newUserBoost: 10,
  },
  generateConfig: () => ({
    title: 'Top Charts',
    subtitle: 'What everyone is listening to',
    isPersonalized: false,
  }),
};

// ============================================
// Register All Sections
// ============================================

let sectionsRegistered = false;

export function registerAllSections(): void {
  if (sectionsRegistered) {
    return;
  }

  sectionRegistry.register(heroSectionDef);
  sectionRegistry.register(trendingTracksSectionDef);

  sectionsRegistered = true;
  console.log('[SectionRegistry] Registered', sectionRegistry.getAll().length, 'sections');
}

export default registerAllSections;
