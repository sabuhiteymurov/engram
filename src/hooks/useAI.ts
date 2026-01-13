import { useState, useEffect, useCallback } from 'react';
import { checkAIAvailability, generateSummary } from '@lib/ai';

export type AIStatus = 'checking' | 'available' | 'downloading' | 'unavailable';

interface UseAIReturn {
  status: AIStatus;
  generateSummary: (content: string) => Promise<string | null>;
  recheckAvailability: () => Promise<void>;
}

export function useAI(): UseAIReturn {
  const [status, setStatus] = useState<AIStatus>('checking');

  const checkAvailability = useCallback(async () => {
    try {
      const result = await checkAIAvailability();
      if (result === 'available') {
        setStatus('available');
      } else if (result === 'after-download') {
        setStatus('downloading');
      } else {
        setStatus('unavailable');
      }
    } catch (error) {
      console.error('[useAI] Error checking availability:', error);
      setStatus('unavailable');
    }
  }, []);

  useEffect(() => {
    checkAvailability();
  }, [checkAvailability]);

  const recheckAvailability = useCallback(async () => {
    setStatus('checking');
    await checkAvailability();
  }, [checkAvailability]);

  return {
    status,
    generateSummary,
    recheckAvailability,
  };
}
