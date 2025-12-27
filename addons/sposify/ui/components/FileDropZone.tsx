/**
 * File Drop Zone Component
 * Drag and drop or click to select files
 */

import React from 'react';

interface FileDropZoneProps {
  selectedFiles: string[];
  selectedFolder: string | null;
  onSelectFiles: () => void;
  onSelectFolder: () => void;
  onClear: () => void;
}

export const FileDropZone: React.FC<FileDropZoneProps> = ({
  selectedFiles,
  selectedFolder,
  onSelectFiles,
  onSelectFolder,
  onClear,
}) => {
  const hasSelection = selectedFiles.length > 0 || selectedFolder !== null;

  const getFileName = (path: string) => {
    return path.split('/').pop() || path.split('\\').pop() || path;
  };

  if (hasSelection) {
    return (
      <div className="sposify-file-selected">
        <div className="selected-info">
          {selectedFolder ? (
            <>
              <span className="icon">📁</span>
              <span className="path">{getFileName(selectedFolder)}</span>
            </>
          ) : (
            <>
              <span className="icon">📄</span>
              <span className="count">{selectedFiles.length} file(s) selected</span>
            </>
          )}
        </div>
        {selectedFiles.length > 0 && (
          <div className="file-list">
            {selectedFiles.map((file, i) => (
              <div key={i} className="file-item">
                {getFileName(file)}
              </div>
            ))}
          </div>
        )}
        <button className="sposify-btn secondary small" onClick={onClear}>
          Clear Selection
        </button>
      </div>
    );
  }

  return (
    <div className="sposify-dropzone">
      <div className="dropzone-content">
        <span className="dropzone-icon">📂</span>
        <p className="dropzone-text">
          Select your Spotify export files or folder
        </p>
        <div className="dropzone-buttons">
          <button className="sposify-btn primary" onClick={onSelectFiles}>
            Select Files
          </button>
          <span className="or">or</span>
          <button className="sposify-btn secondary" onClick={onSelectFolder}>
            Select Folder
          </button>
        </div>
      </div>
    </div>
  );
};

export default FileDropZone;
