/**
 * ColorPicker - A simple color picker component
 */

import React, { useState, useRef, useEffect } from 'react';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  label?: string;
}

// Preset colors for quick selection
const PRESET_COLORS = [
  '#1db954', // Green (default)
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#3b82f6', // Blue
  '#f97316', // Orange
  '#ef4444', // Red
  '#14b8a6', // Teal
  '#f59e0b', // Amber
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#ffffff', // White
  '#000000', // Black
];

export const ColorPicker: React.FC<ColorPickerProps> = ({ color, onChange, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(color);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(color);
  }, [color]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    // Validate hex color
    if (/^#[0-9A-Fa-f]{6}$/.test(value) || /^#[0-9A-Fa-f]{3}$/.test(value)) {
      onChange(value);
    }
  };

  const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    onChange(value);
  };

  const handlePresetClick = (presetColor: string) => {
    setInputValue(presetColor);
    onChange(presetColor);
  };

  return (
    <div className="color-picker" ref={pickerRef}>
      {label && <label className="color-picker-label">{label}</label>}
      <div className="color-picker-trigger" onClick={() => setIsOpen(!isOpen)}>
        <div
          className="color-picker-swatch"
          style={{ backgroundColor: color }}
        />
        <input
          type="text"
          className="color-picker-input"
          value={inputValue}
          onChange={handleInputChange}
          onClick={(e) => e.stopPropagation()}
          placeholder="#000000"
        />
      </div>

      {isOpen && (
        <div className="color-picker-dropdown">
          <div className="color-picker-native-wrapper">
            <input
              type="color"
              className="color-picker-native"
              value={color}
              onChange={handleNativeChange}
            />
            <span className="color-picker-native-label">Pick custom color</span>
          </div>

          <div className="color-picker-presets">
            <span className="color-picker-presets-label">Quick colors</span>
            <div className="color-picker-presets-grid">
              {PRESET_COLORS.map((presetColor) => (
                <button
                  key={presetColor}
                  className={`color-picker-preset ${color === presetColor ? 'active' : ''}`}
                  style={{ backgroundColor: presetColor }}
                  onClick={() => handlePresetClick(presetColor)}
                  title={presetColor}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ColorPicker;
