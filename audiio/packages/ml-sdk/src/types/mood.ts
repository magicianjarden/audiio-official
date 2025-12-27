/**
 * Mood Types for ML-based Music Recommendations
 *
 * Defines mood profiles that combine audio features to match
 * tracks to specific listening contexts.
 */

/**
 * Predefined mood categories
 */
export type MoodType = 'chill' | 'workout' | 'focus' | 'party' | 'sleep' | 'happy' | 'melancholy' | 'energetic';

/**
 * Range definition for audio features
 */
export interface FeatureRange {
  min: number;
  max: number;
}

/**
 * Mood profile defining the audio characteristics for a mood
 */
export interface MoodProfile {
  /** Unique identifier */
  id: MoodType;
  /** Display name */
  name: string;
  /** Short description */
  description: string;
  /** Icon name or emoji */
  icon: string;
  /** Gradient colors for visual representation */
  gradient: [string, string];
  /** Audio feature ranges that define this mood */
  features: {
    /** Energy level (0-1) */
    energy?: FeatureRange;
    /** Musical positiveness (0-1) */
    valence?: FeatureRange;
    /** Danceability score (0-1) */
    danceability?: FeatureRange;
    /** Tempo in BPM */
    bpm?: FeatureRange;
    /** Acousticness (0-1) */
    acousticness?: FeatureRange;
    /** Instrumentalness (0-1) */
    instrumentalness?: FeatureRange;
  };
  /** Associated genres that match this mood */
  preferredGenres?: string[];
  /** Genres to avoid for this mood */
  excludedGenres?: string[];
  /** Search query terms for API fallback */
  searchTerms: string[];
}

/**
 * Result of matching a track to a mood
 */
export interface MoodMatchResult {
  /** The mood being matched */
  mood: MoodType;
  /** Match score 0-1 (1 = perfect match) */
  score: number;
  /** Which features contributed to the match */
  matchedFeatures: string[];
  /** Features that didn't match well */
  mismatchedFeatures: string[];
}

/**
 * Predefined mood profiles
 */
export const MOOD_PROFILES: Record<MoodType, MoodProfile> = {
  chill: {
    id: 'chill',
    name: 'Chill',
    description: 'Relaxed vibes for unwinding',
    icon: '🌊',
    gradient: ['#667eea', '#764ba2'],
    features: {
      energy: { min: 0.1, max: 0.4 },
      valence: { min: 0.4, max: 0.7 },
      danceability: { min: 0.2, max: 0.5 },
      bpm: { min: 60, max: 100 },
    },
    preferredGenres: ['lofi', 'chill', 'ambient', 'jazz', 'soul', 'r&b', 'acoustic'],
    excludedGenres: ['metal', 'hardcore', 'punk'],
    searchTerms: ['chill vibes', 'lofi beats', 'relaxing music', 'calm'],
  },

  workout: {
    id: 'workout',
    name: 'Workout',
    description: 'High energy for exercise',
    icon: '💪',
    gradient: ['#f12711', '#f5af19'],
    features: {
      energy: { min: 0.7, max: 1.0 },
      valence: { min: 0.5, max: 1.0 },
      danceability: { min: 0.7, max: 1.0 },
      bpm: { min: 120, max: 180 },
    },
    preferredGenres: ['edm', 'hip-hop', 'electronic', 'pop', 'dance', 'dubstep'],
    excludedGenres: ['ambient', 'classical', 'sleep'],
    searchTerms: ['workout music', 'gym motivation', 'high energy', 'pump up'],
  },

  focus: {
    id: 'focus',
    name: 'Focus',
    description: 'Concentration and productivity',
    icon: '🎯',
    gradient: ['#11998e', '#38ef7d'],
    features: {
      energy: { min: 0.2, max: 0.5 },
      valence: { min: 0.3, max: 0.6 },
      bpm: { min: 80, max: 120 },
      instrumentalness: { min: 0.5, max: 1.0 },
    },
    preferredGenres: ['ambient', 'classical', 'lofi', 'electronic', 'post-rock'],
    excludedGenres: ['metal', 'hip-hop', 'pop'],
    searchTerms: ['focus music', 'study beats', 'concentration', 'deep work'],
  },

  party: {
    id: 'party',
    name: 'Party',
    description: 'Get the party started',
    icon: '🎉',
    gradient: ['#ff0844', '#ffb199'],
    features: {
      energy: { min: 0.8, max: 1.0 },
      valence: { min: 0.7, max: 1.0 },
      danceability: { min: 0.8, max: 1.0 },
    },
    preferredGenres: ['pop', 'dance', 'edm', 'hip-hop', 'house', 'disco'],
    excludedGenres: ['ambient', 'classical', 'folk'],
    searchTerms: ['party music', 'dance hits', 'club bangers', 'party anthems'],
  },

  sleep: {
    id: 'sleep',
    name: 'Sleep',
    description: 'Peaceful sounds for rest',
    icon: '🌙',
    gradient: ['#2c3e50', '#4ca1af'],
    features: {
      energy: { min: 0.0, max: 0.2 },
      valence: { min: 0.3, max: 0.6 },
      bpm: { min: 40, max: 80 },
      acousticness: { min: 0.6, max: 1.0 },
    },
    preferredGenres: ['ambient', 'classical', 'sleep', 'meditation', 'nature sounds'],
    excludedGenres: ['metal', 'rock', 'hip-hop', 'edm'],
    searchTerms: ['sleep music', 'relaxing sleep', 'peaceful night', 'calm sleep'],
  },

  happy: {
    id: 'happy',
    name: 'Happy',
    description: 'Uplifting and joyful tunes',
    icon: '☀️',
    gradient: ['#ffecd2', '#fcb69f'],
    features: {
      energy: { min: 0.5, max: 0.8 },
      valence: { min: 0.7, max: 1.0 },
      danceability: { min: 0.5, max: 0.9 },
    },
    preferredGenres: ['pop', 'indie', 'funk', 'soul', 'disco'],
    searchTerms: ['happy music', 'feel good songs', 'uplifting', 'positive vibes'],
  },

  melancholy: {
    id: 'melancholy',
    name: 'Melancholy',
    description: 'Emotional and introspective',
    icon: '🌧️',
    gradient: ['#4b6cb7', '#182848'],
    features: {
      energy: { min: 0.2, max: 0.5 },
      valence: { min: 0.1, max: 0.4 },
      acousticness: { min: 0.4, max: 1.0 },
    },
    preferredGenres: ['indie', 'folk', 'alternative', 'singer-songwriter', 'blues'],
    searchTerms: ['sad songs', 'melancholic', 'emotional music', 'rainy day'],
  },

  energetic: {
    id: 'energetic',
    name: 'Energetic',
    description: 'High-octane excitement',
    icon: '⚡',
    gradient: ['#fc4a1a', '#f7b733'],
    features: {
      energy: { min: 0.8, max: 1.0 },
      valence: { min: 0.5, max: 1.0 },
      danceability: { min: 0.6, max: 1.0 },
      bpm: { min: 130, max: 200 },
    },
    preferredGenres: ['electronic', 'rock', 'punk', 'metal', 'drum and bass'],
    searchTerms: ['energetic music', 'high energy', 'adrenaline', 'power'],
  },
};

/**
 * Get mood profiles for display (array form)
 */
export function getMoodProfiles(): MoodProfile[] {
  return Object.values(MOOD_PROFILES);
}

/**
 * Get a specific mood profile by ID
 */
export function getMoodProfile(moodId: MoodType): MoodProfile | undefined {
  return MOOD_PROFILES[moodId];
}
