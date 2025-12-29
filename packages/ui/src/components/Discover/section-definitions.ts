/**
 * Section Definitions - Register all sections with the SectionRegistry
 * Defines requirements, constraints, and weights for adaptive selection
 *
 * Updated to focus on algorithmic content (trending, artist-based recommendations)
 * Removed: playlists, mixes, genres
 */

import { sectionRegistry, type SectionDefinition } from './section-registry';
import {
  // Primary sections
  HeroSection,
  HorizontalSection,
  EmbeddingHorizontalSection,
  LargeCardSection,
  EmbeddingLargeCardSection,
  CompactListSection,
  GridSection,
  // New algorithmic sections
  TrendingTracksSection,
  TrendingArtistsSection,
  ArtistRadioSection,
  BecauseYouLikeSection,
  NewReleasesSection,
  // New variety sections
  ChartListSection,
  QuickPicksSection,
  // Artist spotlight (kept)
  ArtistSpotlightSection,
  // Additional variety sections
  MoodGradientSection,
  GenreExplorerSection,
  WeeklyRotationSection,
  BannerSection,
  MasonrySection,
  MoodPlaylistSection,
  // New personalized sections
  TimeGreetingSection,
  OnRepeatSection,
  DiscoverWeeklySection,
  TopMixSection,
  RediscoverSection,
  ActivitySection,
  DecadeMixSection,
  SeasonalSection,
  BlindPicksSection,
  SimilarArtistsSection,
} from './sections';

// ============================================
// Primary Section Definitions
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
    base: 75,
    personalizedBoost: 15,
  },
  generateConfig: (ctx) => ({
    title: ctx.isNewUser ? 'Trending Now' : 'Made For You',
    subtitle: ctx.isNewUser ? 'Popular tracks right now' : 'Personalized mix based on your listening',
    query: ctx.isNewUser
      ? 'top hits 2024 trending'
      : `${ctx.topArtists[0] ?? ''} ${ctx.topGenres[0] ?? ''} similar`,
    isPersonalized: !ctx.isNewUser,
  }),
};

const compactListSectionDef: SectionDefinition = {
  type: 'compact-list',
  component: CompactListSection as React.ComponentType<any>,
  displayName: 'Jump Back In',
  description: 'Compact list for recently played tracks',
  requirements: {
    // Loosened: no longer requires history or minListens
  },
  constraints: {
    maxPerPage: 1,
    preferredPosition: 'top',
  },
  weights: {
    base: 80,
    personalizedBoost: 20,
  },
  generateConfig: (ctx) => ({
    title: ctx.isNewUser ? 'Popular Right Now' : 'Jump Back In',
    query: ctx.isNewUser ? 'popular trending 2024' : 'recently played popular tracks',
    isPersonalized: !ctx.isNewUser,
  }),
};

// ============================================
// New Algorithmic Section Definitions
// ============================================

const trendingTracksSectionDef: SectionDefinition = {
  type: 'trending-tracks',
  component: TrendingTracksSection as React.ComponentType<any>,
  displayName: 'Trending Songs',
  description: 'Hot tracks right now',
  requirements: {},
  constraints: {
    maxPerPage: 1,
    preferredPosition: 'top',
  },
  weights: {
    base: 85,
    personalizedBoost: 0,
    newUserBoost: 20,
  },
  generateConfig: () => ({
    title: 'Trending Songs',
    subtitle: 'Popular right now',
    query: 'top hits 2024 trending popular',
    isPersonalized: false,
  }),
};

const trendingArtistsSectionDef: SectionDefinition = {
  type: 'trending-artists',
  component: TrendingArtistsSection as React.ComponentType<any>,
  displayName: 'Popular Artists',
  description: 'Trending artists right now',
  requirements: {},
  constraints: {
    maxPerPage: 1,
    cooldownSections: 4,
  },
  weights: {
    base: 70,
    personalizedBoost: 0,
    newUserBoost: 15,
  },
  generateConfig: () => ({
    title: 'Popular Artists',
    subtitle: 'Artists everyone is listening to',
    query: 'trending popular artists 2024',
    isPersonalized: false,
  }),
};

