// Engram Background Service Worker
import { isAmazonProductUrl } from '../lib/reviewExtractor';
import {
  createHistoryEntry,
  addHistoryEntry,
  updateHistoryEntry,
  getHistory,
} from '../lib/history';

// Inline helpers to avoid importing DOM-dependent modules (Turndown etc.)
function sanitizeBgFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

function makeBgFilename(title: string): string {
  const date = new Date().toISOString().split('T')[0];
  const sanitized = sanitizeBgFilename(title);
  return `${date} ${sanitized || 'Untitled'}`;
}

function buildSelectionMarkdown(
  text: string,
  url: string,
  title: string,
): string {
  const date = new Date().toISOString().split('T')[0];
  const safeTitle = title.replace(/"/g, '\\"');
  return `---
title: "Selection from ${safeTitle}"
source: "${url}"
clipped: ${new Date().toISOString()}
type: selection
---

# Selection from ${title}

> ${text}

---
*Clipped from [${title}](${url}) on ${date}*
`;
}

async function saveViaDownloads(
  markdown: string,
  filename: string,
): Promise<void> {
  const dataUrl =
    'data:text/markdown;charset=utf-8,' + encodeURIComponent(markdown);
  await browser.downloads.download({
    url: dataUrl,
    filename: `Engram/${filename}.md`,
    conflictAction: 'uniquify',
  });
}

export default defineBackground(() => {
  // Create context menus on install
  browser.runtime.onInstalled.addListener(() => {
    // Context menu for page
    browser.contextMenus.create({
      id: 'clip-page',
      title: 'Clip Page',
      contexts: ['page'],
    });

    // Context menu for selection
    browser.contextMenus.create({
      id: 'clip-selection',
      title: 'Clip Selection',
      contexts: ['selection'],
    });

    console.log('Engram: Context menus created');
  });

  // Update badge when tab URL changes
  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url || changeInfo.status === 'complete') {
      updateBadgeForTab(tabId, tab.url);
    }
  });

  // Update badge when switching tabs
  browser.tabs.onActivated.addListener(async (activeInfo) => {
    const tab = await browser.tabs.get(activeInfo.tabId);
    updateBadgeForTab(activeInfo.tabId, tab.url);
  });

  function updateBadgeForTab(tabId: number, url: string | undefined) {
    if (!url) {
      browser.action.setBadgeText({ text: '', tabId });
      return;
    }

    if (isAmazonProductUrl(url)) {
      browser.action.setBadgeText({ text: '🛒', tabId });
      browser.action.setBadgeBackgroundColor({ color: '#7c5cff', tabId });
    } else {
      browser.action.setBadgeText({ text: '', tabId });
    }
  }

  // Handle context menu clicks — complete the clip entirely in the background
  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab?.id) return;

    if (info.menuItemId === 'clip-page') {
      const entry = createHistoryEntry(
        tab.title || 'Untitled Page',
        tab.url || '',
        'Article',
      );
      await addHistoryEntry(entry);

      try {
        // Ask content script to extract article AND convert to markdown
        const response = await browser.tabs.sendMessage(tab.id, {
          action: 'extractAndConvert',
        });

        if (!response?.success || !response?.data) {
          throw new Error(
            response?.error || 'Failed to extract article',
          );
        }

        const { markdown, filename } = response.data as {
          markdown: string;
          filename: string;
        };

        await saveViaDownloads(markdown, filename);

        const fileSize = new TextEncoder().encode(markdown).byteLength;
        await updateHistoryEntry(entry.id, { status: 'success', fileSize });
      } catch (err) {
        await updateHistoryEntry(entry.id, {
          status: 'error',
          errorMessage:
            err instanceof Error
              ? err.message
              : 'Content script not available. Try refreshing the page.',
        });
      }
    } else if (info.menuItemId === 'clip-selection') {
      const entry = createHistoryEntry(
        tab.title || 'Untitled Page',
        tab.url || '',
        'Selection',
      );
      await addHistoryEntry(entry);

      try {
        const selectedText = info.selectionText || '';
        if (!selectedText) {
          throw new Error('No text selected');
        }

        const markdown = buildSelectionMarkdown(
          selectedText,
          tab.url || '',
          tab.title || 'Untitled Page',
        );
        const filename = makeBgFilename(
          `Selection from ${tab.title || 'Untitled Page'}`,
        );

        await saveViaDownloads(markdown, filename);

        const fileSize = new TextEncoder().encode(markdown).byteLength;
        await updateHistoryEntry(entry.id, { status: 'success', fileSize });
      } catch (err) {
        await updateHistoryEntry(entry.id, {
          status: 'error',
          errorMessage:
            err instanceof Error ? err.message : 'Failed to clip selection',
        });
      }
    }
  });

  // Handle messages from content script and popup
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'openPopup') {
      browser.action.openPopup();
    }

    // Content script relays a clip-watch request from the popup.
    if (message.action === 'watchPendingClip') {
      const { historyId } = message as { action: string; historyId: string };
      const tabId = _sender.tab?.id;
      if (tabId != null) {
        console.log('[Engram BG] watchPendingClip received:', historyId, 'tab:', tabId);
        scheduleClipWatchdog(historyId, tabId);
      }
      sendResponse({ ok: true });
      return true;
    }

    return false;
  });

  // ── Popup-close fallback ──
  // The popup registers a watchdog BEFORE extraction (via content-script relay).
  // After 15 s the watchdog checks the history entry:
  //   • status changed → popup completed it, nothing to do.
  //   • still "processing" → popup is gone, background takes over.

  function scheduleClipWatchdog(historyId: string, tabId: number): void {
    setTimeout(async () => {
      try {
        const history = await getHistory();
        const entry = history.find((e) => e.id === historyId);

        if (!entry || entry.status !== 'processing') {
          console.log('[Engram BG] Watchdog: clip already resolved:', historyId, entry?.status);
          return;
        }

        console.log('[Engram BG] Watchdog: still processing after timeout, taking over:', historyId);
        await completePendingClip(historyId, tabId);
      } catch (err) {
        console.error('[Engram BG] Watchdog error:', err);
      }
    }, 15_000);
  }

  // Try to generate an AI summary using the LanguageModel API in the service worker.
  // Chrome 131+ exposes the Prompt API in service workers as a global.
  // Returns null if the API is unavailable or the summary fails.
  async function tryGenerateSummaryInBackground(
    textContent: string,
  ): Promise<string | null> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = globalThis as any;

      // Try new LanguageModel API (global in service workers)
      if (g.LanguageModel?.create) {
        console.log('[Engram BG] LanguageModel API available in service worker');
        const session = await g.LanguageModel.create({
          systemPrompt:
            'You summarize articles concisely. Provide 3-5 sentences summaries.',
          outputLanguage: 'en',
        });
        try {
          return await session.prompt(
            `Summarize this article in 3-5 sentences:\n\n${textContent.slice(0, 8000)}`,
          );
        } finally {
          session.destroy();
        }
      }

      // Try old ai.languageModel API
      if (g.ai?.languageModel?.create) {
        console.log(
          '[Engram BG] ai.languageModel API available in service worker',
        );
        const session = await g.ai.languageModel.create({
          systemPrompt:
            'You summarize articles concisely. Provide 3-5 sentences summaries.',
        });
        try {
          return await session.prompt(
            `Summarize this article in 3-5 sentences:\n\n${textContent.slice(0, 8000)}`,
          );
        } finally {
          session.destroy();
        }
      }

      console.log('[Engram BG] No AI API available in service worker');
      return null;
    } catch (err) {
      console.error('[Engram BG] AI summary generation failed:', err);
      return null;
    }
  }

  async function completePendingClip(
    historyId: string,
    tabId: number,
  ): Promise<void> {
    console.log('[Engram BG] completePendingClip:', historyId, 'tab:', tabId);
    // Only take over if the entry is still processing
    const history = await getHistory();
    const entry = history.find((e) => e.id === historyId);
    if (!entry || entry.status !== 'processing') {
      console.log(
        '[Engram BG] Skipping — entry status:',
        entry?.status ?? 'not found',
      );
      return;
    }

    try {
      let markdown: string;
      let filename: string;

      const stored = await browser.storage.local.get('pendingClipData');
      const clipData = stored.pendingClipData;

      if (clipData?.markdown) {
        // Stage 2: Complete markdown from popup (includes AI summary)
        console.log(
          '[Engram BG] Using popup-generated markdown (with AI summary)',
        );
        ({ markdown, filename } = clipData as {
          markdown: string;
          filename: string;
        });
      } else if (clipData?.article) {
        // Stage 1: Popup stored article data before AI step — try AI in background
        console.log(
          '[Engram BG] Article data found — attempting AI summary in service worker',
        );
        const { article, templateId } = clipData as {
          article: {
            metadata: Record<string, unknown>;
            content: string;
            textContent: string;
          };
          templateId?: string;
        };

        const summary = await tryGenerateSummaryInBackground(
          article.textContent,
        );
        console.log(
          '[Engram BG] AI summary:',
          summary ? 'generated' : 'not available',
        );

        // Send article + summary to content script for Turndown conversion
        const response = await browser.tabs.sendMessage(tabId, {
          action: 'convertWithSummary',
          article,
          summary,
          templateId,
        });

        if (!response?.success || !response?.data) {
          throw new Error(
            response?.error || 'Failed to convert article to markdown',
          );
        }
        ({ markdown, filename } = response.data as {
          markdown: string;
          filename: string;
        });
      } else {
        // No cached data — re-extract from content script (no AI)
        console.log(
          '[Engram BG] No cached data — re-extracting without AI summary',
        );
        const response = await browser.tabs.sendMessage(tabId, {
          action: 'extractAndConvert',
        });
        if (!response?.success || !response?.data) {
          throw new Error(response?.error || 'Failed to extract article');
        }
        ({ markdown, filename } = response.data as {
          markdown: string;
          filename: string;
        });
      }

      await saveViaDownloads(markdown, filename);
      await browser.storage.local.remove('pendingClipData');

      const fileSize = new TextEncoder().encode(markdown).byteLength;
      await updateHistoryEntry(historyId, { status: 'success', fileSize });
    } catch (err) {
      await updateHistoryEntry(historyId, {
        status: 'error',
        errorMessage:
          err instanceof Error
            ? err.message
            : 'Clip failed after popup closed',
      });
    }
  }

  console.log('Engram: Background script initialized');
});
