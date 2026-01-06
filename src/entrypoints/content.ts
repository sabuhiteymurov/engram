// Engram Content Script - Article Extraction (runs in ISOLATED world)
import { extractArticle, extractSelection } from '../lib/extractor';
import type { ExtractedArticle } from '../lib/types';

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

      if (message.action === 'clipPage') {
        handleClipPage();
        return false;
      }

      if (message.action === 'clipSelection') {
        handleClipSelection(message.selectedText);
        return false;
      }

      if (message.action === 'getSelection') {
        const selection = extractSelection();
        sendResponse({ selection });
        return false;
      }

      return false;
    });
  },
});

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

async function handleClipPage(): Promise<void> {
  await browser.runtime.sendMessage({ action: 'openPopup' });
}

async function handleClipSelection(selectedText?: string): Promise<void> {
  const text = selectedText || extractSelection();
  if (!text) {
    console.log('[Engram Content] No text selected');
    return;
  }

  await browser.storage.local.set({
    pendingClip: {
      type: 'selection',
      text,
      url: window.location.href,
      title: document.title,
    },
  });

  await browser.runtime.sendMessage({ action: 'openPopup' });
}
