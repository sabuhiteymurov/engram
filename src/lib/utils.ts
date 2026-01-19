// Utility functions for Engram

/**
 * Robustly extract and parse JSON from AI response text.
 * Tries multiple strategies:
 * 1. Direct JSON.parse (if response is clean JSON)
 * 2. Balanced bracket extraction (finds properly nested JSON objects)
 * 3. Code block extraction (finds JSON in ```json blocks)
 * 4. Falls back to null if no valid JSON found
 */
export function extractJSON<T = unknown>(text: string): T | null {
  // Strategy 1: Try parsing the entire response directly
  try {
    return JSON.parse(text.trim());
  } catch {
    // Continue to other strategies
  }

  // Strategy 2: Find JSON using balanced bracket matching
  const jsonCandidates: string[] = [];
  let depth = 0;
  let startIndex = -1;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    if (char === '{') {
      if (depth === 0) {
        startIndex = i;
      }
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0 && startIndex !== -1) {
        // Found a complete JSON object candidate
        jsonCandidates.push(text.slice(startIndex, i + 1));
        startIndex = -1;
      }
    }
  }

  // Try parsing each candidate (prefer the first valid one)
  for (const candidate of jsonCandidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try next candidate
    }
  }

  // Strategy 3: Try to find JSON within code blocks (```json ... ```)
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {
      // Continue
    }
  }

  console.warn('[Engram] Could not extract valid JSON from text:', text.slice(0, 200));
  return null;
}
