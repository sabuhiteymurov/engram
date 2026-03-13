import { useState, useCallback } from 'react';
import type { Template, CurrentPage, PendingVaultAction } from '@lib/types';
import {
  createHistoryEntry,
  addHistoryEntry,
  updateHistoryEntry,
} from '@lib/history';
import type { ClipResult } from '@/hooks/useClip';
import type { useVault } from '@/hooks/useVault';
import type { useAI } from '@/hooks/useAI';
import type { useClip } from '@/hooks/useClip';
import type { useReviewSynthesis } from '@/hooks/useReviewSynthesis';

interface ClipOrchestrationDeps {
  vault: ReturnType<typeof useVault>;
  ai: ReturnType<typeof useAI>;
  clip: ReturnType<typeof useClip>;
  reviewSynthesis: ReturnType<typeof useReviewSynthesis>;
  currentPage: CurrentPage | null;
  selectedTemplate: Template;
  tabId: number | null;
}

interface UseClipOrchestrationReturn {
  statusMessage: string | null;
  summary: string | null;
  isSummarizing: boolean;
  showPreview: boolean;
  previewResult: ClipResult | null;
  showVaultAccessPrompt: boolean;
  pendingVaultAction: PendingVaultAction;
  isLoading: boolean;
  setShowPreview: (v: boolean) => void;
  runClipFlow: (opts?: { allowAI?: boolean }) => Promise<void>;
  handleClip: () => Promise<void>;
  handleClipWithoutAI: () => Promise<void>;
  handlePreview: () => Promise<void>;
  handleSaveFromPreview: () => Promise<void>;
  handleGrantAccess: () => Promise<void>;
  handleReviewSave: () => Promise<boolean>;
}

