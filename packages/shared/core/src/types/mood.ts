/**
 * Mood and Emotion Types
 *
 * This module defines the canonical mood/emotion types used across Audiio:
 * - EmotionCategory: ML-detected emotions from audio analysis (16 values)
 * - MoodType: User-facing mood selection for playlists/radio (8 values)
 */

/**
 * ML-detected emotion categories based on audio analysis.
 * Uses Russell's circumplex model + discrete emotions.
 * These are classified by the ML system from audio features.
 */
export type EmotionCategory =
  | 'happy' | 'sad' | 'angry' | 'fearful'
  | 'calm' | 'energetic' | 'tense' | 'melancholic'
  | 'euphoric' | 'peaceful' | 'aggressive' | 'romantic'
  | 'nostalgic' | 'hopeful' | 'dark' | 'uplifting';

/**
 * User-facing mood categories for playlist generation and radio.
 * Each mood has an associated MoodProfile with audio feature ranges.
 */
export type MoodType =
  | 'chill' | 'workout' | 'focus' | 'party'
  | 'sleep' | 'happy' | 'melancholy' | 'energetic';

/**
 * All emotion categories as an array (useful for iteration/validation)
 */
export const EMOTION_CATEGORIES: EmotionCategory[] = [
  'happy', 'sad', 'angry', 'fearful',
  'calm', 'energetic', 'tense', 'melancholic',
  'euphoric', 'peaceful', 'aggressive', 'romantic',
  'nostalgic', 'hopeful', 'dark', 'uplifting',
];

/**
 * All mood types as an array (useful for iteration/validation)
 */
export const MOOD_TYPES: MoodType[] = [
  'chill', 'workout', 'focus', 'party',
  'sleep', 'happy', 'melancholy', 'energetic',
];
