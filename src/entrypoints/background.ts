// Engram Background Service Worker
import { isAmazonProductUrl } from '../lib/reviewExtractor';

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

  // Handle context menu clicks
  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab?.id) return;

    if (info.menuItemId === 'clip-page') {
      await browser.tabs.sendMessage(tab.id, {
        action: 'clipPage',
      });
    } else if (info.menuItemId === 'clip-selection') {
      await browser.tabs.sendMessage(tab.id, {
        action: 'clipSelection',
        selectedText: info.selectionText,
      });
    }
  });

  // Handle messages from content script and popup
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'getTabInfo') {
      browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
        sendResponse({
          title: tab?.title || '',
          url: tab?.url || '',
        });
      });
      return true; // Keep channel open for async response
    }

    if (message.action === 'openPopup') {
      browser.action.openPopup();
    }

    return false;
  });

  console.log('Engram: Background script initialized');
});
