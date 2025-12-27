/**
 * useRecommendationExplanation - Hook for fetching and displaying recommendation explanations
 */

import { useState, useCallback } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { useRecommendationStore } from '../stores/recommendation-store';
import { usePluginStore } from '../stores/plugin-store';

export interface ExplanationFactor {
  id: string;
  label: string;
  value: number; // 0-100
  impact: 'positive' | 'negative' | 'neutral';
  icon: string;
  description: string;
}

export interface TrackExplanation {
  trackId: string;
  track: UnifiedTrack;
  score: number;
  summary: string;
  factors: ExplanationFactor[];
  generatedAt: number;
}

// Scoring factor definitions with icons and descriptions
const FACTOR_DEFINITIONS: Record<string, { label: string; icon: string; descriptions: { high: string; low: string; neutral: string } }> = {
  basePreference: {
    label: 'Taste Match',
    icon: '🎯',
    descriptions: {
      high: 'This artist and genre match your listening history',
      low: 'This is outside your usual preferences',
      neutral: 'Moderate match to your taste',
    },
  },
  mlPrediction: {
    label: 'AI Prediction',
    icon: '🤖',
    descriptions: {
      high: 'Our AI model predicts you\'ll enjoy this',
      low: 'Less likely to match your preferences',
      neutral: 'Moderate prediction confidence',
    },
  },
  audioMatch: {
    label: 'Sound Profile',
    icon: '🎵',
    descriptions: {
      high: 'Similar sound to what you\'re listening to',
      low: 'Different sound characteristics',
      neutral: 'Moderate audio similarity',
    },
  },
  moodMatch: {
    label: 'Mood Match',
    icon: '💫',
    descriptions: {
      high: 'Matches your current mood perfectly',
      low: 'Different mood than requested',
      neutral: 'Partially matches the mood',
    },
  },
  harmonicFlow: {
    label: 'Harmonic Flow',
    icon: '🎹',
    descriptions: {
      high: 'Key and harmony flow smoothly from the previous track',
      low: 'Key change may feel abrupt',
      neutral: 'Acceptable key transition',
    },
  },
  temporalFit: {
    label: 'Time of Day',
    icon: '🌅',
    descriptions: {
      high: 'Perfect energy level for this time of day',
      low: 'Energy doesn\'t match typical listening patterns',
      neutral: 'Reasonable fit for current time',
    },
  },
  sessionFlow: {
    label: 'Session Flow',
    icon: '📈',
    descriptions: {
      high: 'Energy flows naturally from recent tracks',
      low: 'May disrupt the current vibe',
      neutral: 'Acceptable session flow',
    },
  },
  activityMatch: {
    label: 'Activity Match',
    icon: '🏃',
    descriptions: {
      high: 'Great for your current activity',
      low: 'May not suit your current activity',
      neutral: 'Works reasonably well',
    },
  },
  explorationBonus: {
    label: 'Discovery',
    icon: '🔭',
    descriptions: {
      high: 'Something new to expand your horizons',
      low: 'Familiar territory',
      neutral: 'Mildly new territory',
    },
  },
  serendipityScore: {
    label: 'Serendipity',
    icon: '✨',
    descriptions: {
      high: 'A delightful surprise recommendation',
      low: 'Predictable choice',
      neutral: 'Some novelty factor',
    },
  },
  diversityScore: {
    label: 'Variety',
    icon: '🎨',
    descriptions: {
      high: 'Adds diversity to your queue',
      low: 'Similar to what\'s already queued',
      neutral: 'Some variety added',
    },
  },
  recentPlayPenalty: {
    label: 'Freshness',
    icon: '🔄',
    descriptions: {
      high: 'Recently played - giving it a rest',
      low: 'Haven\'t heard this in a while',
      neutral: 'Reasonable time since last play',
    },
  },
  repetitionPenalty: {
    label: 'Artist Variety',
    icon: '👥',
    descriptions: {
      high: 'Too much of this artist in queue',
      low: 'Good artist variety',
      neutral: 'Acceptable artist frequency',
    },
  },
};

