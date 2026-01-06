// Chrome's built-in Gemini Nano AI integration
import type { AISession } from './types';

type OutputLanguage = 'en';
const OUTPUT_LANGUAGE: OutputLanguage = 'en';

// Declare global AI APIs
declare global {
  interface Window {
    // New LanguageModel API
    LanguageModel?: {
      availability: (options: {
        languages: string[];
        outputLanguage?: OutputLanguage;
      }) => Promise<string>;
      create: (options?: {
        systemPrompt?: string;
        outputLanguage?: OutputLanguage;
      }) => Promise<AISession>;
    };
    // Old ai.languageModel API
    ai?: {
      languageModel?: {
        capabilities: () => Promise<{ available: string }>;
        create: (options?: { systemPrompt?: string }) => Promise<AISession>;
      };
    };
  }
}

export type AIAvailability = 'available' | 'after-download' | 'unavailable';

export async function checkAIAvailability(): Promise<AIAvailability> {
  console.log('[Engram AI] Checking availability...');
  console.log('[Engram AI] window.LanguageModel:', typeof window.LanguageModel);
  console.log('[Engram AI] window.ai:', typeof window.ai);

  try {
    if (window.LanguageModel?.availability) {
      console.log('[Engram AI] Using LanguageModel.availability API');
      const result = await window.LanguageModel.availability({
        languages: [OUTPUT_LANGUAGE],
        outputLanguage: OUTPUT_LANGUAGE,
      });
      console.log('[Engram AI] LanguageModel.availability result:', result);
      if (result === 'available') return 'available';
      if (result === 'downloadable') return 'after-download';
      return 'unavailable';
    }

    if (window.ai?.languageModel?.capabilities) {
      console.log('[Engram AI] Using ai.languageModel.capabilities API');
      const capabilities = await window.ai.languageModel.capabilities();
      console.log('[Engram AI] capabilities:', capabilities);
      if (capabilities.available === 'readily') return 'available';
      if (capabilities.available === 'after-download') return 'after-download';
      return 'unavailable';
    }

    console.log('[Engram AI] No AI API found');
    return 'unavailable';
  } catch (err) {
    console.error('[Engram AI] Availability check error:', err);
    return 'unavailable';
  }
}

export async function createAISession(
  systemPrompt?: string,
): Promise<AISession | null> {
  const defaultPrompt =
    systemPrompt ||
    'You are a helpful assistant that summarizes and analyzes web content.';

  try {
    // Try new LanguageModel API first
    if (window.LanguageModel?.create) {
      console.log('[Engram AI] Creating LanguageModel session...');
      return await window.LanguageModel.create({
        systemPrompt: defaultPrompt,
        outputLanguage: OUTPUT_LANGUAGE,
      });
    }

    // Try old ai.languageModel API
    if (window.ai?.languageModel?.create) {
      console.log('[Engram AI] Creating ai.languageModel session...');
      return await window.ai.languageModel.create({
        systemPrompt: defaultPrompt,
      });
    }

    console.log('[Engram AI] No AI API available to create session');
    return null;
  } catch (err) {
    console.error('[Engram AI] Session creation error:', err);
    return null;
  }
}

export async function generateSummary(
  content: string,
  length: 'short' | 'medium' | 'long' = 'medium',
): Promise<string | null> {
  const lengthInstructions = {
    short: '2-3 sentences',
    medium: '3-5 sentences',
    long: '5-7 sentences',
  };

  const session = await createAISession(
    `You summarize articles concisely. Provide ${lengthInstructions[length]} summaries.`,
  );

  if (!session) {
    return null;
  }

  try {
    const prompt = `Summarize this article in ${
      lengthInstructions[length]
    }:\n\n${content.slice(0, 8000)}`;
    const summary = await session.prompt(prompt);
    return summary;
  } catch (err) {
    console.error('[Engram AI] Summary generation error:', err);
    return null;
  } finally {
    session.destroy();
  }
}

export async function extractKeyTakeaways(content: string): Promise<string[]> {
  const session = await createAISession(
    'You extract key takeaways from articles as bullet points. Return only the bullet points, one per line.',
  );

  if (!session) {
    return [];
  }

  try {
    const prompt = `Extract 3-5 key takeaways from this article:\n\n${content.slice(
      0,
      8000,
    )}`;
    const result = await session.prompt(prompt);
    return result
      .split('\n')
      .map((line) => line.replace(/^[-*•]\s*/, '').trim())
      .filter((line) => line.length > 0);
  } catch {
    return [];
  } finally {
    session.destroy();
  }
}

export async function suggestTags(content: string): Promise<string[]> {
  const session = await createAISession(
    'You suggest relevant tags for articles. Return only lowercase tags separated by commas.',
  );

  if (!session) {
    return [];
  }

  try {
    const prompt = `Suggest 3-5 relevant tags for this article:\n\n${content.slice(
      0,
      4000,
    )}`;
    const result = await session.prompt(prompt);
    return result
      .split(',')
      .map((tag) =>
        tag
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, ''),
      )
      .filter((tag) => tag.length > 0);
  } catch {
    return [];
  } finally {
    session.destroy();
  }
}

export async function runCustomPrompt(
  content: string,
  prompt: string,
): Promise<string | null> {
  const session = await createAISession();

  if (!session) {
    return null;
  }

  try {
    const fullPrompt = `${prompt}\n\nContent:\n${content.slice(0, 8000)}`;
    return await session.prompt(fullPrompt);
  } catch {
    return null;
  } finally {
    session.destroy();
  }
}
