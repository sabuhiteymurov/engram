import { useState, useCallback } from 'react';
import { synthesizeReviews, type SynthesisProgress } from '@lib/ai';
import { generateReviewMarkdown, generateReviewFilename } from '@lib/markdown';
import { saveMarkdownFile } from '@lib/filesystem';
import { getSettings } from '@lib/storage';
import type {
  PageType,
  ProductInfo,
  ExtractedProductPage,
  ReviewSynthesis,
} from '@lib/types';

interface UseReviewSynthesisReturn {
  pageType: PageType;
  product: ProductInfo | null;
  synthesis: ReviewSynthesis | null;
  progress: SynthesisProgress | null;
  isLoading: boolean;
  error: string | null;
  detectPageType: () => Promise<PageType>;
  runSynthesis: () => Promise<void>;
  copyToClipboard: () => Promise<boolean>;
  saveToVault: (vaultHandle: FileSystemDirectoryHandle) => Promise<boolean>;
  getMarkdown: () => string | null;
  getFilename: () => string | null;
  reset: () => void;
}

export function useReviewSynthesis(): UseReviewSynthesisReturn {
  const [pageType, setPageType] = useState<PageType>('unknown');
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [synthesis, setSynthesis] = useState<ReviewSynthesis | null>(null);
  const [progress, setProgress] = useState<SynthesisProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detectPageType = useCallback(async (retryCount = 0): Promise<PageType> => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 300;

    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab?.id) {
        setPageType('unknown');
        return 'unknown';
      }

      let response;
      try {
        response = await browser.tabs.sendMessage(tab.id, {
          action: 'getPageType',
        });
      } catch (sendErr) {
        // Content script not ready yet - try to inject or retry
        const errMsg = sendErr instanceof Error ? sendErr.message : String(sendErr);
        if (
          errMsg.includes('Could not establish connection') ||
          errMsg.includes('Receiving end does not exist')
        ) {
          // Try to inject content script
          try {
            await browser.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content-scripts/content.js'],
            });
            await new Promise((resolve) => setTimeout(resolve, 100));
            response = await browser.tabs.sendMessage(tab.id, {
              action: 'getPageType',
            });
          } catch {
            // Script injection failed, retry after delay if page might still be loading
            if (retryCount < MAX_RETRIES) {
              await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
              return detectPageType(retryCount + 1);
            }
            setPageType('article');
            return 'article';
          }
        } else {
          throw sendErr;
        }
      }

      const detected = response?.pageType || 'article';
      setPageType(detected);
      return detected;
    } catch (err) {
      console.error('[useReviewSynthesis] Page type detection error:', err);
      setPageType('article');
      return 'article';
    }
  }, []);

  const extractProduct = useCallback(async (): Promise<ExtractedProductPage | null> => {
    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab?.id) return null;

      const response = await browser.tabs.sendMessage(tab.id, {
        action: 'extractProductPage',
      });

      if (!response?.success || !response.data) {
        setError(response?.error || 'Failed to extract product page');
        return null;
      }

      return response.data;
    } catch (err) {
      console.error('[useReviewSynthesis] Product extraction error:', err);
      setError('Failed to communicate with page');
      return null;
    }
  }, []);

  const runSynthesis = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSynthesis(null);
    setProgress({
      stage: 'extracting',
      current: 0,
      total: 0,
      message: 'Extracting product reviews...',
    });

    try {
      // Extract product page data
      const productData = await extractProduct();

      if (!productData) {
        setIsLoading(false);
        return;
      }

      setProduct(productData.product);

      if (productData.reviews.length === 0) {
        setError('No reviews found on this page. Try navigating to the reviews section.');
        setIsLoading(false);
        return;
      }

      // Run AI synthesis with progress callback
      const result = await synthesizeReviews(
        productData.reviews,
        productData.product.title,
        setProgress,
      );

      if (result) {
        setSynthesis(result);
      } else {
        setError('Failed to synthesize reviews. Please try again.');
      }
    } catch (err) {
      console.error('[useReviewSynthesis] Synthesis error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [extractProduct]);

  const reset = useCallback(() => {
    setProduct(null);
    setSynthesis(null);
    setProgress(null);
    setError(null);
  }, []);

  const getMarkdown = useCallback((): string | null => {
    if (!product || !synthesis) return null;
    return generateReviewMarkdown(product, synthesis);
  }, [product, synthesis]);

  const getFilename = useCallback((): string | null => {
    if (!product) return null;
    return generateReviewFilename(product.title);
  }, [product]);

  const copyToClipboard = useCallback(async (): Promise<boolean> => {
    const markdown = getMarkdown();
    if (!markdown) return false;

    try {
      await navigator.clipboard.writeText(markdown);
      return true;
    } catch (err) {
      console.error('[useReviewSynthesis] Clipboard error:', err);
      return false;
    }
  }, [getMarkdown]);

  const saveToVault = useCallback(async (
    vaultHandle: FileSystemDirectoryHandle,
  ): Promise<boolean> => {
    const markdown = getMarkdown();
    const filename = getFilename();
    if (!markdown || !filename) return false;

    try {
      const settings = await getSettings();
      await saveMarkdownFile(
        vaultHandle,
        settings.vault.defaultFolder,
        filename,
        markdown,
      );
      return true;
    } catch (err) {
      console.error('[useReviewSynthesis] Save error:', err);
      return false;
    }
  }, [getMarkdown, getFilename]);

  return {
    pageType,
    product,
    synthesis,
    progress,
    isLoading,
    error,
    detectPageType,
    runSynthesis,
    copyToClipboard,
    saveToVault,
    getMarkdown,
    getFilename,
    reset,
  };
}
