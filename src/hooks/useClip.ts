import { useState, useCallback } from 'react';
import type { ExtractedArticle, Template } from '@lib/types';
import { convertToMarkdown } from '@lib/markdown';
import { generateFilename, saveMarkdownFile } from '@lib/filesystem';
import { getSettings } from '@lib/storage';

export interface ClipResult {
  article: ExtractedArticle;
  markdown: string;
  filename: string;
  summary: string | null;
}

interface UseClipReturn {
  isExtracting: boolean;
  isSummarizing: boolean;
  isSaving: boolean;
  error: string | null;
  result: ClipResult | null;
  extract: () => Promise<ExtractedArticle | null>;
  generatePreview: (
    article: ExtractedArticle,
    template: Template,
    summary?: string | null,
  ) => ClipResult;
  save: (
    result: ClipResult,
    vaultHandle: FileSystemDirectoryHandle,
  ) => Promise<{ ok: boolean; errorMessage?: string }>;
  reset: () => void;
}

export function useClip(): UseClipReturn {
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ClipResult | null>(null);

  const extract = useCallback(async (): Promise<ExtractedArticle | null> => {
    setIsExtracting(true);
    setError(null);

    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab?.id) {
        setError('No active tab found');
        return null;
      }

      // Check if the tab URL is a restricted page
      const url = tab.url || '';
      if (
        url.startsWith('chrome://') ||
        url.startsWith('chrome-extension://') ||
        url.startsWith('about:') ||
        url.startsWith('edge://') ||
        url.startsWith('moz-extension://')
      ) {
        setError('Cannot clip browser internal pages');
        return null;
      }

      let response;
      try {
        response = await browser.tabs.sendMessage(tab.id, {
          action: 'extractArticle',
        });
      } catch (sendErr) {
        // Content script not loaded - try to inject it
        const errMsg =
          sendErr instanceof Error ? sendErr.message : String(sendErr);
        if (
          errMsg.includes('Could not establish connection') ||
          errMsg.includes('Receiving end does not exist')
        ) {
          // Try to inject content script dynamically
          try {
            await browser.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content-scripts/content.js'],
            });
            // Wait a moment for the script to initialize
            await new Promise((resolve) => setTimeout(resolve, 100));
            // Retry the message
            response = await browser.tabs.sendMessage(tab.id, {
              action: 'extractArticle',
            });
          } catch {
            setError(
              'Content script not loaded. Please refresh the page and try again.',
            );
            return null;
          }
        } else {
          throw sendErr;
        }
      }

      if (!response?.success || !response?.data) {
        setError(response?.error || 'Failed to extract article');
        return null;
      }

      return response.data as ExtractedArticle;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return null;
    } finally {
      setIsExtracting(false);
    }
  }, []);

  const generatePreview = useCallback(
    (
      article: ExtractedArticle,
      template: Template,
      summary: string | null = null,
    ): ClipResult => {
      const clipped = convertToMarkdown(article, summary, [], [], template);

      // Get filename template from settings synchronously (use default if not available)
      const filenameTemplate = '{{date}} {{title}}';
      const filename = generateFilename(
        filenameTemplate,
        article.metadata.title,
      );

      const clipResult: ClipResult = {
        article,
        markdown: clipped.markdown,
        filename,
        summary,
      };

      setResult(clipResult);
      return clipResult;
    },
    [],
  );

  const save = useCallback(
    async (
      clipResult: ClipResult,
      vaultHandle: FileSystemDirectoryHandle,
    ): Promise<{ ok: boolean; errorMessage?: string }> => {
      setIsSaving(true);
      setError(null);

      try {
        const settings = await getSettings();

        // Race against a timeout so a hanging FS call never blocks forever
        const savePromise = saveMarkdownFile(
          vaultHandle,
          settings.vault.defaultFolder,
          clipResult.filename,
          clipResult.markdown,
        );
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Save timed out after 15 seconds. The export folder may be inaccessible — try re-selecting it in Settings.')),
            15_000,
          ),
        );
        await Promise.race([savePromise, timeoutPromise]);

        return { ok: true };
      } catch (err) {
        console.error('[Engram] Save failed:', err);
        let message = 'Failed to save';
        if (err instanceof DOMException) {
          console.error('[Engram] DOMException name:', err.name, 'message:', err.message);
          if (err.name === 'NotFoundError') {
            message =
              'Export folder not found. It may have been moved or deleted. Please select a new folder in Settings.';
          } else if (err.name === 'NotAllowedError') {
            message =
              'Permission denied. Please grant access to the export folder.';
          } else {
            message = err.message || 'Failed to write file';
          }
        } else if (err instanceof Error) {
          message = err.message;
        }
        setError(message);
        return { ok: false, errorMessage: message };
      } finally {
        setIsSaving(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setError(null);
    setResult(null);
    setIsExtracting(false);
    setIsSummarizing(false);
    setIsSaving(false);
  }, []);

  return {
    isExtracting,
    isSummarizing,
    isSaving,
    error,
    result,
    extract,
    generatePreview,
    save,
    reset,
  };
}
