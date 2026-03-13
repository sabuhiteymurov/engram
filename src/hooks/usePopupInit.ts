import { useState, useEffect, useRef } from 'react';
import type { Settings, CurrentPage, PageType } from '@lib/types';
import { getSettings } from '@lib/storage';

interface UsePopupInitReturn {
  currentPage: CurrentPage | null;
  isInitializing: boolean;
  settings: Settings | null;
  tabId: number | null;
}

export function usePopupInit(
  detectPageType: () => Promise<PageType>,
): UsePopupInitReturn {
  const [currentPage, setCurrentPage] = useState<CurrentPage | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [settings, setSettings] = useState<Settings | null>(null);
  const tabIdRef = useRef<number | null>(null);

  useEffect(() => {
    async function initialize() {
      try {
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
            favicon: tab.favIconUrl || '',
          });
        }
        if (tab?.id !== undefined) {
          tabIdRef.current = tab.id;
        }

        await detectPageType();

        const loadedSettings = await getSettings();
        setSettings(loadedSettings);
      } catch (error) {
        console.error('[App] Initialization error:', error);
      } finally {
        setIsInitializing(false);
      }
    }

    initialize();
  }, []);

  return { currentPage, isInitializing, settings, tabId: tabIdRef.current };
}
