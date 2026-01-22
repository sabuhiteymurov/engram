import { useState, useEffect, useCallback, useRef } from 'react';
import {
  checkAIAvailability,
  generateSummary,
  downloadModel,
  type DownloadProgress,
} from '@lib/ai';

export type AIStatus =
  | 'checking'
  | 'available'
  | 'downloadable'
  | 'downloading'
  | 'unavailable';

interface UseAIReturn {
  status: AIStatus;
  downloadProgress: DownloadProgress | null;
  generateSummary: (content: string) => Promise<string | null>;
  recheckAvailability: () => Promise<void>;
  triggerDownload: () => Promise<boolean>;
}

export function useAI(): UseAIReturn {
  const [status, setStatus] = useState<AIStatus>('checking');
  const [downloadProgress, setDownloadProgress] =
    useState<DownloadProgress | null>(null);
  const isDownloadingRef = useRef(false);

  // Start or join a download
  const startDownload = useCallback(async () => {
    if (isDownloadingRef.current) {
      return true; // Already downloading
    }

    isDownloadingRef.current = true;
    setStatus('downloading');

    const success = await downloadModel((progress) => {
      setDownloadProgress(progress);
    });

    isDownloadingRef.current = false;

    if (success) {
      setStatus('available');
      setDownloadProgress(null);
    }

    return success;
  }, []);

  const checkAvailability = useCallback(async () => {
    try {
      const result = await checkAIAvailability();
      if (result === 'available') {
        setStatus('available');
        setDownloadProgress(null);
      } else if (result === 'downloading') {
        // Chrome is already downloading the model, join the download
        startDownload();
      } else if (result === 'after-download') {
        setStatus('downloadable');
      } else {
        setStatus('unavailable');
      }
    } catch (error) {
      console.error('[useAI] Error checking availability:', error);
      setStatus('unavailable');
    }
  }, [startDownload]);

  // Initial availability check
  useEffect(() => {
    checkAvailability();
  }, [checkAvailability]);

  // Periodic check while downloading to detect completion
  useEffect(() => {
    if (status !== 'downloading') return;

    const interval = setInterval(async () => {
      const result = await checkAIAvailability();
      if (result === 'available') {
        isDownloadingRef.current = false;
        setStatus('available');
        setDownloadProgress(null);
      }
    }, 3000); // Check every 3 seconds

    return () => clearInterval(interval);
  }, [status]);

  const recheckAvailability = useCallback(async () => {
    setStatus('checking');
    await checkAvailability();
  }, [checkAvailability]);

  const triggerDownload = useCallback(async () => {
    if (status !== 'downloadable' && status !== 'downloading') {
      return false;
    }

    return startDownload();
  }, [status, startDownload]);

  return {
    status,
    downloadProgress,
    generateSummary,
    recheckAvailability,
    triggerDownload,
  };
}
