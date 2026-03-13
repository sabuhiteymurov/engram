// Engram Background Service Worker

import {
  createHistoryEntry,
  addHistoryEntry,
  updateHistoryEntry,
  getHistory,
} from '../lib/history';
import { isAmazonProductUrl } from '../lib/reviewExtractor';

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

  // Icon dot indicator — draws a small colored dot on the extension icon
  const iconCache = new Map<string, ImageData>();
  const baseBitmapCache = new Map<number, ImageBitmap>();

  async function getBaseBitmap(size: number): Promise<ImageBitmap> {
    const cached = baseBitmapCache.get(size);
    if (cached) return cached;
    const iconPath = { 16: '/icon/16.png', 32: '/icon/32.png', 48: '/icon/48.png' } as const;
    const path = iconPath[size as keyof typeof iconPath];
    const response = await fetch(browser.runtime.getURL(path));
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    baseBitmapCache.set(size, bitmap);
    return bitmap;
  }

  async function getIconWithDot(size: number, color: string): Promise<ImageData> {
    const key = `${color}-${size}`;
    const cached = iconCache.get(key);
    if (cached) return cached;

    const bitmap = await getBaseBitmap(size);
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0, size, size);

    const dotRadius = Math.max(Math.round(size * 0.15), 2);
    const padding = Math.round(size * 0.05);
    const cx = size - dotRadius - padding;
    const cy = size - dotRadius - padding;

    ctx.beginPath();
    ctx.arc(cx, cy, dotRadius + 1, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1b1e';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, dotRadius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    const imageData = ctx.getImageData(0, 0, size, size);
    iconCache.set(key, imageData);
    return imageData;
  }

  const DOT_GREEN = '#10b981';
  const DOT_PENDING = '#f59e0b';
  const clippingTabs = new Set<number>();

  async function setIconWithDot(tabId: number, color: string) {
    try {
      const [icon16, icon32] = await Promise.all([
        getIconWithDot(16, color),
        getIconWithDot(32, color),
      ]);
      await browser.action.setIcon({ imageData: { '16': icon16, '32': icon32 }, tabId });
    } catch (err) {
      console.warn('[Engram BG] Failed to set icon:', err);
    }
  }

  function resetIcon(tabId: number) {
    browser.action.setIcon({ path: { '16': 'icon/16.png', '32': 'icon/32.png', '48': 'icon/48.png' }, tabId }).catch(() => {});
  }

  async function updateIconForTab(tabId: number, url: string | undefined) {
    if (clippingTabs.has(tabId)) {
      await setIconWithDot(tabId, DOT_PENDING);
    } else if (url && isAmazonProductUrl(url)) {
      await setIconWithDot(tabId, DOT_GREEN);
    } else {
      resetIcon(tabId);
    }
  }

  function setClippingState(tabId: number, clipping: boolean) {
    if (clipping) {
      clippingTabs.add(tabId);
      setIconWithDot(tabId, DOT_PENDING);
    } else {
      clippingTabs.delete(tabId);
      // Restore appropriate icon (product dot or default)
      browser.tabs.get(tabId)
        .then((tab) => updateIconForTab(tabId, tab.url))
        .catch(() => resetIcon(tabId));
    }
  }

  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url || changeInfo.status === 'complete') {
      updateIconForTab(tabId, tab.url);
    }
  });

  browser.tabs.onActivated.addListener(async (activeInfo) => {
    try {
      const tab = await browser.tabs.get(activeInfo.tabId);
      updateIconForTab(activeInfo.tabId, tab.url);
    } catch {
      // Tab closed between activation and get — no-op
    }
  });

  // Handle context menu clicks — complete the clip entirely in the background
  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab?.id) return;

    if (info.menuItemId === 'clip-page') {
      const entry = createHistoryEntry(
        tab.title || 'Untitled Page',
        tab.url || '',
        'Article',
        tab.favIconUrl,
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
        tab.favIconUrl,
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

    // Popup signals clip start/end to show the activity dot on the icon
    if (message.action === 'setClippingIcon') {
      const { tabId: tid, clipping } = message as { action: string; tabId: number; clipping: boolean };
      setClippingState(tid, clipping);
      sendResponse({ ok: true });
      return true;
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
  // The popup writes a heartbeat to storage while it's working.
  // The watchdog polls every few seconds; once the heartbeat goes stale
  // (popup closed) AND the entry is still "processing", background takes over.

  function scheduleClipWatchdog(historyId: string, tabId: number): void {
    const INITIAL_DELAY = 10_000;
    const POLL_INTERVAL = 5_000;
    const HEARTBEAT_STALE = 10_000;
    const MAX_WAIT = 5 * 60 * 1000;
    const startTime = Date.now();

    const check = async () => {
      try {
        const history = await getHistory();
        const entry = history.find((e) => e.id === historyId);

        if (!entry || entry.status !== 'processing') return;

        if (Date.now() - startTime >= MAX_WAIT) {
          await completePendingClip(historyId, tabId);
          return;
        }

        const { pendingClipHeartbeat } = await browser.storage.local.get(
          'pendingClipHeartbeat',
        );
        if (
          pendingClipHeartbeat &&
          Date.now() - (pendingClipHeartbeat as number) < HEARTBEAT_STALE
        ) {
          setTimeout(check, POLL_INTERVAL);
          return;
        }

        await completePendingClip(historyId, tabId);
      } catch (err) {
        console.error('[Engram BG] Watchdog error:', err);
      }
    };

    setTimeout(check, INITIAL_DELAY);
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

    setClippingState(tabId, true);

    try {
      let markdown: string;
      let filename: string;

      const stored = await browser.storage.local.get('pendingClipData');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clipData = stored.pendingClipData as Record<string, any> | undefined;

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
      await browser.storage.local.remove([
        'pendingClipData',
        'pendingClipHeartbeat',
      ]);

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
    } finally {
      setClippingState(tabId, false);
    }
  }

  console.log('Engram: Background script initialized');
});
