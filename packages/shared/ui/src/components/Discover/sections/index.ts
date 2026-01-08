// Base components
export { BaseSectionWrapper, useSectionData, useSectionTracks, SectionSkeletons } from './base/BaseSection';
export type { BaseSectionWrapperProps, EmbeddingConfig } from './base/BaseSection';

// Primary sections
export { HeroSection } from './HeroSection';
export type { HeroSectionProps } from './HeroSection';

// Trending section
export { TrendingTracksSection } from './TrendingTracksSection';
export type { TrendingTracksSectionProps } from './TrendingTracksSection';

// Because You Liked section - seed-based recommendations
export { BecauseYouLikedSection } from './BecauseYouLikedSection';
export type { BecauseYouLikedSectionProps } from './BecauseYouLikedSection';

// New Releases section - fresh drops
export { NewReleasesSection } from './NewReleasesSection';
export type { NewReleasesSectionProps } from './NewReleasesSection';

// Mood Ring section - dynamic mood-based discovery
export { MoodRingSection } from './MoodRingSection';
export type { MoodRingSectionProps } from './MoodRingSection';

// Hidden Gems section - underrated tracks
export { HiddenGemsSection } from './HiddenGemsSection';
export type { HiddenGemsSectionProps } from './HiddenGemsSection';

// Quick Pick section - swipe-based discovery
export { QuickPickSection } from './QuickPickSection';
export type { QuickPickSectionProps } from './QuickPickSection';
