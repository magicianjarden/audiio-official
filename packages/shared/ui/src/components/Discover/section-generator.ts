/**
 * Section Generator - Creates adaptive Discover page layout
 * based on user listening history and preferences
 */

import type { RecommendationProfile } from '../../stores/recommendation-store';

export type SectionType =
  | 'hero'
  | 'horizontal'
  | 'large-cards'
  | 'compact-list'
  | 'quick-mix'
  | 'grid'
  | 'quick-picks';

export interface SectionConfig {
  id: string;
  type: SectionType;
  title: string;
  subtitle?: string;
  query?: string;
  isPersonalized?: boolean;
}

interface GenerateOptions {
  userProfile: RecommendationProfile;
  likedTracksCount: number;
  topArtists: string[];
  topGenres: string[];
}

// Time-based titles for mood sections
function getTimeBasedTitle(): { title: string; query: string } {
  const hour = new Date().getHours();

  if (hour >= 6 && hour < 12) {
    return { title: 'Morning Energy', query: 'upbeat energizing morning music' };
  } else if (hour >= 12 && hour < 18) {
    return { title: 'Afternoon Vibes', query: 'popular trending afternoon' };
  } else if (hour >= 18 && hour < 22) {
    return { title: 'Evening Wind Down', query: 'chill relaxing evening' };
  } else {
    return { title: 'Night Mode', query: 'ambient calm night lofi' };
  }
}

export function generateDiscoverSections(options: GenerateOptions): SectionConfig[] {
  const { userProfile, likedTracksCount, topArtists, topGenres } = options;
  const sections: SectionConfig[] = [];

  const hasHistory = userProfile.totalListens > 5;
  const hasLikes = likedTracksCount > 0;
  const hasPersonalization = hasHistory || hasLikes;

  // 1. Hero Section - personalized or trending
  if (hasPersonalization && topArtists.length > 0) {
    sections.push({
      id: 'for-you',
      type: 'hero',
      title: 'Made For You',
      subtitle: 'Personalized mix based on your listening',
      query: `${topArtists[0]} ${topGenres[0] || ''} similar`,
      isPersonalized: true,
    });
  } else {
    // Quick Picks for non-personalized
    sections.push({
      id: 'trending',
      type: 'hero',
      title: 'Trending Now',
      subtitle: 'Popular tracks right now',
      query: 'top hits 2024 trending',
      isPersonalized: false,
    });
  }

  // 2. Quick Mix pills (always)
  sections.push({
    id: 'quick-mix',
    type: 'quick-mix',
    title: 'Quick Mix',
  });

  // 3. Recently Played (if has history)
  if (hasHistory) {
    sections.push({
      id: 'recently-played',
      type: 'compact-list',
      title: 'Jump Back In',
      isPersonalized: true,
    });
  }

  // 4. Top Artists (if personalized)
  if (topArtists.length > 0) {
    sections.push({
      id: 'top-artists',
      type: 'horizontal',
      title: 'Your Top Artists',
      query: topArtists.slice(0, 3).join(' '),
      isPersonalized: true,
    });
  }

  // 5. Time-based mood section
  const timeSection = getTimeBasedTitle();
  sections.push({
    id: 'mood-time',
    type: 'large-cards',
    title: timeSection.title,
    query: timeSection.query,
    isPersonalized: hasPersonalization,
  });

  // 6. "Because you like X" (if has top artist)
  if (topArtists.length > 0) {
    sections.push({
      id: 'because-you-like',
      type: 'horizontal',
      title: `Because you like ${topArtists[0]}`,
      query: `${topArtists[0]} similar artists`,
      isPersonalized: true,
    });
  }

  // 7. Genre section (if has genre preferences)
  if (topGenres.length > 0) {
    sections.push({
      id: 'genre-mix',
      type: 'grid',
      title: `${topGenres[0]} Mix`,
      query: `${topGenres[0]} best 2024`,
      isPersonalized: true,
    });
  }

  // 8. New Releases
  sections.push({
    id: 'new-releases',
    type: 'horizontal',
    title: 'New Releases',
    query: 'new releases 2024 music',
    isPersonalized: false,
  });

  // 9. Additional fallback sections for non-personalized users
  if (!hasPersonalization) {
    sections.push(
      {
        id: 'chill',
        type: 'grid',
        title: 'Chill Vibes',
        query: 'chill lofi beats relaxing',
        isPersonalized: false,
      },
      {
        id: 'workout',
        type: 'horizontal',
        title: 'Workout Energy',
        query: 'workout motivation energy',
        isPersonalized: false,
      },
      {
        id: 'indie',
        type: 'grid',
        title: 'Indie Discoveries',
        query: 'indie alternative new artists',
        isPersonalized: false,
      }
    );
  } else {
    // Additional personalized sections if has second favorite
    if (topArtists.length >= 2) {
      sections.push({
        id: 'discover-artist',
        type: 'horizontal',
        title: `Discover: ${topArtists[1]}`,
        query: `${topArtists[1]}`,
        isPersonalized: true,
      });
    }

    if (topGenres.length >= 2) {
      sections.push({
        id: 'genre-mix-2',
        type: 'grid',
        title: `${topGenres[0]} x ${topGenres[1]}`,
        query: `${topGenres[0]} ${topGenres[1]}`,
        isPersonalized: true,
      });
    }
  }

  return sections;
}

export default generateDiscoverSections;
