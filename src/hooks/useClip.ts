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
  ) => Promise<boolean>;
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

      const response = await browser.tabs.sendMessage(tab.id, {
        action: 'extractArticle',
      });

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
    ): Promise<boolean> => {
      setIsSaving(true);
      setError(null);

      try {
        const settings = await getSettings();

        await saveMarkdownFile(
          vaultHandle,
          settings.vault.defaultFolder,
          clipResult.filename,
          clipResult.markdown,
        );

        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save';
        setError(message);
        return false;
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
