/**
 * AudioFeaturesPanel Component
 * Visualizes audio features from Spotify/Sposify data
 */

import React, { useEffect } from 'react';
import { useSposifyStore, AudioFeatures } from '../stores';
import './AudioFeaturesPanel.css';

interface AudioFeaturesPanelProps {
  spotifyId?: string;
  features?: AudioFeatures;
  compact?: boolean;
  showLabels?: boolean;
}

// Musical key names
const KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Feature definitions with colors and descriptions
const FEATURE_DEFS = {
  danceability: {
    label: 'Danceability',
    color: '#1db954',
    description: 'How suitable for dancing based on tempo, rhythm, and beat strength',
  },
  energy: {
    label: 'Energy',
    color: '#ff6b6b',
    description: 'Perceptual intensity and activity level',
  },
  valence: {
    label: 'Mood',
    color: '#feca57',
    description: 'Musical positiveness (happy vs sad)',
  },
  acousticness: {
    label: 'Acoustic',
    color: '#48dbfb',
    description: 'Whether the track is acoustic',
  },
  instrumentalness: {
    label: 'Instrumental',
    color: '#a55eea',
    description: 'Likelihood of no vocal content',
  },
  speechiness: {
    label: 'Speechiness',
    color: '#ff9ff3',
    description: 'Presence of spoken words',
  },
  liveness: {
    label: 'Live',
    color: '#54a0ff',
    description: 'Probability of live recording',
  },
};

export const AudioFeaturesPanel: React.FC<AudioFeaturesPanelProps> = ({
  spotifyId,
  features: propFeatures,
  compact = false,
  showLabels = true,
}) => {
  const { audioFeaturesCache, getAudioFeatures } = useSposifyStore();

  // Load features if spotifyId provided but not in cache
  useEffect(() => {
    if (spotifyId && !propFeatures && !audioFeaturesCache[spotifyId]) {
      getAudioFeatures(spotifyId);
    }
  }, [spotifyId, propFeatures, audioFeaturesCache, getAudioFeatures]);

  const features = propFeatures || (spotifyId ? audioFeaturesCache[spotifyId] : null);

  if (!features) {
    return (
      <div className={`sposify-audio-features ${compact ? 'compact' : ''}`}>
        <div className="features-empty">
          <span>No audio features available</span>
        </div>
      </div>
    );
  }

  const formatTempo = (bpm: number): string => {
    return `${Math.round(bpm)} BPM`;
  };

  const formatKey = (key: number, mode: number): string => {
    if (key < 0 || key > 11) return 'Unknown';
    const keyName = KEY_NAMES[key];
    const modeName = mode === 1 ? 'Major' : 'Minor';
    return `${keyName} ${modeName}`;
  };

  const renderBar = (value: number, featureKey: string) => {
    const def = FEATURE_DEFS[featureKey as keyof typeof FEATURE_DEFS];
    if (!def) return null;

    const percentage = Math.round(value * 100);

    return (
      <div className="feature-bar-row" key={featureKey}>
        {showLabels && (
          <span className="feature-label" title={def.description}>
            {def.label}
          </span>
        )}
        <div className="feature-bar-container">
          <div
            className="feature-bar"
            style={{
              width: `${percentage}%`,
              backgroundColor: def.color,
            }}
          />
        </div>
        <span className="feature-value">{percentage}%</span>
      </div>
    );
  };

  if (compact) {
    return (
      <div className="sposify-audio-features compact">
        <div className="features-compact-grid">
          <div className="compact-item" title="Tempo">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2v20l-1-1-9-9 10-10zm2 16v2h8v-2h-8zm0-6v2h6v-2h-6zm0-6v2h8V6h-8z" />
            </svg>
            <span>{formatTempo(features.tempo)}</span>
          </div>
          <div className="compact-item" title="Key">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3l.01 10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4.01 4S14 19.21 14 17V7h4V3h-6z" />
            </svg>
            <span>{formatKey(features.key, features.mode)}</span>
          </div>
          <div className="compact-item energy" title={`Energy: ${Math.round(features.energy * 100)}%`}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 2v11h3v9l7-12h-4l4-8z" />
            </svg>
            <span>{Math.round(features.energy * 100)}%</span>
          </div>
          <div className="compact-item valence" title={`Mood: ${Math.round(features.valence * 100)}%`}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="9" cy="9" r="1.5" />
              <circle cx="15" cy="9" r="1.5" />
            </svg>
            <span>{Math.round(features.valence * 100)}%</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sposify-audio-features">
      <div className="features-header">
        <h4>Audio Features</h4>
        <div className="features-key-tempo">
          <span className="tempo">{formatTempo(features.tempo)}</span>
          <span className="key">{formatKey(features.key, features.mode)}</span>
        </div>
      </div>

      <div className="features-bars">
        {renderBar(features.danceability, 'danceability')}
        {renderBar(features.energy, 'energy')}
        {renderBar(features.valence, 'valence')}
        {renderBar(features.acousticness, 'acousticness')}
        {renderBar(features.instrumentalness, 'instrumentalness')}
        {renderBar(features.speechiness, 'speechiness')}
        {renderBar(features.liveness, 'liveness')}
      </div>

      <div className="features-loudness">
        <span className="loudness-label">Loudness</span>
        <span className="loudness-value">{features.loudness.toFixed(1)} dB</span>
      </div>
    </div>
  );
};

export default AudioFeaturesPanel;