const artistRadioSectionDef: SectionDefinition = {
  type: 'artist-radio',
  component: ArtistRadioSection as React.ComponentType<any>,
  displayName: 'Artist Radio',
  description: 'Tracks similar to your top artist',
  requirements: {
    // Loosened: works for everyone, falls back to popular artists
  },
  constraints: {
    maxPerPage: 1,
    preferredPosition: 'top',
  },
  weights: {
    base: 75,
    personalizedBoost: 25,
  },
  generateConfig: (ctx) => ({
    title: ctx.topArtists[0] ? `More like ${ctx.topArtists[0]}` : 'Artist Radio',
    subtitle: ctx.topArtists[0] ? 'Based on your listening' : 'Discover similar artists',
    query: ctx.topArtists[0] ? `${ctx.topArtists[0]} similar` : 'popular artists 2024',
    isPersonalized: ctx.topArtists.length > 0,
  }),
};

const becauseYouLikeSectionDef1: SectionDefinition = {
  type: 'because-you-like',
  component: BecauseYouLikeSection as React.ComponentType<any>,
  displayName: 'Because You Like',
  description: 'Recommendations based on a specific artist',
  requirements: {
    // Loosened: works for everyone with fallback
  },
  constraints: {
    maxPerPage: 2,
    cooldownSections: 2,
  },
  weights: {
    base: 65,
    personalizedBoost: 20,
  },
  generateConfig: (ctx) => ({
    title: ctx.topArtists[0] ? `Because you like ${ctx.topArtists[0]}` : 'You Might Like',
    query: ctx.topArtists[0] ? `${ctx.topArtists[0]} similar artists` : 'recommended music 2024',
    isPersonalized: ctx.topArtists.length > 0,
  }),
};

const becauseYouLikeSectionDef2: SectionDefinition = {
  type: 'because-you-like',
  component: BecauseYouLikeSection as React.ComponentType<any>,
  displayName: 'Because You Like',
  description: 'Recommendations based on another artist',
  requirements: {
    minTopArtists: 1, // Loosened from 3 to 1
  },
  constraints: {
    maxPerPage: 2,
    cooldownSections: 3,
  },
  weights: {
    base: 55,
    personalizedBoost: 15,
  },
  generateConfig: (ctx) => ({
    title: ctx.topArtists[1] ? `Because you like ${ctx.topArtists[1]}` : 'More For You',
    query: ctx.topArtists[1] ? `${ctx.topArtists[1]} similar` : 'discover new music',
    isPersonalized: ctx.topArtists.length > 1,
  }),
};

const newReleasesSectionDef: SectionDefinition = {
  type: 'new-releases',
  component: NewReleasesSection as React.ComponentType<any>,
  displayName: 'New Releases',
  description: 'Latest music releases',
  requirements: {},
  constraints: {
    maxPerPage: 1,
    cooldownSections: 5,
  },
  weights: {
    base: 60,
    personalizedBoost: 10,
  },
  generateConfig: (ctx) => ({
    title: 'New Releases',
    subtitle: ctx.topGenres[0] ? `In ${ctx.topGenres[0]}` : 'Fresh music',
    query: ctx.topGenres[0] ? `new releases ${ctx.topGenres[0]} 2024` : 'new releases 2024 latest',
    isPersonalized: ctx.topGenres.length > 0,
  }),
};

const chartListSectionDef: SectionDefinition = {
  type: 'chart-list',
  component: ChartListSection as React.ComponentType<any>,
  displayName: 'Top Charts',
  description: 'Numbered list of trending tracks',
  requirements: {},
  constraints: {
    maxPerPage: 1,
    preferredPosition: 'top',
  },
  weights: {
    base: 80,
    personalizedBoost: 5,
    newUserBoost: 15,
  },
  generateConfig: () => ({
    title: 'Top Charts',
    subtitle: 'What everyone is listening to',
    query: 'top charts hits 2024',
    isPersonalized: false,
  }),
};

const quickPicksSectionDef: SectionDefinition = {
  type: 'quick-picks',
  component: QuickPicksSection as React.ComponentType<any>,
  displayName: 'Quick Picks',
  description: 'Small tiles for quick access',
  requirements: {
    // Loosened: works for everyone
  },
  constraints: {
    maxPerPage: 1,
    preferredPosition: 'top',
  },
  weights: {
    base: 90,
    personalizedBoost: 15,
    newUserBoost: 10,
  },
  generateConfig: (ctx) => ({
    title: '', // No title for cleaner look
    query: ctx.topArtists[0] ? `${ctx.topArtists[0]} similar recommendations` : 'recommended popular tracks 2024',
    isPersonalized: ctx.topArtists.length > 0,
  }),
};

