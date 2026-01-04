/**
 * Hybrid Scorer - Combines rule-based and neural network scoring
 */

import type {
  Track,
  AggregatedFeatures,
  TrackScore,
  ScoreComponents,
  ScoringContext,
  ScoreExplanation,
  UserEvent,
  MLCoreEndpoints,
  UserPreferences,
  TemporalPatterns,
  EmotionFeatures,
  MoodCategory,
  AudioFeatures,
  ActivityType,
} from '../types';
import {
  calculateWeightedScore,
  calculateTemporalFit,
  calculateEnhancedTemporalFit,
  calculateSessionFlowScore,
  calculateDiversityScore,
  calculateExplorationBonus,
  calculateSerendipityScore,
  calculateRecentPlayPenalty,
  calculateAudioMatchScore,
  generateExplanation,
  buildFeatureVector,
  encodeHour,
  encodeDay,
  getHarmonicCompatibility,
  DEFAULT_ENERGY_CURVE,
  getTimeOfDayLabel,
} from '../utils';
import type { NeuralScorer } from './neural-scorer';

export class HybridScorer {
  private endpoints: MLCoreEndpoints;
  private neuralScorer: NeuralScorer;
  private settings: Record<string, unknown>;

  // Cached user data
  private userPreferences?: UserPreferences;
  private temporalPatterns?: TemporalPatterns;
  private preferencesExpiry = 0;

  // Recent scores for explanation
  private recentScores = new Map<string, TrackScore>();

  constructor(
    endpoints: MLCoreEndpoints,
    neuralScorer: NeuralScorer,
    settings: Record<string, unknown>
  ) {
    this.endpoints = endpoints;
    this.neuralScorer = neuralScorer;
    this.settings = settings;
  }

  /**
   * Score a single track
   */
  async score(
    track: Track,
    features: AggregatedFeatures,
    context: ScoringContext
  ): Promise<TrackScore> {
    // Ensure we have user preferences
    await this.ensurePreferences();

    // Calculate all score components
    const components = await this.calculateComponents(track, features, context);

    // Get weights based on settings
    const weights = this.getWeights();

    // Calculate final score
    const finalScore = calculateWeightedScore(components, weights);

    // Generate explanation
    const explanation = generateExplanation(components);

    // Calculate confidence
    const confidence = this.calculateConfidence(components);

    const score: TrackScore = {
      trackId: track.id,
      finalScore,
      confidence,
      components,
      explanation,
    };

    // Cache for explanation
    this.recentScores.set(track.id, score);
    if (this.recentScores.size > 100) {
      const firstKey = this.recentScores.keys().next().value;
      if (firstKey) {
        this.recentScores.delete(firstKey);
      }
    }

    return score;
  }

  /**
   * Score multiple tracks efficiently
   */
  async scoreBatch(
    tracks: Track[],
    context: ScoringContext
  ): Promise<TrackScore[]> {
    await this.ensurePreferences();

    // Get features for all tracks
    const featurePromises = tracks.map(t => this.endpoints.features.get(t.id));
    const features = await Promise.all(featurePromises);

    // Score all tracks
    const scorePromises = tracks.map((track, i) =>
      this.score(track, features[i], context)
    );

    return Promise.all(scorePromises);
  }

  /**
   * Handle user events for real-time updates
   */
  handleEvent(event: UserEvent): void {
    // Invalidate preferences cache on significant events
    if (event.type === 'like' || event.type === 'dislike') {
      this.preferencesExpiry = 0;
    }
  }

  /**
   * Get explanation for a track's score
   */
  async explain(trackId: string): Promise<ScoreExplanation> {
    const cached = this.recentScores.get(trackId);

    if (!cached) {
      throw new Error(`No recent score for track ${trackId}`);
    }

    // Generate detailed explanation
    const details: ScoreExplanation['details'] = [];

    for (const [key, value] of Object.entries(cached.components)) {
      if (value !== undefined) {
        details.push({
          component: key as keyof ScoreComponents,
          label: this.getComponentLabel(key),
          value: value as number,
          impact: value > 50 ? 'positive' : value < 30 ? 'negative' : 'neutral',
          reason: this.getComponentReason(key, value as number),
        });
      }
    }

    // Calculate comparison to averages
    const avgSession = this.calculateSessionAverage();
    const avgHistorical = 50; // TODO: Track historical average

    return {
      trackId,
      score: cached,
      summary: this.generateSummary(cached),
      details,
      comparison: {
        vsSessionAverage: cached.finalScore - avgSession,
        vsHistoricalAverage: cached.finalScore - avgHistorical,
      },
    };
  }

