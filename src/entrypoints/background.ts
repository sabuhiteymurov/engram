// Engram Background Service Worker
export default defineBackground(() => {
  // Create context menus on install
  browser.runtime.onInstalled.addListener(() => {
    // Context menu for page
    browser.contextMenus.create({
      id: 'clip-page',
      title: 'Clip to Obsidian',
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

  // Handle keyboard shortcut
  browser.commands.onCommand.addListener(async (command) => {
    if (command === 'clip-page') {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await browser.tabs.sendMessage(tab.id, {
          action: 'clipPage',
        });
      }
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
