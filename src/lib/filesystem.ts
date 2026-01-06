// File System Access API utilities
import { saveDirectoryHandle, getDirectoryHandle } from './storage';

export async function selectVaultDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (typeof window.showDirectoryPicker !== 'function') {
    throw new Error('showDirectoryPicker is not available in this browser/context');
  }

  const handle = await window.showDirectoryPicker({
    mode: 'readwrite',
  });
  await saveDirectoryHandle(handle, 'vault');
  return handle;
}

export async function getVaultDirectory(): Promise<FileSystemDirectoryHandle | null> {
  const handle = await getDirectoryHandle('vault');
  if (!handle) {
    return null;
  }

  // Verify permission status.
  // IMPORTANT: Don't call requestPermission() here. This function is used during popup init
  // where there is no user gesture, and Chromium may deny/ignore the prompt which makes the
  // UI think "no vault selected" and forces re-picking every time.
  try {
    const permission = await handle.queryPermission({ mode: 'readwrite' });
    if (permission === 'granted') {
      return handle;
    }
  } catch {
    // Handle no longer valid
  }

  // Return the handle even if permission is "prompt"/"denied" so we preserve the vault selection.
  // Permission can be requested implicitly when writing (on user gesture) or by re-selecting in Options.
  return handle;
}

/**
 * Get vault directory handle and request permission if needed.
 * Call this on user gesture (e.g., button click) so the permission prompt works.
 */
export async function getVaultDirectoryWithPermission(): Promise<FileSystemDirectoryHandle | null> {
  const handle = await getDirectoryHandle('vault');
  if (!handle) {
    return null;
  }

  try {
    const permission = await handle.queryPermission({ mode: 'readwrite' });
    if (permission === 'granted') {
      return handle;
    }

    // Request permission (requires user gesture)
    const newPermission = await handle.requestPermission({ mode: 'readwrite' });
    if (newPermission === 'granted') {
      return handle;
    }
  } catch (err) {
    console.error('[Engram] Failed to get vault permission:', err);
  }

  return null;
}

export async function getOrCreateFolder(
  parentHandle: FileSystemDirectoryHandle,
  folderPath: string
): Promise<FileSystemDirectoryHandle> {
  if (!folderPath) {
    return parentHandle;
  }

  const parts = folderPath.split('/').filter((p) => p.length > 0);
  let currentHandle = parentHandle;

  for (const part of parts) {
    currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
  }

  return currentHandle;
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

export function generateFilename(template: string, title: string): string {
  const date = new Date().toISOString().split('T')[0];
  const sanitizedTitle = sanitizeFilename(title);

  let filename = template
    .replace('{{date}}', date)
    .replace('{{title}}', sanitizedTitle);

  filename = sanitizeFilename(filename);

  if (!filename) {
    filename = `${date} Untitled`;
  }

  return filename;
}

export async function saveMarkdownFile(
  directoryHandle: FileSystemDirectoryHandle,
  folderPath: string,
  filename: string,
  content: string
): Promise<void> {
  const folder = await getOrCreateFolder(directoryHandle, folderPath);
  const sanitizedFilename = sanitizeFilename(filename);
  const fullFilename = sanitizedFilename.endsWith('.md')
    ? sanitizedFilename
    : `${sanitizedFilename}.md`;

  const fileHandle = await folder.getFileHandle(fullFilename, { create: true });
  const writable = await fileHandle.createWritable();

  try {
    await writable.write(content);
  } finally {
    await writable.close();
  }
}

export async function listFolders(
  directoryHandle: FileSystemDirectoryHandle,
  path: string = ''
): Promise<string[]> {
  const folders: string[] = [];
  const folder = await getOrCreateFolder(directoryHandle, path);

  for await (const entry of folder.values()) {
    if (entry.kind === 'directory') {
      const folderPath = path ? `${path}/${entry.name}` : entry.name;
      folders.push(folderPath);
    }
  }

  return folders.sort();
}