  /**
   * Calculate all score components
   */
  private async calculateComponents(
    track: Track,
    features: AggregatedFeatures,
    context: ScoringContext
  ): Promise<Partial<ScoreComponents>> {
    const components: Partial<ScoreComponents> = {};

    // === Base Preference ===
    const artistAffinity = await this.endpoints.user.getArtistAffinity(track.artistId || '');
    const genreAffinity = await this.endpoints.user.getGenreAffinity(track.genre || '');
    components.basePreference = ((artistAffinity + 1) / 2 * 60 + (genreAffinity + 1) / 2 * 40);

    // === ML Prediction ===
    if (this.neuralScorer.isReady() && this.settings.mlWeight !== 0) {
      const featureVector = buildFeatureVector(
        track,
        features.audio,
        {
          hourOfDay: context.hourOfDay,
          dayOfWeek: context.dayOfWeek,
          isWeekend: context.isWeekend,
        },
        {
          playCount: 0, // TODO: Get from user data
          skipRatio: 0,
          completionRatio: 0.5,
          artistAffinity,
          genreAffinity,
        }
      );

      const prediction = await this.neuralScorer.predictSingle(featureVector);
      components.mlPrediction = prediction * 100;
    }

    // === Audio Match ===
    if (features.audio && context.currentTrack) {
      const currentFeatures = await this.endpoints.features.getAudio(context.currentTrack.id);
      if (currentFeatures) {
        components.audioMatch = calculateAudioMatchScore(features.audio, currentFeatures) * 100;
      }
    }

    // === Mood Match ===
    if (features.emotion && context.userMood) {
      const moodMatch = this.calculateMoodMatch(features.emotion, context.userMood);
      components.moodMatch = moodMatch * 100;
    }

    // === Harmonic Flow ===
    if (features.audio?.key && context.currentTrack) {
      const currentFeatures = await this.endpoints.features.getAudio(context.currentTrack.id);
      if (currentFeatures?.key && features.audio.mode && currentFeatures.mode) {
        components.harmonicFlow = getHarmonicCompatibility(
          features.audio.key,
          features.audio.mode,
          currentFeatures.key,
          currentFeatures.mode
        ) * 100;
      }
    }

    // === Temporal Fit (Enhanced time-of-day awareness) ===
    if (this.settings.enableTemporalMatching !== false) {
      const energy = features.audio?.energy ?? 0.5;
      const valence = features.audio?.valence ?? features.emotion?.valence ?? 0.5;

      // Use enhanced temporal scoring with time-of-day context
      const timeOfDayMode = this.settings.timeOfDayMode as string || 'auto';

      if (timeOfDayMode === 'off') {
        // Skip temporal scoring entirely
        components.temporalFit = 50; // Neutral
      } else {
        // Use user's energy history if available, otherwise use default curve
        const energyHistory = this.temporalPatterns?.energyByHour ?? DEFAULT_ENERGY_CURVE;

        const enhancedResult = calculateEnhancedTemporalFit(
          context.hourOfDay,
          energy,
          valence,
          energyHistory
        );

        components.temporalFit = enhancedResult.score * 100;

        // Store temporal reason for explanations
        if (enhancedResult.score > 0.7) {
          // High temporal fit - will show in explanation
        }
      }
    }

    // === Session Flow ===
    if (this.settings.enableSessionFlow !== false && context.sessionTracks.length > 0) {
      const sessionEnergies = context.sessionTracks
        .slice(-5)
        .map(t => ({ energy: 0.5 })); // TODO: Get actual energies
      const trackEnergy = features.audio?.energy ?? 0.5;
      components.sessionFlow = calculateSessionFlowScore(trackEnergy, sessionEnergies) * 100;
    }

    // === Activity Match ===
    if (context.activity && features.audio) {
      components.activityMatch = this.calculateActivityMatch(features.audio, context.activity) * 100;
    }

    // === Exploration Bonus ===
    const isNewArtist = !this.userPreferences?.topArtists.some(a => a.artistId === track.artistId);
    const isNewGenre = !this.userPreferences?.topGenres.some(g => g.genre === track.genre);

    const explorationLevel = this.settings.explorationLevel as string || 'balanced';
    const epsilon = explorationLevel === 'high' ? 0.25 : explorationLevel === 'low' ? 0.05 : 0.15;

    components.explorationBonus = calculateExplorationBonus(
      isNewArtist,
      isNewGenre,
      0, // TODO: Get actual play counts
      0,
      epsilon
    ) * 100;

    // === Serendipity ===
    const topGenres = this.userPreferences?.topGenres.map(g => g.genre) || [];
    const topArtists = this.userPreferences?.topArtists.map(a => a.artistId) || [];
    components.serendipityScore = calculateSerendipityScore(
      track,
      topGenres,
      topArtists,
      isNewArtist
    ) * 100;

    // === Diversity ===
    components.diversityScore = calculateDiversityScore(
      track,
      context.sessionArtists,
      context.sessionGenres
    ) * 100;

    // === Penalties ===
    const lastPlayed = await this.endpoints.user.getLastPlayed(track.id);
    components.recentPlayPenalty = calculateRecentPlayPenalty(lastPlayed);

    // Dislike penalty
    const dislikedTracks = await this.endpoints.user.getDislikedTracks();
    const isDisliked = dislikedTracks.some(d => d.trackId === track.id);
    const artistDisliked = dislikedTracks.some(
      d => d.artistId === track.artistId && d.reason === 'dont_like_artist'
    );
    components.dislikePenalty = isDisliked ? 50 : artistDisliked ? 30 : 0;

    // Repetition penalty
    const artistInSession = context.sessionArtists.filter(a => a === track.artistId).length;
    components.repetitionPenalty = artistInSession > 1 ? (artistInSession - 1) * 15 : 0;

    return components;
  }

