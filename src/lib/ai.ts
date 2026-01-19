import type { AISession } from './types';
import {
  SYSTEM_PROMPTS,
  USER_PROMPTS,
  SUMMARY_LENGTHS,
  type SummaryLength,
} from './prompts';

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
  const prompt = systemPrompt || SYSTEM_PROMPTS.DEFAULT;

  try {
    // Try new LanguageModel API first
    if (window.LanguageModel?.create) {
      console.log('[Engram AI] Creating LanguageModel session...');
      return await window.LanguageModel.create({
        systemPrompt: prompt,
        outputLanguage: OUTPUT_LANGUAGE,
      });
    }

    // Try old ai.languageModel API
    if (window.ai?.languageModel?.create) {
      console.log('[Engram AI] Creating ai.languageModel session...');
      return await window.ai.languageModel.create({
        systemPrompt: prompt,
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
  length: SummaryLength = 'medium',
): Promise<string | null> {
  const lengthInstruction = SUMMARY_LENGTHS[length];

  const session = await createAISession(
    SYSTEM_PROMPTS.SUMMARIZER(lengthInstruction),
  );

  if (!session) {
    return null;
  }

  try {
    const prompt = USER_PROMPTS.summarize(content, lengthInstruction);
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
  const session = await createAISession(SYSTEM_PROMPTS.KEY_TAKEAWAYS);

  if (!session) {
    return [];
  }

  try {
    const prompt = USER_PROMPTS.extractKeyTakeaways(content);
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
  const session = await createAISession(SYSTEM_PROMPTS.TAG_SUGGESTER);

  if (!session) {
    return [];
  }

  try {
    const prompt = USER_PROMPTS.suggestTags(content);
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
  userPrompt: string,
): Promise<string | null> {
  const session = await createAISession();

  if (!session) {
    return null;
  }

  try {
    const fullPrompt = USER_PROMPTS.customPrompt(content, userPrompt);
    return await session.prompt(fullPrompt);
  } catch {
    return null;
  } finally {
    session.destroy();
  }
}

// ============================================
// Review Synthesis (Progressive Batching)
// ============================================

import type {
  ExtractedReview,
  ReviewSynthesis,
  SynthesizedPro,
  SynthesizedCon,
  QualityAlert,
} from './types';

import { extractJSON } from './utils';

const REVIEWS_PER_BATCH = 5;

interface BatchResult {
  pros: string[];
  cons: string[];
  issues: string[];
}

/**
 * Analyze a batch of reviews and extract pros, cons, and issues
 */
async function analyzeBatch(reviews: ExtractedReview[]): Promise<BatchResult | null> {
  const session = await createAISession(SYSTEM_PROMPTS.REVIEW_ANALYZER);

  if (!session) return null;

  try {
    const reviewsText = reviews
      .map((r, i) => `Review ${i + 1} (${r.rating}★${r.isVerified ? ', verified' : ''}): ${r.text}`)
      .join('\n\n');

    const prompt = USER_PROMPTS.analyzeReviewBatch(reviewsText);
    const result = await session.prompt(prompt);
    
    // Parse JSON response using robust extraction
    const parsed = extractJSON<{ pros?: string[]; cons?: string[]; issues?: string[] }>(result);
    if (!parsed) return null;
    
    return {
      pros: Array.isArray(parsed.pros) ? parsed.pros : [],
      cons: Array.isArray(parsed.cons) ? parsed.cons : [],
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
    };
  } catch (err) {
    console.error('[Engram AI] Batch analysis error:', err);
    return null;
  } finally {
    session.destroy();
  }
}

/**
 * Merge multiple batch results into final synthesis
 */
async function mergeBatchResults(
  batchResults: BatchResult[],
  productTitle: string,
  totalReviews: number,
): Promise<ReviewSynthesis | null> {
  const session = await createAISession(SYSTEM_PROMPTS.REVIEW_SYNTHESIZER);

  if (!session) return null;

  try {
    // Collect all points from batches
    const allPros = batchResults.flatMap(b => b.pros);
    const allCons = batchResults.flatMap(b => b.cons);
    const allIssues = batchResults.flatMap(b => b.issues);

    const prompt = USER_PROMPTS.synthesizeReviews(
      productTitle,
      allPros,
      allCons,
      allIssues,
    );

    const result = await session.prompt(prompt);
    
    // Parse JSON response using robust extraction
    interface SynthesisResponse {
      verdict?: string;
      sentimentScore?: number;
      pros?: (SynthesizedPro | string)[];
      cons?: (SynthesizedCon | string)[];
      qualityAlerts?: QualityAlert[];
    }
    
    const parsed = extractJSON<SynthesisResponse>(result);
    if (!parsed) return null;
    
    return {
      verdict: parsed.verdict || 'Unable to generate verdict',
      sentimentScore: Math.min(100, Math.max(0, parsed.sentimentScore || 50)),
      pros: (parsed.pros || []).map((p) => 
        typeof p === 'string' ? { point: p, frequency: 1 } : p
      ),
      cons: (parsed.cons || []).map((c) => 
        typeof c === 'string' ? { point: c, frequency: 1 } : c
      ),
      qualityAlerts: (parsed.qualityAlerts || []).filter(
        (a) => a.issue && a.severity
      ),
      reviewsAnalyzed: totalReviews,
    };
  } catch (err) {
    console.error('[Engram AI] Merge error:', err);
    return null;
  } finally {
    session.destroy();
  }
}

export interface SynthesisProgress {
  stage: 'extracting' | 'analyzing' | 'merging' | 'complete' | 'error';
  current: number;
  total: number;
  message: string;
}

export type ProgressCallback = (progress: SynthesisProgress) => void;

/**
 * Synthesize reviews using progressive batching
 */
export async function synthesizeReviews(
  reviews: ExtractedReview[],
  productTitle: string,
  onProgress?: ProgressCallback,
): Promise<ReviewSynthesis | null> {
  if (reviews.length === 0) {
    onProgress?.({
      stage: 'error',
      current: 0,
      total: 0,
      message: 'No reviews to analyze',
    });
    return null;
  }

  // Limit to top reviews to fit context window
  const reviewsToAnalyze = reviews.slice(0, 20);
  const totalBatches = Math.ceil(reviewsToAnalyze.length / REVIEWS_PER_BATCH);

  onProgress?.({
    stage: 'analyzing',
    current: 0,
    total: totalBatches,
    message: `Analyzing ${reviewsToAnalyze.length} reviews...`,
  });

  // Process reviews in batches
  const batchResults: BatchResult[] = [];
  
  for (let i = 0; i < reviewsToAnalyze.length; i += REVIEWS_PER_BATCH) {
    const batch = reviewsToAnalyze.slice(i, i + REVIEWS_PER_BATCH);
    const batchNum = Math.floor(i / REVIEWS_PER_BATCH) + 1;

    onProgress?.({
      stage: 'analyzing',
      current: batchNum,
      total: totalBatches,
      message: `Analyzing batch ${batchNum}/${totalBatches}...`,
    });

    const result = await analyzeBatch(batch);
    if (result) {
      batchResults.push(result);
    }
  }

  if (batchResults.length === 0) {
    onProgress?.({
      stage: 'error',
      current: 0,
      total: 0,
      message: 'Failed to analyze reviews',
    });
    return null;
  }

  // Merge batch results
  onProgress?.({
    stage: 'merging',
    current: totalBatches,
    total: totalBatches,
    message: 'Synthesizing final verdict...',
  });

  const synthesis = await mergeBatchResults(
    batchResults,
    productTitle,
    reviewsToAnalyze.length,
  );

  if (synthesis) {
    onProgress?.({
      stage: 'complete',
      current: totalBatches,
      total: totalBatches,
      message: 'Analysis complete',
    });
  } else {
    onProgress?.({
      stage: 'error',
      current: 0,
      total: 0,
      message: 'Failed to synthesize results',
    });
  }

  return synthesis;
}
