import { useState, useEffect, useCallback } from 'react';
import type { Settings, Template } from '@lib/types';
import { getSettings } from '@lib/storage';
import { DEFAULT_TEMPLATES } from '@lib/templates';
import { useVault } from '@/hooks/useVault';
import { useAI } from '@/hooks/useAI';
import { useClip, type ClipResult } from '@/hooks/useClip';
import { useReviewSynthesis } from '@/hooks/useReviewSynthesis';
import { Header } from '@/components/Header';
import { StatusMessage } from '@/components/StatusMessage';
import { AISummary } from '@/components/AISummary';
import { ClipSettings } from '@/components/ClipSettings';
import { VaultSetup } from '@/components/VaultSetup';
import { PreviewModal } from '@/components/PreviewModal';
import { ReviewSynthesisPanel } from '@/components/ReviewSynthesis';
import { Footer } from '@/components/Footer';
import { BrandedLoader } from '@/components/Spinner';
import './App.css';

interface CurrentPage {
  title: string;
  url: string;
  siteName: string;
}

type PendingVaultAction = { type: 'clip'; withAI: boolean } | null;

function App() {
  // Page state
  const [currentPage, setCurrentPage] = useState<CurrentPage | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Settings state
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template>(
    DEFAULT_TEMPLATES[0],
  );

  // UI state
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewResult, setPreviewResult] = useState<ClipResult | null>(null);
  const [showVaultAccessPrompt, setShowVaultAccessPrompt] = useState(false);
  const [pendingVaultAction, setPendingVaultAction] =
    useState<PendingVaultAction>(null);

  const vault = useVault();
  const ai = useAI();
  const clip = useClip();
  const reviewSynthesis = useReviewSynthesis();

  const runClipFlow = useCallback(
    async (opts?: { allowAI?: boolean }) => {
      // Extract article
      const article = await clip.extract();
      if (!article) {
        setStatusMessage(`Error: ${clip.error || 'Failed to extract article'}`);
        return;
      }

      // Generate AI summary if available or user wants to trigger download
      let generatedSummary: string | null = null;
      const allowAI = opts?.allowAI ?? true;
      const canUseAI = ai.status === 'available' || ai.status === 'downloading';
      if (allowAI && canUseAI) {
        setIsSummarizing(true);
        const statusText =
          ai.status === 'downloading'
            ? 'Downloading AI model & generating summary (this may take a while)...'
            : 'Generating AI summary...';
        setStatusMessage(statusText);
        generatedSummary = await ai.generateSummary(article.textContent);
        setSummary(generatedSummary);
        setIsSummarizing(false);
        // Recheck availability after using AI (model might now be downloaded)
        if (ai.status === 'downloading') {
          ai.recheckAvailability();
        }
      }

      // Check vault handle
      if (!vault.vaultHandle) {
        setStatusMessage('Error: Please select a export folder in Settings.');
        return;
      }

      // Generate preview and save
      const result = clip.generatePreview(
        article,
        selectedTemplate,
        generatedSummary,
      );

      const success = await clip.save(result, vault.vaultHandle!);
      if (success) {
        setStatusMessage(`✅ Saved: ${result.filename}.md`);
      } else {
        setStatusMessage(`Error: ${clip.error || 'Failed to save'}`);
      }
    },
    [ai, clip, selectedTemplate, vault.vaultHandle],
  );

  // Initialize popup
  useEffect(() => {
    initialize();
  }, []);

  async function initialize() {
    try {
      // Get current tab info
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (tab?.title && tab?.url) {
        const url = new URL(tab.url);
        setCurrentPage({
          title: tab.title,
          url: tab.url,
          siteName: url.hostname.replace('www.', ''),
        });
      }

      // Detect page type (article vs product)
      await reviewSynthesis.detectPageType();

      // Load settings
      const loadedSettings = await getSettings();
      setSettings(loadedSettings);
    } catch (error) {
      console.error('[App] Initialization error:', error);
    } finally {
      setIsInitializing(false);
    }
  }

  // Handle clip action with AI
  const handleClip = useCallback(async () => {
    setStatusMessage(null);
    setSummary(null);

    if (!vault.vaultHandle) {
      setStatusMessage('Error: Please select a export folder in Settings.');
      return;
    }

    // Gate BEFORE doing any expensive work (extract/AI) so we don't re-run it later.
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

  // Handle clip action without AI
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

  // Handle preview action (uses AI only when readily available)
  const handlePreview = useCallback(async () => {
    setStatusMessage(null);

    // Extract article
    const article = await clip.extract();
    if (!article) {
      setStatusMessage(`Error: ${clip.error || 'Failed to extract article'}`);
      return;
    }

    // Generate AI summary only if model is readily available
    let generatedSummary: string | null = null;
    if (ai.status === 'available') {
      setIsSummarizing(true);
      setStatusMessage('Generating AI summary...');
      generatedSummary = await ai.generateSummary(article.textContent);
      setSummary(generatedSummary);
      setIsSummarizing(false);
      setStatusMessage(null);
    }

    // Generate preview
    const result = clip.generatePreview(
      article,
      selectedTemplate,
      generatedSummary,
    );
    setPreviewResult(result);
    setShowPreview(true);
  }, [ai, clip, selectedTemplate]);

  // Handle save from preview
  const handleSaveFromPreview = useCallback(async () => {
    if (!previewResult) return;

    if (!vault.vaultHandle) {
      setStatusMessage('Error: Please select a export folder.');
      setShowPreview(false);
      return;
    }

    // Save-from-preview is a user gesture too; request permission directly.
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

    const success = await clip.save(previewResult, vault.vaultHandle!);
    setShowPreview(false);

    if (success) {
      setStatusMessage(`✅ Saved: ${previewResult.filename}.md`);
    } else {
      setStatusMessage(`Error: ${clip.error || 'Failed to save'}`);
    }
  }, [previewResult, vault, clip]);

  // Loading state - show branded loader
  if (isInitializing) {
    return <BrandedLoader />;
  }

  // Determine if we need vault setup
  const needsVaultSetup = vault.status === 'no-vault';
  const isLoading = clip.isExtracting || isSummarizing || clip.isSaving;

  return (
    <div className='flex min-h-[500px] flex-col'>
      <Header onSettingsClick={vault.openSettings} />

      <main className='flex flex-1 flex-col gap-4 p-4'>
        {statusMessage && <StatusMessage message={statusMessage} />}

        {/* Product Page: Show Review Synthesis */}
        {reviewSynthesis.pageType === 'product' && (
          <ReviewSynthesisPanel
            product={reviewSynthesis.product}
            synthesis={reviewSynthesis.synthesis}
            progress={reviewSynthesis.progress}
            isLoading={reviewSynthesis.isLoading}
            error={reviewSynthesis.error}
            onSynthesize={reviewSynthesis.runSynthesis}
            onCopy={reviewSynthesis.copyToClipboard}
            onSave={
              vault.vaultHandle && reviewSynthesis.synthesis
                ? async () => {
                    if (!vault.vaultHandle) return false;

                    // Request permission if needed
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
                  }
                : undefined
            }
          />
        )}

        {needsVaultSetup ? (
          <VaultSetup onSelectVault={vault.openSettings} />
        ) : (
          <>
            {showVaultAccessPrompt &&
              vault.vaultHandle &&
              vault.permission !== 'granted' && (
                <div className='rounded-xl border border-border bg-bg-secondary p-4 text-center'>
                  <p className='mb-3 text-[13px] text-text-secondary'>
                    This extension needs access to your export folder to save
                    clips.
                  </p>
                  <div className='flex gap-2'>
                    <button
                      className='inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary'
                      onClick={async () => {
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
                      }}
                    >
                      🔓 Grant Access
                      {vault.vaultName ? ` to ${vault.vaultName}` : ''}
                    </button>
                    <button
                      className='inline-flex cursor-pointer items-center justify-center rounded-xl border border-border bg-bg-tertiary px-4 py-3 text-sm font-semibold text-text-primary transition hover:bg-bg-primary active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary'
                      onClick={vault.openSettings}
                      title='Open Settings'
                    >
                      ⚙️
                    </button>
                  </div>
                </div>
              )}

            <AISummary
              status={ai.status}
              summary={summary}
              isLoading={isSummarizing}
              onRecheckStatus={ai.recheckAvailability}
            />

            <ClipSettings
              vaultName={vault.vaultName}
              folderPath={settings?.vault.defaultFolder || ''}
              templates={DEFAULT_TEMPLATES}
              selectedTemplate={selectedTemplate}
              onTemplateChange={setSelectedTemplate}
            />

            <div className='mt-auto flex flex-col gap-2'>
              {ai.status === 'available' ? (
                <button
                  className='inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-deep)_100%)] px-5 py-3 text-sm font-semibold text-white shadow-accent-glow transition hover:-translate-y-0.5 hover:shadow-accent-glow-hover active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary'
                  onClick={handleClip}
                  disabled={isLoading}
                >
                  <span>
                    {clip.isExtracting
                      ? 'Extracting...'
                      : isSummarizing
                        ? 'Summarizing...'
                        : clip.isSaving
                          ? 'Saving...'
                          : 'Clip with AI Summary'}
                  </span>
                  <span className='text-base'>✨</span>
                </button>
              ) : (
                <>
                  <button
                    className='inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-deep)_100%)] px-5 py-3 text-sm font-semibold text-white shadow-accent-glow transition hover:-translate-y-0.5 hover:shadow-accent-glow-hover active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary'
                    onClick={handleClipWithoutAI}
                    disabled={isLoading}
                  >
                    <span>
                      {clip.isExtracting
                        ? 'Extracting...'
                        : clip.isSaving
                          ? 'Saving...'
                          : 'Save Clip'}
                    </span>
                    <span className='text-base'>📎</span>
                  </button>
                  {ai.status === 'downloading' && (
                    <button
                      className='inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-bg-tertiary px-4 py-2.5 text-[13px] font-medium text-text-secondary transition hover:bg-bg-primary active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary'
                      onClick={handleClip}
                      disabled={isLoading}
                      title='Model will be downloaded (~1-2 GB). This may take several minutes.'
                    >
                      <span>
                        {isSummarizing
                          ? 'Downloading model & summarizing...'
                          : 'Try with AI (will download model)'}
                      </span>
                      <span className='text-xs'>⬇️</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </main>

      <Footer
        onPreviewClick={handlePreview}
        onSettingsClick={vault.openSettings}
        previewDisabled={needsVaultSetup || isLoading}
      />

      {showPreview && previewResult && (
        <PreviewModal
          isOpen={showPreview}
          result={previewResult}
          onClose={() => setShowPreview(false)}
          onSave={handleSaveFromPreview}
          isSaving={clip.isSaving}
        />
      )}
    </div>
  );
}

export default App;
