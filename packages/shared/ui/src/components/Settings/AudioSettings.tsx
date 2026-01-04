/**
 * AudioSettings - Audio playback configuration
 */

import React from 'react';
import { useSettingsStore } from '../../stores/settings-store';

export const AudioSettings: React.FC = () => {
  const {
    crossfadeEnabled,
    crossfadeDuration,
    setCrossfadeEnabled,
    setCrossfadeDuration,
    normalizeVolume,
    setNormalizeVolume,
  } = useSettingsStore();

  return (
    <div className="audio-settings">
      {/* Crossfade Section */}
      <div className="settings-group">
        <div className="settings-group-header">
          <CrossfadeIcon size={20} />
          <h3>Crossfade</h3>
        </div>

        <div className="settings-option">
          <div className="settings-option-info">
            <h4>Enable Crossfade</h4>
            <p>Smoothly blend between tracks during transitions</p>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={crossfadeEnabled}
              onChange={(e) => setCrossfadeEnabled(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        {crossfadeEnabled && (
          <div className="settings-option">
            <div className="settings-option-info">
              <h4>Duration</h4>
              <p>{crossfadeDuration} seconds</p>
            </div>
            <input
              type="range"
              className="settings-slider"
              min={1}
              max={12}
              step={1}
              value={crossfadeDuration}
              onChange={(e) => setCrossfadeDuration(parseInt(e.target.value))}
            />
          </div>
        )}
      </div>

      {/* Volume Normalization */}
      <div className="settings-group">
        <div className="settings-group-header">
          <VolumeIcon size={20} />
          <h3>Playback</h3>
        </div>

        <div className="settings-option">
          <div className="settings-option-info">
            <h4>Normalize Volume</h4>
            <p>Automatically adjust volume to maintain consistent levels</p>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={normalizeVolume}
              onChange={(e) => setNormalizeVolume(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>
    </div>
  );
};

// Icon Components
const CrossfadeIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z"/>
  </svg>
);

const VolumeIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
  </svg>
);

export default AudioSettings;
