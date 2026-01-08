/**
 * Section Definitions - Register sections with the SectionRegistry
 * Includes Hero, TrendingTracks, and 5 new discovery sections
 */

import { sectionRegistry, type SectionDefinition } from './section-registry';
import {
  HeroSection,
  TrendingTracksSection,
  BecauseYouLikedSection,
  NewReleasesSection,
  MoodRingSection,
  HiddenGemsSection,
  QuickPickSection,
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
// Because You Liked Section Definition
// ============================================

const becauseYouLikedSectionDef: SectionDefinition = {
  type: 'because-you-like',
  component: BecauseYouLikedSection as React.ComponentType<any>,
  displayName: 'Because You Liked',
  description: 'Recommendations based on tracks you love',
  requirements: {
    minLikedTracks: 1,
  },
  constraints: {
    maxPerPage: 2,
    preferredPosition: 'middle',
    cooldownSections: 3,
  },
  weights: {
    base: 85,
    personalizedBoost: 15,
  },
  generateConfig: (ctx) => ({
    title: 'Because you liked',
    isPersonalized: true,
    whyExplanation: 'Based on your liked tracks',
  }),
};

// ============================================
// New Releases Section Definition
// ============================================

const newReleasesSectionDef: SectionDefinition = {
  type: 'new-releases',
  component: NewReleasesSection as React.ComponentType<any>,
  displayName: 'New Releases',
  description: 'Fresh drops from this week',
  requirements: {},
  constraints: {
    maxPerPage: 1,
    preferredPosition: 'middle',
  },
  weights: {
    base: 80,
    personalizedBoost: 5,
    newUserBoost: 15,
  },
  generateConfig: () => ({
    title: 'New Releases',
    subtitle: 'Fresh drops this week',
    isPersonalized: false,
  }),
};

// ============================================
// Mood Ring Section Definition
// ============================================

const moodRingSectionDef: SectionDefinition = {
  type: 'mood-gradient',
  component: MoodRingSection as React.ComponentType<any>,
  displayName: 'Mood Ring',
  description: 'Match your vibe with mood-based discovery',
  requirements: {},
  constraints: {
    maxPerPage: 1,
    preferredPosition: 'middle',
  },
  weights: {
    base: 75,
    personalizedBoost: 10,
    timeRelevance: (hour) => {
      // Boost in evening hours when mood exploration is common
      if (hour >= 18 || hour <= 2) return 10;
      return 0;
    },
  },
  generateConfig: () => ({
    title: 'Mood Ring',
    subtitle: 'Match your vibe',
    isPersonalized: true,
  }),
};

// ============================================
// Hidden Gems Section Definition
// ============================================

const hiddenGemsSectionDef: SectionDefinition = {
  type: 'deep-cuts',
  component: HiddenGemsSection as React.ComponentType<any>,
  displayName: 'Hidden Gems',
  description: 'Underrated tracks worth discovering',
  requirements: {},
  constraints: {
    maxPerPage: 1,
    preferredPosition: 'middle',
  },
  weights: {
    base: 70,
    personalizedBoost: 10,
  },
  generateConfig: (ctx) => ({
    title: 'Hidden Gems',
    subtitle: ctx.isNewUser
      ? 'Discover underrated tracks'
      : 'Underrated tracks you might love',
    isPersonalized: !ctx.isNewUser,
    whyExplanation: 'Low play count, high quality',
  }),
};

// ============================================
// Quick Pick Section Definition
// ============================================

const quickPickSectionDef: SectionDefinition = {
  type: 'quick-picks',
  component: QuickPickSection as React.ComponentType<any>,
  displayName: 'Quick Pick',
  description: 'Swipe to discover new music fast',
  requirements: {},
  constraints: {
    maxPerPage: 1,
    preferredPosition: 'bottom',
  },
  weights: {
    base: 65,
    personalizedBoost: 5,
    newUserBoost: 20, // Great for new users to build preferences
  },
  generateConfig: () => ({
    title: 'Quick Pick',
    subtitle: 'Swipe to discover',
    isPersonalized: true,
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

  // Primary sections
  sectionRegistry.register(heroSectionDef);
  sectionRegistry.register(trendingTracksSectionDef);

  // New discovery sections
  sectionRegistry.register(becauseYouLikedSectionDef);
  sectionRegistry.register(newReleasesSectionDef);
  sectionRegistry.register(moodRingSectionDef);
  sectionRegistry.register(hiddenGemsSectionDef);
  sectionRegistry.register(quickPickSectionDef);

  sectionsRegistered = true;
  console.log('[SectionRegistry] Registered', sectionRegistry.getAll().length, 'sections');
}

export default registerAllSections;
