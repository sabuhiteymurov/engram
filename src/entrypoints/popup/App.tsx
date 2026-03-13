import { useState } from 'react';
import { Scissors, Clock } from 'lucide-react';
import type { Template } from '@lib/types';
import { DEFAULT_TEMPLATES } from '@lib/templates';
import { useVault } from '@/hooks/useVault';
import { useAI } from '@/hooks/useAI';
import { useClip } from '@/hooks/useClip';
import { useReviewSynthesis } from '@/hooks/useReviewSynthesis';
import { useHistory } from '@/hooks/useHistory';
import { usePopupInit } from '@/hooks/usePopupInit';
import { useClipOrchestration } from '@/hooks/useClipOrchestration';
import { Header } from '@/components/Header';
import { StatusMessage } from '@/components/StatusMessage';
import { AISummary } from '@/components/AISummary';
import { ClipSettings } from '@/components/ClipSettings';
import { VaultSetup } from '@/components/VaultSetup';
import { PreviewModal } from '@/components/PreviewModal';
import { ReviewSynthesisPanel } from '@/components/ReviewSynthesis';
import { Footer } from '@/components/Footer';
import { HistoryView } from '@/components/HistoryView';
import { BrandedLoader } from '@/components/Spinner';
import { VaultAccessPrompt } from '@/components/VaultAccessPrompt';
import { TabButton } from '@/components/TabButton';
import './App.css';

type ActiveTab = 'clip' | 'history';

function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('clip');
  const [selectedTemplate, setSelectedTemplate] = useState<Template>(
    DEFAULT_TEMPLATES[0],
  );

  const vault = useVault();
  const ai = useAI();
  const clip = useClip();
  const reviewSynthesis = useReviewSynthesis();
  const history = useHistory();
  const { currentPage, isInitializing, settings, tabId } = usePopupInit(
    reviewSynthesis.detectPageType,
  );
  const orchestration = useClipOrchestration({
    vault,
    ai,
    clip,
    reviewSynthesis,
    currentPage,
    selectedTemplate,
    tabId,
  });

  if (isInitializing) {
    return <BrandedLoader />;
  }

  const needsVaultSetup = vault.status === 'no-vault';
  const processingCount = history.entries.filter(
    (e) => e.status === 'processing',
  ).length;

  return (
    <div className='flex h-[500px] flex-col overflow-hidden bg-bg-primary'>
      <Header onSettingsClick={vault.openSettings} />

      {activeTab === 'clip' ? (
        <>
          <main className='flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4'>
            {orchestration.statusMessage && (
              <StatusMessage message={orchestration.statusMessage} />
            )}

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
                    ? orchestration.handleReviewSave
                    : undefined
                }
              />
            )}

            {needsVaultSetup ? (
              <VaultSetup onSelectVault={vault.openSettings} />
            ) : (
              <>
                {orchestration.showVaultAccessPrompt &&
                  vault.vaultHandle &&
                  vault.permission !== 'granted' && (
                    <VaultAccessPrompt
                      vaultName={vault.vaultName}
                      onGrantAccess={orchestration.handleGrantAccess}
                      onOpenSettings={vault.openSettings}
                    />
                  )}

                <AISummary
                  status={ai.status}
                  summary={orchestration.summary}
                  isLoading={orchestration.isSummarizing}
                  downloadProgress={ai.downloadProgress}
                  onRecheckStatus={ai.recheckAvailability}
                  onDownload={ai.triggerDownload}
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
                      className='inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-deep)_100%)] px-5 py-2 text-sm font-semibold text-white shadow-accent-glow transition hover:-translate-y-0.5 hover:shadow-accent-glow-hover active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary'
                      onClick={orchestration.handleClip}
                      disabled={orchestration.isLoading}
                    >
                      <span>
                        {clip.isExtracting
                          ? 'Extracting...'
                          : orchestration.isSummarizing
                            ? 'Summarizing...'
                            : clip.isSaving
                              ? 'Saving...'
                              : 'Clip with AI Summary'}
                      </span>
                      <span className='text-base'>✨</span>
                    </button>
                  ) : (
                    <button
                      className='inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-deep)_100%)] px-5 py-2 text-sm font-semibold text-white shadow-accent-glow transition hover:-translate-y-0.5 hover:shadow-accent-glow-hover active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary'
                      onClick={orchestration.handleClipWithoutAI}
                      disabled={
                        orchestration.isLoading || ai.status === 'downloading'
                      }
                    >
                      <span>
                        {clip.isExtracting
                          ? 'Extracting...'
                          : clip.isSaving
                            ? 'Saving...'
                            : ai.status === 'downloading'
                              ? 'Model Downloading...'
                              : 'Save Clip'}
                      </span>
                      <span className='text-base'>📎</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </main>

          <Footer
            onPreviewClick={orchestration.handlePreview}
            onSettingsClick={vault.openSettings}
            previewDisabled={needsVaultSetup || orchestration.isLoading}
          />
        </>
      ) : (
        <HistoryView
          entries={history.entries}
          isLoading={history.isLoading}
          onRemove={history.remove}
          onClearAll={history.clearAll}
        />
      )}

      <nav className='relative z-10 flex shrink-0 border-t border-border bg-bg-secondary'>
        <TabButton
          active={activeTab === 'clip'}
          onClick={() => setActiveTab('clip')}
          icon={<Scissors className='h-4 w-4' />}
          label='Clip'
        />
        <TabButton
          active={activeTab === 'history'}
          onClick={() => setActiveTab('history')}
          icon={<Clock className='h-4 w-4' />}
          label='History'
          badge={processingCount > 0 ? processingCount : undefined}
        />
      </nav>

      {orchestration.showPreview && orchestration.previewResult && (
        <PreviewModal
          isOpen={orchestration.showPreview}
          result={orchestration.previewResult}
          onClose={() => orchestration.setShowPreview(false)}
          onSave={orchestration.handleSaveFromPreview}
          isSaving={clip.isSaving}
        />
      )}
    </div>
  );
}

export default App;
