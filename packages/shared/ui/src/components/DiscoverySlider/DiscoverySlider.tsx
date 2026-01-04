/**
 * DiscoverySlider - Controls how adventurous recommendations should be
 *
 * A visual slider that adjusts between "familiar favorites" and "new discoveries"
 * Uses the epsilon-greedy exploration parameter in the ML algorithm.
 */

import React, { useCallback, useState, useEffect } from 'react';
import { usePluginStore } from '../../stores/plugin-store';

interface DiscoverySliderProps {
  /** Compact mode for inline use */
  compact?: boolean;
  /** Show labels */
  showLabels?: boolean;
  /** Custom className */
  className?: string;
}

// Map slider positions to exploration levels
const LEVEL_MAP = {
  0: { value: 'low', label: 'Familiar', description: 'Stick to your favorites' },
  25: { value: 'low', label: 'Familiar', description: 'Stick to your favorites' },
  50: { value: 'balanced', label: 'Balanced', description: 'Mix of favorites and discoveries' },
  75: { value: 'high', label: 'Adventurous', description: 'Discover new music' },
  100: { value: 'high', label: 'Maximum', description: 'Maximum exploration' },
} as const;

// Get closest level from slider value
function getLevelFromValue(value: number): typeof LEVEL_MAP[keyof typeof LEVEL_MAP] {
  if (value <= 12) return LEVEL_MAP[0];
  if (value <= 37) return LEVEL_MAP[25];
  if (value <= 62) return LEVEL_MAP[50];
  if (value <= 87) return LEVEL_MAP[75];
  return LEVEL_MAP[100];
}

// Get slider value from level
function getValueFromLevel(level: string): number {
  switch (level) {
    case 'low': return 25;
    case 'balanced': return 50;
    case 'high': return 75;
    default: return 50;
  }
}

export const DiscoverySlider: React.FC<DiscoverySliderProps> = ({
  compact = false,
  showLabels = true,
  className = '',
}) => {
  const { getPluginSettings, updatePluginSetting, getPluginsByRole } = usePluginStore();

  // Get first audio-processor plugin (the algorithm plugin)
  const algorithmPlugins = getPluginsByRole('audio-processor');
  const algorithmPlugin = algorithmPlugins[0];
  const algorithmPluginId = algorithmPlugin?.id;
  const settings = algorithmPluginId ? getPluginSettings(algorithmPluginId) : undefined;

  // Get current level from settings
  const currentLevel = (settings?.explorationLevel as string) || 'balanced';
  const [sliderValue, setSliderValue] = useState(getValueFromLevel(currentLevel));
  const [isDragging, setIsDragging] = useState(false);

  // Sync with settings
  useEffect(() => {
    if (!isDragging) {
      setSliderValue(getValueFromLevel(currentLevel));
    }
  }, [currentLevel, isDragging]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setSliderValue(value);
  }, []);

  const handleChangeComplete = useCallback(() => {
    setIsDragging(false);
    const level = getLevelFromValue(sliderValue);
    if (algorithmPluginId) {
      updatePluginSetting(algorithmPluginId, 'explorationLevel', level.value);
    }
  }, [sliderValue, updatePluginSetting, algorithmPluginId]);

  const currentLevelInfo = getLevelFromValue(sliderValue);

  if (compact) {
    return (
      <div className={`discovery-slider-compact ${className}`}>
        <div className="discovery-slider-header">
          <span className="discovery-slider-label">{currentLevelInfo.label}</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={sliderValue}
          onChange={handleChange}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={handleChangeComplete}
          onTouchStart={() => setIsDragging(true)}
          onTouchEnd={handleChangeComplete}
          className="discovery-slider-input"
          style={{
            '--slider-progress': `${sliderValue}%`,
          } as React.CSSProperties}
        />
      </div>
    );
  }

  return (
    <div className={`discovery-slider ${className}`}>
      <div className="discovery-slider-header">
        <span className="discovery-slider-title">Discovery Level</span>
        <span className="discovery-slider-value">{currentLevelInfo.label}</span>
      </div>

      <div className="discovery-slider-track-container">
        <input
          type="range"
          min="0"
          max="100"
          value={sliderValue}
          onChange={handleChange}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={handleChangeComplete}
          onTouchStart={() => setIsDragging(true)}
          onTouchEnd={handleChangeComplete}
          className="discovery-slider-input"
          style={{
            '--slider-progress': `${sliderValue}%`,
          } as React.CSSProperties}
        />

        {showLabels && (
          <div className="discovery-slider-labels">
            <span className="discovery-label left">Familiar</span>
            <span className="discovery-label center">Balanced</span>
            <span className="discovery-label right">Explore</span>
          </div>
        )}
      </div>

      <p className="discovery-slider-description">{currentLevelInfo.description}</p>
    </div>
  );
};

/**
 * Mini version for Discover page header
 */
export const DiscoverySliderMini: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { getPluginSettings, updatePluginSetting, getPluginsByRole } = usePluginStore();

  // Get first audio-processor plugin (the algorithm plugin)
  const algorithmPlugins = getPluginsByRole('audio-processor');
  const algorithmPlugin = algorithmPlugins[0];
  const algorithmPluginId = algorithmPlugin?.id;
  const settings = algorithmPluginId ? getPluginSettings(algorithmPluginId) : undefined;
  const currentLevel = (settings?.explorationLevel as string) || 'balanced';

  const handleCycle = useCallback(() => {
    const nextLevel =
      currentLevel === 'low' ? 'balanced' :
      currentLevel === 'balanced' ? 'high' : 'low';
    if (algorithmPluginId) {
      updatePluginSetting(algorithmPluginId, 'explorationLevel', nextLevel);
    }
  }, [currentLevel, updatePluginSetting, algorithmPluginId]);

  const icons = {
    low: '🏠',
    balanced: '🎯',
    high: '🔭',
  };

  const labels = {
    low: 'Familiar',
    balanced: 'Balanced',
    high: 'Explore',
  };

  return (
    <button
      className={`discovery-toggle ${className}`}
      onClick={handleCycle}
      title={`Discovery: ${labels[currentLevel as keyof typeof labels]} (click to cycle)`}
    >
      <span className="discovery-toggle-icon">{icons[currentLevel as keyof typeof icons]}</span>
      <span className="discovery-toggle-label">{labels[currentLevel as keyof typeof labels]}</span>
    </button>
  );
};

export default DiscoverySlider;