// ============================================
// Existing Layout Sections (kept)
// ============================================

const gridSectionDef: SectionDefinition = {
  type: 'grid',
  component: GridSection as React.ComponentType<any>,
  displayName: 'Discover',
  description: 'Standard responsive grid of track cards',
  requirements: {},
  constraints: {
    maxPerPage: 2,
    cooldownSections: 3,
  },
  weights: {
    base: 55,
    personalizedBoost: 15,
  },
  generateConfig: (ctx) => ({
    title: ctx.topGenres[0] ? `${ctx.topGenres[0]} Mix` : 'Discover',
    query: ctx.topGenres[0] ? `${ctx.topGenres[0]} best 2024` : 'discover new music',
    isPersonalized: ctx.topGenres.length > 0,
  }),
};

const horizontalSectionDef: SectionDefinition = {
  type: 'horizontal',
  component: HorizontalSection as React.ComponentType<any>,
  displayName: 'Browse',
  description: 'Horizontally scrollable row of content',
  requirements: {},
  constraints: {
    maxPerPage: 3,
    cooldownSections: 2,
  },
  weights: {
    base: 50,
    personalizedBoost: 10,
  },
  generateConfig: (ctx) => ({
    title: ctx.topGenres[1] ? `${ctx.topGenres[1]} Hits` : 'Popular Tracks',
    query: ctx.topGenres[1] ? `${ctx.topGenres[1]} hits 2024` : 'popular tracks 2024',
    isPersonalized: ctx.topGenres.length > 1,
  }),
};

const largeCardsSectionDef: SectionDefinition = {
  type: 'large-cards',
  component: EmbeddingLargeCardSection as React.ComponentType<any>,
  displayName: 'Highlights',
  description: 'Large card grid with 2-3 columns (embedding-enhanced)',
  requirements: {},
  constraints: {
    maxPerPage: 1,
    cooldownSections: 4,
  },
  weights: {
    base: 45,
    personalizedBoost: 15,
    timeRelevance: (hour) => {
      // Boost in evening
      if (hour >= 18 && hour < 22) return 15;
      return 0;
    },
  },
  generateConfig: (ctx) => {
    const hour = ctx.hour;
    if (hour >= 6 && hour < 12) {
      return {
        title: 'Morning Energy',
        query: 'upbeat energizing morning',
        embedding: { type: 'mood', id: 'uplifting' },
      };
    } else if (hour >= 12 && hour < 18) {
      return {
        title: 'Afternoon Vibes',
        query: 'popular trending afternoon',
        embedding: { type: 'mood', id: 'focus' },
      };
    } else if (hour >= 18 && hour < 22) {
      return {
        title: 'Evening Wind Down',
        query: 'chill relaxing evening',
        embedding: { type: 'mood', id: 'chill' },
      };
    } else {
      return {
        title: 'Night Mode',
        query: 'ambient calm night lofi',
        embedding: { type: 'mood', id: 'chill' },
      };
    }
  },
};

const artistSpotlightSectionDef: SectionDefinition = {
  type: 'artist-spotlight',
  component: ArtistSpotlightSection as React.ComponentType<any>,
  displayName: 'Featured Artist',
  description: 'Magazine-style artist deep dive',
  requirements: {
    // Loosened: works for everyone
  },
  constraints: {
    maxPerPage: 1,
    cooldownSections: 6,
    preferredPosition: 'bottom',
  },
  weights: {
    base: 45,
    personalizedBoost: 25,
  },
  generateConfig: (ctx) => ({
    title: ctx.topArtists[0] ? `Spotlight: ${ctx.topArtists[0]}` : 'Featured Artist',
    query: ctx.topArtists[0] || 'popular artist 2024',
    isPersonalized: ctx.topArtists.length > 0,
  }),
};

// ============================================
// Additional Variety Sections
// ============================================

const moodGradientSectionDef: SectionDefinition = {
  type: 'mood-gradient',
  component: MoodGradientSection as React.ComponentType<any>,
  displayName: 'Mood Spectrum',
  description: 'Tracks arranged by energy level',
  requirements: {},
  constraints: {
    maxPerPage: 1,
    cooldownSections: 4,
  },
  weights: {
    base: 60,
    personalizedBoost: 15,
    newUserBoost: 10,
  },
  generateConfig: (ctx) => ({
    title: 'Mood Spectrum',
    subtitle: 'From calm to energetic',
    query: ctx.topGenres[0] ? `${ctx.topGenres[0]} music` : 'popular music variety',
    isPersonalized: ctx.topGenres.length > 0,
  }),
};