  /**
   * Get scoring weights based on settings
   */
  private getWeights() {
    const mlWeight = this.neuralScorer.getMLWeight() * (this.settings.mlWeight as number || 0.5);
    const ruleWeight = 1 - mlWeight;

    // Adjust temporal weight based on settings
    const timeOfDayMode = this.settings.timeOfDayMode as string || 'auto';
    const temporalWeight = timeOfDayMode === 'off' ? 0 :
                          timeOfDayMode === 'strong' ? 0.12 : 0.08; // Default 'auto' = 0.08

    return {
      basePreference: 0.25 * ruleWeight,
      mlPrediction: mlWeight,
      audioMatch: 0.10 * ruleWeight,
      moodMatch: 0.08 * ruleWeight,
      harmonicFlow: 0.05 * ruleWeight,
      temporalFit: temporalWeight * ruleWeight, // Increased from 0.05 to 0.08
      sessionFlow: 0.07 * ruleWeight,
      activityMatch: 0.05 * ruleWeight,
      explorationBonus: 0.10 * ruleWeight,
      serendipityScore: 0.10 * ruleWeight,
      diversityScore: 0.10 * ruleWeight,

      recentPlayPenalty: 1.0,
      dislikePenalty: 1.5,
      repetitionPenalty: 1.0,
      fatiguePenalty: 0.8,
    };
  }

  /**
   * Calculate mood match
   */
  private calculateMoodMatch(
    emotion: EmotionFeatures,
    targetMood: MoodCategory
  ): number {
    // Map moods to valence/arousal targets
    const moodTargets: Record<string, { valence: number; arousal: number }> = {
      happy: { valence: 0.8, arousal: 0.7 },
      sad: { valence: 0.2, arousal: 0.3 },
      calm: { valence: 0.6, arousal: 0.2 },
      energetic: { valence: 0.7, arousal: 0.9 },
      tense: { valence: 0.3, arousal: 0.8 },
      melancholic: { valence: 0.3, arousal: 0.4 },
      euphoric: { valence: 0.9, arousal: 0.9 },
      peaceful: { valence: 0.7, arousal: 0.2 },
    };

    const target = moodTargets[targetMood] || { valence: 0.5, arousal: 0.5 };
    const valenceDiff = Math.abs(emotion.valence - target.valence);
    const arousalDiff = Math.abs(emotion.arousal - target.arousal);

    return 1 - (valenceDiff + arousalDiff) / 2;
  }

