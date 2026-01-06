import { useState, useEffect } from 'react';
import { checkAIAvailability, generateSummary } from '@lib/ai';

export type AIStatus = 'checking' | 'available' | 'unavailable';

interface UseAIReturn {
  status: AIStatus;
  generateSummary: (content: string) => Promise<string | null>;
}

export function useAI(): UseAIReturn {
  const [status, setStatus] = useState<AIStatus>('checking');

  useEffect(() => {
    checkAvailability();
  }, []);

  async function checkAvailability() {
    try {
      const result = await checkAIAvailability();
      const isAvailable = result === 'available' || result === 'after-download';
      setStatus(isAvailable ? 'available' : 'unavailable');
    } catch (error) {
      console.error('[useAI] Error checking availability:', error);
      setStatus('unavailable');
    }
  }

  return {
    status,
    generateSummary,
  };
}
