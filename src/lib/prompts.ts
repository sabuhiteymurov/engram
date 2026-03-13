// Centralized AI prompts for Engram
// All prompts used by the AI module are defined here for easy maintenance

// ============================================
// System Prompts (define AI behavior)
// ============================================

export const SYSTEM_PROMPTS = {
  DEFAULT: 'You are a helpful assistant that summarizes and analyzes web content.',

  SUMMARIZER: (length: string) =>
    `You summarize articles concisely. Provide ${length} summaries.`,

  KEY_TAKEAWAYS:
    'You extract key takeaways from articles as bullet points. Return only the bullet points, one per line.',

  TAG_SUGGESTER:
    'You suggest relevant tags for articles. Return only lowercase tags separated by commas.',

  REVIEW_ANALYZER:
    'You analyze product reviews. Reviews may be in any language — always output in English. Extract key pros, cons, and quality issues. Be concise. Output JSON only.',

  REVIEW_SYNTHESIZER:
    'You synthesize product review analysis into a final verdict. Always output in English. Be concise and helpful for purchase decisions.',
} as const;

// ============================================
// User Prompts (actual tasks)
// ============================================

export const USER_PROMPTS = {
  summarize: (content: string, length: string) =>
    `Summarize this article in ${length}:\n\n${content.slice(0, 8000)}`,

  extractKeyTakeaways: (content: string) =>
    `Extract 3-5 key takeaways from this article:\n\n${content.slice(0, 8000)}`,

  suggestTags: (content: string) =>
    `Suggest 3-5 relevant tags for this article:\n\n${content.slice(0, 4000)}`,

  customPrompt: (content: string, prompt: string) =>
    `${prompt}\n\nContent:\n${content.slice(0, 8000)}`,

  analyzeReviewBatch: (reviewsText: string) =>
    `Analyze these product reviews and extract:
1. pros: Array of positive points mentioned (max 5)
2. cons: Array of negative points mentioned (max 5)  
3. issues: Array of quality/defect issues if any (max 3)

Return ONLY valid JSON like: {"pros":["..."],"cons":["..."],"issues":["..."]}

Reviews:
${reviewsText.slice(0, 3500)}`,

  synthesizeReviews: (
    productTitle: string,
    pros: string[],
    cons: string[],
    issues: string[],
  ) =>
    `Synthesize these review insights for "${productTitle}" into a final analysis.

Collected Pros: ${pros.join('; ')}
Collected Cons: ${cons.join('; ')}
Quality Issues: ${issues.join('; ')}

Return ONLY valid JSON with:
{
  "verdict": "One sentence overall recommendation",
  "sentimentScore": 0-100 (higher = more positive),
  "pros": [{"point": "...", "frequency": 1-5}],
  "cons": [{"point": "...", "frequency": 1-5}],
  "qualityAlerts": [{"issue": "...", "severity": "warning|critical"}]
}

Deduplicate similar points. frequency indicates how often mentioned (1=rare, 5=very common).
Only include qualityAlerts if there are recurring defects or serious issues.`,
} as const;

// ============================================
// Length Instructions
// ============================================

export const SUMMARY_LENGTHS = {
  short: '2-3 sentences',
  medium: '3-5 sentences',
  long: '5-7 sentences',
} as const;

export type SummaryLength = keyof typeof SUMMARY_LENGTHS;