const genreExplorerSectionDef: SectionDefinition = {
  type: 'genre-explorer',
  component: GenreExplorerSection as React.ComponentType<any>,
  displayName: 'Explore Genres',
  description: 'Browse music by genre',
  requirements: {},
  constraints: {
    maxPerPage: 1,
    cooldownSections: 5,
    preferredPosition: 'middle',
  },
  weights: {
    base: 55,
    personalizedBoost: 10,
    newUserBoost: 20,
  },
  generateConfig: () => ({
    title: 'Explore Genres',
    subtitle: 'Find your next favorite sound',
    query: 'music genres discover variety',
    isPersonalized: false,
  }),
};

const weeklyRotationSectionDef: SectionDefinition = {
  type: 'weekly-rotation',
  component: WeeklyRotationSection as React.ComponentType<any>,
  displayName: 'Weekly Rotation',
  description: 'Trending tracks by day',
  requirements: {},
  constraints: {
    maxPerPage: 1,
    cooldownSections: 6,
  },
  weights: {
    base: 50,
    personalizedBoost: 5,
    newUserBoost: 15,
  },
  generateConfig: () => ({
    title: 'Weekly Rotation',
    subtitle: "What's been trending this week",
    query: 'trending this week popular 2024',
    isPersonalized: false,
  }),
};

const bannerSectionDef: SectionDefinition = {
  type: 'banner',
  component: BannerSection as React.ComponentType<any>,
  displayName: 'Featured',
  description: 'Promotional banner',
  requirements: {},
  constraints: {
    maxPerPage: 1,
    preferredPosition: 'top',
  },
  weights: {
    base: 70,
    personalizedBoost: 0,
    newUserBoost: 25,
  },
  generateConfig: () => ({
    title: 'Featured',
    query: 'featured popular hits 2024',
    isPersonalized: false,
  }),
};

const masonrySectionDef: SectionDefinition = {
  type: 'masonry',
  component: MasonrySection as React.ComponentType<any>,
  displayName: 'Discover Grid',
  description: 'Masonry layout of tracks',
  requirements: {},
  constraints: {
    maxPerPage: 1,
    cooldownSections: 4,
  },
  weights: {
    base: 55,
    personalizedBoost: 15,
  },
  generateConfig: (ctx) => ({
    title: ctx.topGenres[0] ? `${ctx.topGenres[0]} Discoveries` : 'Discover',
    query: ctx.topGenres[0] ? `${ctx.topGenres[0]} best 2024` : 'discover new music 2024',
    isPersonalized: ctx.topGenres.length > 0,
  }),
};

const moodPlaylistSectionDef: SectionDefinition = {
  type: 'mood-playlist',
  component: MoodPlaylistSection as React.ComponentType<any>,
  displayName: 'Mood Playlists',
  description: 'Interactive mood-based playlist generator',
  requirements: {},
  constraints: {
    maxPerPage: 1,
    preferredPosition: 'top',
    cooldownSections: 6,
  },
  weights: {
    base: 80,
    personalizedBoost: 10,
    newUserBoost: 15,
  },
  generateConfig: () => ({
    title: 'Moods',
    subtitle: 'Match your vibe',
    query: 'mood music',
    isPersonalized: false,
  }),
};

// Extra horizontal sections for variety - now with embedding support
const horizontalSectionDef2: SectionDefinition = {
  type: 'horizontal',
  component: EmbeddingHorizontalSection as React.ComponentType<any>,
  displayName: 'Chill Vibes',
  description: 'Relaxing music (embedding-enhanced)',
  requirements: {},
  constraints: {
    maxPerPage: 3,
    cooldownSections: 2,
  },
  weights: {
    base: 50,
    personalizedBoost: 10,
    timeRelevance: (hour) => {
      // Boost in evening/night
      if (hour >= 20 || hour < 6) return 20;
      return 0;
    },
  },
  generateConfig: () => ({
    title: 'Chill Vibes',
    subtitle: 'Wind down with these tracks',
    query: 'chill lofi relaxing music',
    embedding: { type: 'mood', id: 'chill' },
    isPersonalized: false,
  }),
};