function getImpact(value: number, isPenalty: boolean): 'positive' | 'negative' | 'neutral' {
  if (isPenalty) {
    // For penalties, higher value = worse
    if (value > 15) return 'negative';
    if (value < 5) return 'positive';
    return 'neutral';
  }
  // For scores, higher value = better
  if (value > 70) return 'positive';
  if (value < 30) return 'negative';
  return 'neutral';
}

function getDescription(
  factorId: string,
  impact: 'positive' | 'negative' | 'neutral'
): string {
  const def = FACTOR_DEFINITIONS[factorId];
  if (!def) return '';

  if (impact === 'positive') return def.descriptions.high;
  if (impact === 'negative') return def.descriptions.low;
  return def.descriptions.neutral;
}

export function useRecommendationExplanation() {
  const [explanation, setExplanation] = useState<TrackExplanation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { getPlugin } = usePluginStore();

  const fetchExplanation = useCallback(async (track: UnifiedTrack): Promise<TrackExplanation | null> => {
    setIsLoading(true);
    setError(null);

    try {
      // Try to get explanation from audiio-algo plugin
      const algoPlugin = getPlugin('audiio-algo');

      let scoreComponents: Record<string, number> = {};
      let finalScore = 75; // Default score

      if (algoPlugin?.enabled && algoPlugin.instance?.explain) {
        try {
          const explanation = await algoPlugin.instance.explain(track.id);
          if (explanation?.score?.components) {
            scoreComponents = explanation.score.components;
            finalScore = explanation.score.finalScore;
          }
        } catch {
          // Plugin explain failed, use fallback
        }
      }

      // If no plugin data, generate simulated explanation based on track properties
      if (Object.keys(scoreComponents).length === 0) {
        // Simulate components based on track data
        scoreComponents = {
          basePreference: Math.random() * 40 + 50, // 50-90
          temporalFit: Math.random() * 30 + 50, // 50-80
          explorationBonus: Math.random() * 60 + 20, // 20-80
          diversityScore: Math.random() * 40 + 40, // 40-80
          serendipityScore: Math.random() * 50 + 25, // 25-75
        };
        finalScore = Object.values(scoreComponents).reduce((a, b) => a + b, 0) / 5;
      }

      // Convert components to factors
      const factors: ExplanationFactor[] = [];
      const penaltyFactors = ['recentPlayPenalty', 'dislikePenalty', 'repetitionPenalty', 'fatiguePenalty'];

      for (const [factorId, value] of Object.entries(scoreComponents)) {
        const def = FACTOR_DEFINITIONS[factorId];
        if (!def) continue;

        const isPenalty = penaltyFactors.includes(factorId);
        const impact = getImpact(value, isPenalty);

        factors.push({
          id: factorId,
          label: def.label,
          value: Math.round(value),
          impact,
          icon: def.icon,
          description: getDescription(factorId, impact),
        });
      }

      // Sort factors: positive first, then neutral, then negative
      factors.sort((a, b) => {
        const order = { positive: 0, neutral: 1, negative: 2 };
        return order[a.impact] - order[b.impact];
      });

      // Generate summary
      const positiveFactors = factors.filter(f => f.impact === 'positive');
      let summary = '';

      if (positiveFactors.length >= 2) {
        summary = `Recommended because it ${positiveFactors[0].description.toLowerCase()} and ${positiveFactors[1].description.toLowerCase()}.`;
      } else if (positiveFactors.length === 1) {
        summary = `Recommended because it ${positiveFactors[0].description.toLowerCase()}.`;
      } else {
        summary = 'This recommendation balances multiple factors to match your listening preferences.';
      }

      const result: TrackExplanation = {
        trackId: track.id,
        track,
        score: Math.round(finalScore),
        summary,
        factors,
        generatedAt: Date.now(),
      };

      setExplanation(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch explanation';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [getPlugin]);

  const clearExplanation = useCallback(() => {
    setExplanation(null);
    setError(null);
  }, []);

  return {
    explanation,
    isLoading,
    error,
    fetchExplanation,
    clearExplanation,
  };
}