export function useClipOrchestration(
  deps: ClipOrchestrationDeps,
): UseClipOrchestrationReturn {
  const { vault, ai, clip, reviewSynthesis, currentPage, selectedTemplate, tabId } = deps;

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewResult, setPreviewResult] = useState<ClipResult | null>(null);
  const [showVaultAccessPrompt, setShowVaultAccessPrompt] = useState(false);
  const [pendingVaultAction, setPendingVaultAction] =
    useState<PendingVaultAction>(null);

  const isLoading = clip.isExtracting || isSummarizing || clip.isSaving;

  const runClipFlow = useCallback(
    async (opts?: { allowAI?: boolean }) => {
      const entry = createHistoryEntry(
        currentPage?.title || 'Untitled',
        currentPage?.url || '',
        selectedTemplate.name,
        currentPage?.favicon,
      );
      await addHistoryEntry(entry);

      if (tabId != null) {
        browser.tabs
          .sendMessage(tabId, {
            action: 'registerClipWatch',
            historyId: entry.id,
          })
          .catch(() => {});
      }

      await browser.storage.local.set({ pendingClipHeartbeat: Date.now() });
      const heartbeatId = setInterval(() => {
        browser.storage.local.set({ pendingClipHeartbeat: Date.now() });
      }, 4_000);

      try {
        const article = await clip.extract();
        if (!article) {
          throw new Error(clip.error || 'Failed to extract article');
        }

        await browser.storage.local.set({
          pendingClipData: {
            article: {
              metadata: article.metadata,
              content: article.content,
              textContent: article.textContent,
            },
            templateId: selectedTemplate.id,
          },
        });

        let generatedSummary: string | null = null;
        const allowAI = opts?.allowAI ?? true;
        if (allowAI && ai.status === 'available') {
          setIsSummarizing(true);
          setStatusMessage('Generating AI summary...');
          generatedSummary = await ai.generateSummary(article.textContent);
          setSummary(generatedSummary);
          setIsSummarizing(false);
        }

        if (!vault.vaultHandle) {
          throw new Error(
            'No export folder selected. Please select one in Settings.',
          );
        }

        const result = clip.generatePreview(
          article,
          selectedTemplate,
          generatedSummary,
        );

        await browser.storage.local.set({
          pendingClipData: {
            markdown: result.markdown,
            filename: result.filename,
          },
        });

        const saveResult = await clip.save(result, vault.vaultHandle);
        if (saveResult.ok) {
          const fileSize = new Blob([result.markdown]).size;
          await updateHistoryEntry(entry.id, { status: 'success', fileSize });
          setStatusMessage(`✅ Saved: ${result.filename}.md`);
        } else {
          throw new Error(saveResult.errorMessage || 'Failed to save file');
        }
      } catch (err) {
        console.error('[Engram] Clip flow error:', err);
        const errMsg =
          err instanceof Error ? err.message : 'Unexpected error during clip';
        await updateHistoryEntry(entry.id, {
          status: 'error',
          errorMessage: errMsg,
        });
        setStatusMessage(`Error: ${errMsg}`);
      } finally {
        clearInterval(heartbeatId);
        await browser.storage.local.remove([
          'pendingClipData',
          'pendingClipHeartbeat',
        ]);
      }
    },
    [ai, clip, selectedTemplate, vault.vaultHandle, currentPage, tabId],
  );

  const handleClip = useCallback(async () => {
    setStatusMessage(null);
    setSummary(null);

    if (!vault.vaultHandle) {
      setStatusMessage('Error: Please select a export folder in Settings.');
      return;
    }

    if (vault.permission !== 'granted') {
      setShowVaultAccessPrompt(true);
      setPendingVaultAction({ type: 'clip', withAI: true });
      setStatusMessage('Please grant vault access to save clips.');
      return;
    }

    setShowVaultAccessPrompt(false);
    setPendingVaultAction(null);
    await runClipFlow({ allowAI: true });
  }, [runClipFlow, vault.permission, vault.vaultHandle]);

  const handleClipWithoutAI = useCallback(async () => {
    setStatusMessage(null);
    setSummary(null);

    if (!vault.vaultHandle) {
      setStatusMessage('Error: Please select a export folder in Settings.');
      return;
    }

    if (vault.permission !== 'granted') {
      setShowVaultAccessPrompt(true);
      setPendingVaultAction({ type: 'clip', withAI: false });
      setStatusMessage('Please grant vault access to save clips.');
      return;
    }

    setShowVaultAccessPrompt(false);
    setPendingVaultAction(null);
    await runClipFlow({ allowAI: false });
  }, [runClipFlow, vault.permission, vault.vaultHandle]);

  const handlePreview = useCallback(async () => {
    setStatusMessage(null);

    const article = await clip.extract();
    if (!article) {
      setStatusMessage(`Error: ${clip.error || 'Failed to extract article'}`);
      return;
    }

    let generatedSummary: string | null = null;
    if (ai.status === 'available') {
      setIsSummarizing(true);
      setStatusMessage('Generating AI summary...');
      generatedSummary = await ai.generateSummary(article.textContent);
      setSummary(generatedSummary);
      setIsSummarizing(false);
      setStatusMessage(null);
    }

    const result = clip.generatePreview(
      article,
      selectedTemplate,
      generatedSummary,
    );
    setPreviewResult(result);
    setShowPreview(true);
  }, [ai, clip, selectedTemplate]);

  const handleSaveFromPreview = useCallback(async () => {
    if (!previewResult) return;

    if (!vault.vaultHandle) {
      setStatusMessage('Error: Please select a export folder.');
      setShowPreview(false);
      return;
    }

    if (vault.permission !== 'granted') {
      setStatusMessage('Requesting vault access...');
      const granted = await vault.requestPermission();
      if (!granted) {
        setStatusMessage(
          'Vault access is required to save clips. Please grant access.',
        );
        return;
      }
    }

    const entry = createHistoryEntry(
      previewResult.article.metadata.title,
      previewResult.article.metadata.url,
      selectedTemplate.name,
      currentPage?.favicon,
    );
    await addHistoryEntry(entry);

    if (tabId != null) {
      browser.tabs
        .sendMessage(tabId, {
          action: 'registerClipWatch',
          historyId: entry.id,
        })
        .catch(() => {});
    }

    await browser.storage.local.set({
      pendingClipData: {
        markdown: previewResult.markdown,
        filename: previewResult.filename,
      },
    });

    try {
      const saveResult = await clip.save(previewResult, vault.vaultHandle!);
      setShowPreview(false);

      if (saveResult.ok) {
        const fileSize = new Blob([previewResult.markdown]).size;
        await updateHistoryEntry(entry.id, { status: 'success', fileSize });
        setStatusMessage(`✅ Saved: ${previewResult.filename}.md`);
      } else {
        const saveErr = saveResult.errorMessage || 'Failed to save file';
        await updateHistoryEntry(entry.id, {
          status: 'error',
          errorMessage: saveErr,
        });
        setStatusMessage(`Error: ${saveErr}`);
      }
    } catch (err) {
      console.error('[Engram] Save from preview error:', err);
      setShowPreview(false);
      const errMsg =
        err instanceof Error ? err.message : 'Unexpected error during save';
      await updateHistoryEntry(entry.id, {
        status: 'error',
        errorMessage: errMsg,
      });
      setStatusMessage(`Error: ${errMsg}`);
    } finally {
      await browser.storage.local.remove([
        'pendingClipData',
        'pendingClipHeartbeat',
      ]);
    }
  }, [previewResult, vault, clip, selectedTemplate, currentPage, tabId]);

  const handleGrantAccess = useCallback(async () => {
    setStatusMessage('Requesting folder access...');
    const granted = await vault.requestPermission();
    if (granted) {
      setShowVaultAccessPrompt(false);
      setStatusMessage(null);
      const action = pendingVaultAction;
      setPendingVaultAction(null);
      if (action?.type === 'clip') {
        await runClipFlow({ allowAI: action.withAI });
      }
    } else {
      setStatusMessage(
        'Folder access is required to save clips. Please grant access.',
      );
    }
  }, [vault.requestPermission, pendingVaultAction, runClipFlow]);

  const handleReviewSave = useCallback(async (): Promise<boolean> => {
    if (!vault.vaultHandle) return false;

    if (vault.permission !== 'granted') {
      const granted = await vault.requestPermission();
      if (!granted) {
        setStatusMessage('Vault access is required to save.');
        return false;
      }
    }

    const success = await reviewSynthesis.saveToVault(vault.vaultHandle);
    if (success) {
      const filename = reviewSynthesis.getFilename();
      setStatusMessage(`✅ Saved: ${filename}.md`);
    } else {
      setStatusMessage('Error: Failed to save file');
    }
    return success;
  }, [vault, reviewSynthesis]);

  return {
    statusMessage,
    summary,
    isSummarizing,
    showPreview,
    previewResult,
    showVaultAccessPrompt,
    pendingVaultAction,
    isLoading,
    setShowPreview,
    runClipFlow,
    handleClip,
    handleClipWithoutAI,
    handlePreview,
    handleSaveFromPreview,
    handleGrantAccess,
    handleReviewSave,
  };
}
