// Storage utilities using IndexedDB and browser.storage
import type { Settings, Template } from './types';

const DB_NAME = 'engram-db';
const DB_VERSION = 1;
const STORE_HANDLES = 'directoryHandles';

// IndexedDB for FileSystemDirectoryHandle persistence
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_HANDLES)) {
        db.createObjectStore(STORE_HANDLES, { keyPath: 'id' });
      }
    };
  });
}

export async function saveDirectoryHandle(
  handle: FileSystemDirectoryHandle,
  id: string = 'vault'
): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_HANDLES, 'readwrite');
    const store = transaction.objectStore(STORE_HANDLES);
    const request = store.put({ id, handle });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getDirectoryHandle(
  id: string = 'vault'
): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_HANDLES, 'readonly');
    const store = transaction.objectStore(STORE_HANDLES);
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const result = request.result;
      resolve(result?.handle || null);
    };
  });
}

export async function removeDirectoryHandle(id: string = 'vault'): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_HANDLES, 'readwrite');
    const store = transaction.objectStore(STORE_HANDLES);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Settings storage using browser.storage.local
const DEFAULT_SETTINGS: Settings = {
  vault: {
    directoryHandle: null,
    defaultFolder: '',
    filenameTemplate: '{{date}} {{title}}',
  },
  ai: {
    enabled: true,
    summaryLength: 'medium',
    customSystemPrompt: null,
  },
  defaultTemplateId: 'article',
  keyboardShortcut: 'Ctrl+Shift+M',
  theme: 'system',
};

export async function getSettings(): Promise<Settings> {
  const result = await browser.storage.local.get('settings');
  const stored = result.settings as Partial<Settings> | undefined;
  if (!stored) {
    return DEFAULT_SETTINGS;
  }
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    vault: { ...DEFAULT_SETTINGS.vault, ...stored.vault },
    ai: { ...DEFAULT_SETTINGS.ai, ...stored.ai },
  };
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  await browser.storage.local.set({
    settings: { ...current, ...settings },
  });
}

export async function getTemplates(): Promise<Template[]> {
  const result = await browser.storage.local.get('templates');
  const templates = result.templates as Template[] | undefined;
  return templates || [];
}

export async function saveTemplates(templates: Template[]): Promise<void> {
  await browser.storage.local.set({ templates });
}

export async function getTemplate(id: string): Promise<Template | null> {
  const templates = await getTemplates();
  return templates.find((t) => t.id === id) || null;
}

export async function saveTemplate(template: Template): Promise<void> {
  const templates = await getTemplates();
  const index = templates.findIndex((t) => t.id === template.id);
  if (index >= 0) {
    templates[index] = template;
  } else {
    templates.push(template);
  }
  await saveTemplates(templates);
}

export async function deleteTemplate(id: string): Promise<void> {
  const templates = await getTemplates();
  await saveTemplates(templates.filter((t) => t.id !== id));
}
