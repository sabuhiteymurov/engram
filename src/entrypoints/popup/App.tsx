import { useState, useEffect, useCallback } from 'react';
import type { Settings, Template } from '@lib/types';
import { getSettings } from '@lib/storage';
import { DEFAULT_TEMPLATES } from '@lib/templates';
import { useVault, useAI, useClip, type ClipResult } from '@/hooks';
import {
  Header,
  PageInfo,
  StatusMessage,
  AISummary,
  ClipSettings,
  VaultSetup,
  PreviewModal,
  Footer,
  Spinner,
} from '@/components';
import './App.css';

interface CurrentPage {
  title: string;
  url: string;
  siteName: string;
}

type PendingVaultAction = 'clip' | null;

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

  // Custom hooks
  const vault = useVault();
  const ai = useAI();
  const clip = useClip();

  const runClipFlow = useCallback(
    async (opts?: { allowAI?: boolean }) => {
      // Extract article
      const article = await clip.extract();
      if (!article) {
        setStatusMessage(`Error: ${clip.error || 'Failed to extract article'}`);
        return;
      }

      // Generate AI summary if available
      let generatedSummary: string | null = null;
      const allowAI = opts?.allowAI ?? true;
      if (allowAI && ai.status === 'available') {
        setIsSummarizing(true);
        setStatusMessage('Generating AI summary...');
        generatedSummary = await ai.generateSummary(article.textContent);
        setSummary(generatedSummary);
        setIsSummarizing(false);
      }

      // Check vault handle
      if (!vault.vaultHandle) {
        setStatusMessage('Error: Please select a vault folder in Settings.');
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

      // Load settings
      const loadedSettings = await getSettings();
      setSettings(loadedSettings);
    } catch (error) {
      console.error('[App] Initialization error:', error);
    } finally {
      setIsInitializing(false);
    }
  }

  // Handle clip action
  const handleClip = useCallback(async () => {
    setStatusMessage(null);
    setSummary(null);

    if (!vault.vaultHandle) {
      setStatusMessage('Error: Please select a vault folder in Settings.');
      return;
    }

    // Gate BEFORE doing any expensive work (extract/AI) so we don't re-run it later.
    if (vault.permission !== 'granted') {
      setShowVaultAccessPrompt(true);
      setPendingVaultAction('clip');
      setStatusMessage('Please grant vault access to save clips.');
      return;
    }

    setShowVaultAccessPrompt(false);
    setPendingVaultAction(null);
    await runClipFlow({ allowAI: true });
  }, [runClipFlow, vault.permission, vault.vaultHandle]);

  // Handle preview action
  const handlePreview = useCallback(async () => {
    setStatusMessage(null);

    // Extract article
    const article = await clip.extract();
    if (!article) {
      setStatusMessage(`Error: ${clip.error || 'Failed to extract article'}`);
      return;
    }

    // Generate AI summary if available
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
      setStatusMessage('Error: Please select a vault folder.');
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

  // Loading state
  if (isInitializing) {
    return (
      <div className='flex min-h-[500px] flex-col'>
        <Spinner text='Loading...' />
      </div>
    );
  }

  // Determine if we need vault setup
  const needsVaultSetup = vault.status === 'no-vault';
  const isLoading = clip.isExtracting || isSummarizing || clip.isSaving;

  return (
    <div className='flex min-h-[500px] flex-col'>
      <Header onSettingsClick={vault.openSettings} />

      <main className='flex flex-1 flex-col gap-4 p-4'>
        {currentPage && (
          <PageInfo title={currentPage.title} siteName={currentPage.siteName} />
        )}

        {statusMessage && <StatusMessage message={statusMessage} />}

        {needsVaultSetup ? (
          <VaultSetup onSelectVault={vault.openSettings} />
        ) : (
          <>
            {showVaultAccessPrompt &&
              vault.vaultHandle &&
              vault.permission !== 'granted' && (
                <div className='rounded-xl border border-border bg-bg-secondary p-4 text-center'>
                  <p className='mb-3 text-[13px] text-text-secondary'>
                    This extension needs access to your vault folder to save
                    clips.
                  </p>
                  <div className='flex gap-2'>
                    <button
                      className='inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary'
                      onClick={async () => {
                        setStatusMessage('Requesting vault access...');
                        const granted = await vault.requestPermission();
                        if (granted) {
                          setShowVaultAccessPrompt(false);
                          setStatusMessage(null);
                          const action = pendingVaultAction;
                          setPendingVaultAction(null);
                          if (action === 'clip') {
                            await runClipFlow({ allowAI: true });
                          }
                        } else {
                          setStatusMessage(
                            'Vault access is required to save clips. Please grant access.',
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
            />

            <ClipSettings
              vaultName={vault.vaultName}
              folderPath={settings?.vault.defaultFolder || ''}
              templates={DEFAULT_TEMPLATES}
              selectedTemplate={selectedTemplate}
              onTemplateChange={setSelectedTemplate}
            />

            <button
              className='mt-auto inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-deep)_100%)] px-5 py-3 text-sm font-semibold text-white shadow-accent-glow transition hover:-translate-y-0.5 hover:shadow-accent-glow-hover active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary'
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
                  : 'Clip to Obsidian'}
              </span>
              <span className='text-base'>✨</span>
            </button>
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
