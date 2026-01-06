/**
 * Media Folders & Downloads API type definitions
 */

import type { SuccessResponse, UnifiedTrack, Timestamp } from './common.types';

/** Media folder type */
export type MediaFolderType = 'audio' | 'video' | 'downloads';

/** Media folder entity */
export interface MediaFolder {
  id: string;
  path: string;
  name: string;
  type: MediaFolderType;
  trackCount: number;
  totalSize: number;          // bytes
  watchEnabled: boolean;
  scanInterval?: number;      // minutes
  lastScannedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Scan status */
export interface ScanStatus {
  scanning: boolean;
  folderId?: string;
  folderPath?: string;
  progress: number;           // 0-100
  stage?: 'discovering' | 'analyzing' | 'indexing' | 'finalizing';
  filesFound: number;
  filesProcessed: number;
  newTracks: number;
  updatedTracks: number;
  errors: number;
  startedAt?: Timestamp;
  estimatedCompletion?: Timestamp;
}

/** Scan options */
export interface ScanOptions {
  forceRescan?: boolean;
  includeVideos?: boolean;
  waitForCompletion?: boolean;
}

/** Filesystem node (for browsing) */
export interface FilesystemNode {
  name: string;
  path: string;
  type: 'directory' | 'file';
  size?: number;              // bytes
  modifiedAt?: Timestamp;
  isAccessible: boolean;
}

/** Filesystem root */
export interface FilesystemRoot {
  name: string;
  path: string;
  type: 'drive' | 'home' | 'documents' | 'music' | 'downloads';
  totalSpace?: number;        // bytes
  freeSpace?: number;         // bytes
}

/** Download status */
export type DownloadStatus = 'queued' | 'downloading' | 'completed' | 'failed' | 'cancelled';

/** Download entity */
export interface Download {
  id: string;
  url: string;
  filename: string;
  extension: string;
  folderId?: string;
  folderPath?: string;
  status: DownloadStatus;
  progress: number;           // 0-100
  downloadedBytes: number;
  totalBytes?: number;
  speed?: number;             // bytes per second
  error?: string;
  trackData?: Partial<UnifiedTrack>;
  sourceType: string;
  createdAt: Timestamp;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
}

/** Download history entry */
export interface DownloadHistoryEntry extends Download {
  localPath?: string;
  trackId?: string;
}

/** Media watcher status */
export interface MediaWatcherStatus {
  enabled: boolean;
  watchedFolders: Array<{
    folderId: string;
    path: string;
    isWatching: boolean;
    lastEventAt?: Timestamp;
  }>;
  pendingChanges: number;
}

// Request types
export interface AddMediaFolderRequest {
  path: string;
  type: MediaFolderType;
  name?: string;
  watchEnabled?: boolean;
  scanInterval?: number;
}

export interface UpdateMediaFolderRequest {
  name?: string;
  watchEnabled?: boolean;
  scanInterval?: number;
}

export interface StartDownloadRequest {
  url: string;
  folderId?: string;
  filename: string;
  extension: string;
  metadata?: Partial<UnifiedTrack>;
  sourceType: string;
  trackData?: Partial<UnifiedTrack>;
}

// Response types
export interface MediaFoldersGetAllResponse {
  folders: MediaFolder[];
}

export interface MediaFolderGetResponse extends MediaFolder {}

export interface MediaFolderCreateResponse extends SuccessResponse {
  folder?: MediaFolder;
}

export interface MediaFolderTracksResponse {
  tracks: UnifiedTrack[];
  total: number;
}

export interface MediaScanStartResponse extends SuccessResponse {}

export interface MediaScanStatusResponse extends ScanStatus {}

export interface MediaScanAbortResponse extends SuccessResponse {}

export interface FilesystemBrowseResponse {
  currentPath: string;
  parent?: string;
  directories: FilesystemNode[];
  files?: FilesystemNode[];
}

export interface FilesystemRootsResponse {
  roots: FilesystemRoot[];
}

export interface DownloadStartResponse extends SuccessResponse {
  downloadId?: string;
}

export interface DownloadsActiveResponse {
  active: Download[];
  queued: Download[];
}

export interface DownloadsHistoryResponse {
  downloads: DownloadHistoryEntry[];
}

export interface DownloadCancelResponse extends SuccessResponse {}

export interface MediaWatcherStatusResponse extends MediaWatcherStatus {}

export interface LocalTrackArtworkResponse {
  data: string;             // base64 encoded image
  mimeType: string;
}
