/**
 * Hook to listen for download progress events from the main process
 */

import { useEffect } from 'react';
import { useLibraryStore } from '../stores/library-store';

interface DownloadProgressEvent {
  trackId: string;
  progress: number;
  status: 'downloading' | 'completed' | 'failed';
  filePath?: string;
  error?: string;
}

export function useDownloadProgress(): void {
  const { updateDownloadProgress, completeDownload, failDownload } = useLibraryStore();

  useEffect(() => {
    // Check if API is available
    if (!window.api?.onDownloadProgress) {
      console.log('[useDownloadProgress] Download progress API not available');
      return;
    }

    console.log('[useDownloadProgress] Setting up download progress listener');

    // Subscribe to download progress events
    const unsubscribe = window.api.onDownloadProgress((event: DownloadProgressEvent) => {
      console.log('[useDownloadProgress] Progress event:', event);

      switch (event.status) {
        case 'downloading':
          updateDownloadProgress(event.trackId, event.progress);
          break;
        case 'completed':
          completeDownload(event.trackId, event.filePath || '');
          break;
        case 'failed':
          failDownload(event.trackId, event.error || 'Download failed');
          break;
      }
    });

    // Cleanup on unmount
    return () => {
      console.log('[useDownloadProgress] Cleaning up download progress listener');
      unsubscribe();
    };
  }, [updateDownloadProgress, completeDownload, failDownload]);
}
