import React, { useState, useEffect } from 'react';
import './TitleBar.css';

declare global {
  interface Window {
    api: {
      windowMinimize: () => Promise<void>;
      windowMaximize: () => Promise<void>;
      windowClose: () => Promise<void>;
      windowIsMaximized: () => Promise<boolean>;
      onWindowMaximizedChange: (callback: (isMaximized: boolean) => void) => () => void;
      getPlatform: () => Promise<string>;
    };
  }
}

export const TitleBar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [platform, setPlatform] = useState<string>('win32');

  useEffect(() => {
    // Get initial state
    window.api.windowIsMaximized().then(setIsMaximized);
    window.api.getPlatform().then(setPlatform);

    // Listen for maximize changes
    const unsubscribe = window.api.onWindowMaximizedChange(setIsMaximized);
    return unsubscribe;
  }, []);

  const handleMinimize = () => {
    window.api.windowMinimize();
  };

  const handleMaximize = () => {
    window.api.windowMaximize();
  };

  const handleClose = () => {
    window.api.windowClose();
  };

  // On macOS, the traffic lights are built-in, so we only need the drag region
  if (platform === 'darwin') {
    return (
      <div className="title-bar title-bar--macos">
        <div className="title-bar__drag-region" />
      </div>
    );
  }

  // Windows/Linux - custom window controls
  return (
    <div className="title-bar">
      <div className="title-bar__drag-region" />
      <div className="title-bar__controls">
        <button
          className="title-bar__button title-bar__button--minimize"
          onClick={handleMinimize}
          aria-label="Minimize"
        >
          <svg width="10" height="1" viewBox="0 0 10 1">
            <rect width="10" height="1" fill="currentColor" />
          </svg>
        </button>
        <button
          className="title-bar__button title-bar__button--maximize"
          onClick={handleMaximize}
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? (
            // Restore icon (two overlapping squares)
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                d="M2 3v6h6V3H2zm1-2h6v6"
              />
            </svg>
          ) : (
            // Maximize icon (single square)
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect
                x="0.5"
                y="0.5"
                width="9"
                height="9"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
              />
            </svg>
          )}
        </button>
        <button
          className="title-bar__button title-bar__button--close"
          onClick={handleClose}
          aria-label="Close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path
              fill="currentColor"
              d="M1.41 0L5 3.59 8.59 0 10 1.41 6.41 5 10 8.59 8.59 10 5 6.41 1.41 10 0 8.59 3.59 5 0 1.41z"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default TitleBar;