const horizontalSectionDef3: SectionDefinition = {
  type: 'horizontal',
  component: EmbeddingHorizontalSection as React.ComponentType<any>,
  displayName: 'Energy Boost',
  description: 'Upbeat music (embedding-enhanced)',
  requirements: {},
  constraints: {
    maxPerPage: 3,
    cooldownSections: 2,
  },
  weights: {
    base: 50,
    personalizedBoost: 10,
    timeRelevance: (hour) => {
      // Boost in morning/afternoon
      if (hour >= 6 && hour < 18) return 15;
      return 0;
    },
  },
  generateConfig: () => ({
    title: 'Energy Boost',
    subtitle: 'Get pumped up',
    query: 'upbeat energetic workout music',
    embedding: { type: 'mood', id: 'energetic' },
    isPersonalized: false,
  }),
};

// ============================================
// New Personalized Section Definitions
// ============================================

const timeGreetingSectionDef: SectionDefinition = {
  type: 'time-greeting',
  component: TimeGreetingSection as React.ComponentType<any>,
  displayName: 'Time Greeting',
  description: 'Context-aware greeting with personalized tracks',
  requirements: {},
  constraints: {
    maxPerPage: 1,
    preferredPosition: 'top',
  },
  weights: {
    base: 85,
    personalizedBoost: 15,
    timeRelevance: () => 10, // Always relevant
  },
  generateConfig: (ctx) => ({
    title: '', // Component handles title based on time
    isPersonalized: true,
  }),
};

const onRepeatSectionDef: SectionDefinition = {
  type: 'on-repeat',
  component: OnRepeatSection as React.ComponentType<any>,
  displayName: 'On Repeat',
  description: 'Your most played tracks',
  requirements: {
    minListens: 5,
  },
  constraints: {
    maxPerPage: 1,
    cooldownSections: 4,
  },
  weights: {
    base: 70,
    personalizedBoost: 20,
  },
  generateConfig: () => ({
    title: 'On Repeat',
    subtitle: 'Your heavy rotation',
    isPersonalized: true,
  }),
};

const discoverWeeklySectionDef: SectionDefinition = {
  type: 'discover-weekly',
  component: DiscoverWeeklySection as React.ComponentType<any>,
  displayName: 'Discover Weekly',
  description: 'Mix of familiar and new music',
  requirements: {},
  constraints: {
    maxPerPage: 1,
    cooldownSections: 5,
  },
  weights: {
    base: 75,
    personalizedBoost: 15,
  },
  generateConfig: () => ({
    title: 'Discover Weekly',
    subtitle: 'Your personalized mix of new and familiar',
    isPersonalized: true,
  }),
};

const topMixSectionDef: SectionDefinition = {
  type: 'top-mix',
  component: TopMixSection as React.ComponentType<any>,
  displayName: 'Your Top Mix',
  description: 'Pure taste profile-based recommendations',
  requirements: {
    minListens: 3,
  },
  constraints: {
    maxPerPage: 1,
    cooldownSections: 4,
  },
  weights: {
    base: 70,
    personalizedBoost: 25,
  },
  generateConfig: () => ({
    title: 'Your Top Mix',
    subtitle: 'Based on everything you love',
    isPersonalized: true,
  }),
};

const rediscoverSectionDef: SectionDefinition = {
  type: 'rediscover',
  component: RediscoverSection as React.ComponentType<any>,
  displayName: 'Rediscover',
  description: 'Old favorites you might have forgotten',
  requirements: {
    minListens: 10,
  },
  constraints: {
    maxPerPage: 1,
    cooldownSections: 6,
  },
  weights: {
    base: 55,
    personalizedBoost: 20,
  },
  generateConfig: () => ({
    title: 'Rediscover',
    subtitle: 'Tracks you might have forgotten',
    isPersonalized: true,
  }),
};

const activitySectionDef: SectionDefinition = {
  type: 'activity',
  component: ActivitySection as React.ComponentType<any>,
  displayName: 'Activity Playlists',
  description: 'Music for what you\'re doing',
  requirements: {},
  constraints: {
    maxPerPage: 1,
    cooldownSections: 5,
  },
  weights: {
    base: 65,
    personalizedBoost: 10,
    newUserBoost: 15,
  },
  generateConfig: () => ({
    title: 'Activity Playlists',
    subtitle: 'Music for what you\'re doing',
    isPersonalized: false,
  }),
};