  /**
   * Calculate activity match
   */
  private calculateActivityMatch(
    audio: AudioFeatures,
    activity: ActivityType
  ): number {
    const activityProfiles: Record<string, { energy: number; bpm: number }> = {
      working: { energy: 0.4, bpm: 100 },
      studying: { energy: 0.3, bpm: 80 },
      relaxing: { energy: 0.2, bpm: 70 },
      exercising: { energy: 0.9, bpm: 140 },
      commuting: { energy: 0.5, bpm: 110 },
      sleeping: { energy: 0.1, bpm: 60 },
      party: { energy: 0.95, bpm: 128 },
      dining: { energy: 0.4, bpm: 90 },
    };

    const profile = activityProfiles[activity] || { energy: 0.5, bpm: 100 };

    let match = 0;

    if (audio.energy !== undefined) {
      match += 1 - Math.abs(audio.energy - profile.energy);
    }

    if (audio.bpm !== undefined) {
      const bpmDiff = Math.abs(audio.bpm - profile.bpm) / 60; // Normalize
      match += 1 - Math.min(1, bpmDiff);
    }

    return match / 2;
  }

  /**
   * Calculate confidence in the score
   */
  private calculateConfidence(components: Partial<ScoreComponents>): number {
    let factorCount = 0;
    let totalConfidence = 0;

    for (const value of Object.values(components)) {
      if (value !== undefined && typeof value === 'number') {
        factorCount++;
        // Higher confidence for components in the middle range
        const normalizedValue = value / 100;
        totalConfidence += 1 - Math.abs(normalizedValue - 0.5) * 0.5;
      }
    }

    if (factorCount === 0) return 0.5;

    const baseConfidence = totalConfidence / factorCount;

    // Boost confidence if ML model is trained
    const mlBoost = this.neuralScorer.isReady() ? 0.2 : 0;

    return Math.min(1, baseConfidence + mlBoost);
  }

  /**
   * Ensure we have fresh user preferences
   */
  private async ensurePreferences(): Promise<void> {
    if (Date.now() < this.preferencesExpiry) return;

    this.userPreferences = await this.endpoints.user.getPreferences();
    this.temporalPatterns = await this.endpoints.user.getTemporalPatterns();
    this.preferencesExpiry = Date.now() + 5 * 60 * 1000; // 5 minute cache
  }

  /**
   * Get label for a component
   */
  private getComponentLabel(key: string): string {
    const labels: Record<string, string> = {
      basePreference: 'Preference Match',
      mlPrediction: 'ML Prediction',
      audioMatch: 'Audio Match',
      moodMatch: 'Mood Match',
      harmonicFlow: 'Harmonic Flow',
      temporalFit: 'Time Match',
      sessionFlow: 'Session Flow',
      activityMatch: 'Activity Match',
      explorationBonus: 'Discovery Bonus',
      serendipityScore: 'Serendipity',
      diversityScore: 'Diversity',
      recentPlayPenalty: 'Recent Play',
      dislikePenalty: 'Dislike',
      repetitionPenalty: 'Repetition',
    };
    return labels[key] || key;
  }

  /**
   * Get reason for a component value
   */
  private getComponentReason(key: string, value: number): string {
    const isHigh = value > 70;
    const isLow = value < 30;

    const reasons: Record<string, { high: string; low: string; neutral: string }> = {
      basePreference: {
        high: 'Artist and genre match your taste',
        low: 'Less familiar artist/genre',
        neutral: 'Moderate match to your taste',
      },
      mlPrediction: {
        high: 'ML model predicts high preference',
        low: 'ML model predicts lower preference',
        neutral: 'Neutral ML prediction',
      },
      audioMatch: {
        high: 'Similar audio characteristics',
        low: 'Different sound profile',
        neutral: 'Moderate audio similarity',
      },
    };

    const componentReasons = reasons[key];
    if (!componentReasons) return '';

    return isHigh ? componentReasons.high : isLow ? componentReasons.low : componentReasons.neutral;
  }

  /**
   * Generate summary for explanation
   */
  private generateSummary(score: TrackScore): string {
    const { finalScore, explanation } = score;

    if (finalScore >= 80) {
      return `Highly recommended: ${explanation.slice(0, 2).join(', ')}`;
    } else if (finalScore >= 60) {
      return `Good match: ${explanation.slice(0, 2).join(', ')}`;
    } else if (finalScore >= 40) {
      return 'Moderate recommendation';
    } else {
      return 'Lower priority recommendation';
    }
  }

  /**
   * Calculate session average score
   */
  private calculateSessionAverage(): number {
    if (this.recentScores.size === 0) return 50;

    let total = 0;
    for (const score of this.recentScores.values()) {
      total += score.finalScore;
    }
    return total / this.recentScores.size;
  }
}
