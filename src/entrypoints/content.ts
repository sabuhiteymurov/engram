// Engram Content Script - Article Extraction (runs in ISOLATED world)
import { extractArticle } from '../lib/extractor';
import { extractProductPage, detectPageType } from '../lib/reviewExtractor';
import { convertToMarkdown } from '../lib/markdown';
import { generateFilename } from '../lib/filesystem';
import { DEFAULT_TEMPLATES, findMatchingTemplate } from '../lib/templates';
import type { ExtractedArticle, ExtractedProductPage } from '../lib/types';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    console.log('[Engram Content] Content script loaded');

    // Listen for messages from background/popup
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      console.log('[Engram Content] Received message:', message);

      if (message.action === 'extractArticle') {
        console.log('[Engram Content] Extracting article...');
        handleExtractArticle().then((result) => {
          console.log('[Engram Content] Extract result:', result);
          sendResponse(result);
        });
        return true; // Keep channel open for async response
      }

      if (message.action === 'extractAndConvert') {
        handleExtractAndConvert().then(sendResponse);
        return true;
      }

      if (message.action === 'getPageType') {
        const pageType = detectPageType(window.location.href);
        sendResponse({ pageType });
        return false;
      }

      // Relay clip-watch registration from popup to background.
      // Popup → background messaging can fail in dev mode, so the popup
      // sends through the content script instead.
      if (message.action === 'registerClipWatch') {
        browser.runtime
          .sendMessage({
            action: 'watchPendingClip',
            historyId: message.historyId,
          })
          .then(() => sendResponse({ ok: true }))
          .catch((err: unknown) => {
            console.warn('[Engram Content] Failed to relay clip watch:', err);
            sendResponse({ ok: false });
          });
        return true;
      }

      // Background sends article data + AI summary for markdown conversion.
      // Used when popup closed mid-clip and background generated the summary.
      if (message.action === 'convertWithSummary') {
        const { article, summary, templateId } = message as {
          action: string;
          article: ExtractedArticle;
          summary: string | null;
          templateId?: string;
        };
        handleConvertWithSummary(article, summary, templateId).then(sendResponse);
        return true;
      }

      if (message.action === 'extractProductPage') {
        handleExtractProductPage().then((result) => {
          sendResponse(result);
        });
        return true; // Keep channel open for async response
      }

      return false;
    });
  },
});

async function handleExtractProductPage(): Promise<{
  success: boolean;
  data?: ExtractedProductPage;
  error?: string;
}> {
  try {
    const result = extractProductPage(document, window.location.href);

    if (!result) {
      return {
        success: false,
        error: 'Could not extract product information from this page',
      };
    }

    console.log(
      '[Engram Content] Product extracted:',
      result.product.title,
      `(${result.reviews.length} reviews)`,
    );

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('[Engram Content] Product extraction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function handleExtractArticle(): Promise<{
  success: boolean;
  data?: ExtractedArticle;
  error?: string;
}> {
  try {
    console.log(
      '[Engram Content] Starting article extraction for:',
      window.location.href,
    );
    const article = extractArticle(document, window.location.href);

    if (!article) {
      console.log('[Engram Content] Could not extract article');
      return {
        success: false,
        error: 'Could not extract article content from this page',
      };
    }

    console.log(
      '[Engram Content] Article extracted successfully:',
      article.metadata.title,
    );
    return {
      success: true,
      data: article,
    };
  } catch (error) {
    console.error('[Engram Content] Article extraction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function handleExtractAndConvert(): Promise<{
  success: boolean;
  data?: { markdown: string; filename: string };
  error?: string;
}> {
  try {
    const article = extractArticle(document, window.location.href);
    if (!article) {
      return {
        success: false,
        error: 'Could not extract article content from this page',
      };
    }

    const template = findMatchingTemplate(
      window.location.href,
      DEFAULT_TEMPLATES,
    );
    const clipped = convertToMarkdown(article, null, [], [], template);
    const filename = generateFilename(
      '{{date}} {{title}}',
      article.metadata.title,
    );

    return {
      success: true,
      data: { markdown: clipped.markdown, filename },
    };
  } catch (error) {
    console.error('[Engram Content] Extract and convert error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function handleConvertWithSummary(
  article: ExtractedArticle,
  summary: string | null,
  templateId?: string,
): Promise<{
  success: boolean;
  data?: { markdown: string; filename: string };
  error?: string;
}> {
  try {
    const template = templateId
      ? DEFAULT_TEMPLATES.find((t) => t.id === templateId) || DEFAULT_TEMPLATES[0]
      : findMatchingTemplate(window.location.href, DEFAULT_TEMPLATES);

    const clipped = convertToMarkdown(article, summary, [], [], template);
    const filename = generateFilename(
      '{{date}} {{title}}',
      article.metadata.title,
    );

    return {
      success: true,
      data: { markdown: clipped.markdown, filename },
    };
  } catch (error) {
    console.error('[Engram Content] Convert with summary error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