const decadeMixSectionDef: SectionDefinition = {
  type: 'decade-mix',
  component: DecadeMixSection as React.ComponentType<any>,
  displayName: 'Decade Mixes',
  description: 'Music through the years',
  requirements: {},
  constraints: {
    maxPerPage: 1,
    cooldownSections: 6,
  },
  weights: {
    base: 55,
    personalizedBoost: 5,
    newUserBoost: 10,
  },
  generateConfig: () => ({
    title: 'Decade Mixes',
    subtitle: 'Music through the years',
    isPersonalized: false,
  }),
};

const seasonalSectionDef: SectionDefinition = {
  type: 'seasonal',
  component: SeasonalSection as React.ComponentType<any>,
  displayName: 'Seasonal',
  description: 'Music for the season',
  requirements: {},
  constraints: {
    maxPerPage: 1,
    cooldownSections: 7,
  },
  weights: {
    base: 50,
    personalizedBoost: 10,
  },
  generateConfig: () => ({
    title: '', // Component handles title based on season
    isPersonalized: false,
  }),
};

const blindPicksSectionDef: SectionDefinition = {
  type: 'blind-picks',
  component: BlindPicksSection as React.ComponentType<any>,
  displayName: 'Blind Picks',
  description: 'Random discovery to expand taste',
  requirements: {},
  constraints: {
    maxPerPage: 1,
    cooldownSections: 5,
  },
  weights: {
    base: 60,
    personalizedBoost: 5,
    newUserBoost: 20,
  },
  generateConfig: () => ({
    title: 'Blind Picks',
    subtitle: 'Expand your horizons',
    isPersonalized: false,
  }),
};

const similarArtistsSectionDef: SectionDefinition = {
  type: 'similar-artists',
  component: SimilarArtistsSection as React.ComponentType<any>,
  displayName: 'Artists For You',
  description: 'Artists similar to your favorites',
  requirements: {
    minListens: 5,
  },
  constraints: {
    maxPerPage: 1,
    cooldownSections: 5,
  },
  weights: {
    base: 65,
    personalizedBoost: 20,
  },
  generateConfig: () => ({
    title: 'Artists For You',
    subtitle: 'Based on your listening',
    isPersonalized: true,
  }),
};

// ============================================
// Register All Sections (Expanded - 30+ sections)
// ============================================

export function registerAllSections(): void {
  // Quick access sections (shown at top)
  sectionRegistry.register(quickPicksSectionDef);
  sectionRegistry.register(heroSectionDef);
  sectionRegistry.register(bannerSectionDef);

  // Chart/trending (numbered list for variety)
  sectionRegistry.register(chartListSectionDef);
  sectionRegistry.register(trendingTracksSectionDef);
  sectionRegistry.register(trendingArtistsSectionDef);

  // Personalized sections
  sectionRegistry.register(artistRadioSectionDef);
  sectionRegistry.register(becauseYouLikeSectionDef1);
  sectionRegistry.register(becauseYouLikeSectionDef2);

  // Discovery sections
  sectionRegistry.register(newReleasesSectionDef);
  sectionRegistry.register(compactListSectionDef);

  // Layout variety sections
  sectionRegistry.register(gridSectionDef);
  sectionRegistry.register(horizontalSectionDef);
  sectionRegistry.register(horizontalSectionDef2); // Chill Vibes
  sectionRegistry.register(horizontalSectionDef3); // Energy Boost
  sectionRegistry.register(masonrySectionDef);
  sectionRegistry.register(largeCardsSectionDef);

  // New variety sections
  // moodGradientSectionDef removed - the Calm/Balanced/Intense spectrum was confusing
  sectionRegistry.register(genreExplorerSectionDef);
  sectionRegistry.register(weeklyRotationSectionDef);
  sectionRegistry.register(moodPlaylistSectionDef);

  // New personalized sections
  sectionRegistry.register(timeGreetingSectionDef);
  sectionRegistry.register(onRepeatSectionDef);
  sectionRegistry.register(discoverWeeklySectionDef);
  sectionRegistry.register(topMixSectionDef);
  sectionRegistry.register(rediscoverSectionDef);
  sectionRegistry.register(activitySectionDef);
  sectionRegistry.register(decadeMixSectionDef);
  sectionRegistry.register(seasonalSectionDef);
  sectionRegistry.register(blindPicksSectionDef);
  sectionRegistry.register(similarArtistsSectionDef);

  // Feature sections (lower frequency)
  sectionRegistry.register(artistSpotlightSectionDef);

  console.log('[SectionRegistry] Registered', sectionRegistry.getAll().length, 'sections');
}

export default registerAllSections;
