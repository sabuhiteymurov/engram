import { useState, useEffect, useCallback } from 'react';
import {
  getVaultDirectory,
  getVaultDirectoryWithPermission,
} from '@lib/filesystem';

export type VaultStatus = 'loading' | 'ready' | 'no-vault';
type VaultPermissionState = PermissionState | 'unknown';

interface UseVaultReturn {
  status: VaultStatus;
  vaultName: string | null;
  vaultHandle: FileSystemDirectoryHandle | null;
  permission: VaultPermissionState;
  requestPermission: () => Promise<boolean>;
  openSettings: () => void;
}

export function useVault(): UseVaultReturn {
  const [status, setStatus] = useState<VaultStatus>('loading');
  const [vaultName, setVaultName] = useState<string | null>(null);
  const [vaultHandle, setVaultHandle] =
    useState<FileSystemDirectoryHandle | null>(null);
  const [permission, setPermission] = useState<VaultPermissionState>('unknown');

  useEffect(() => {
    checkVault();
  }, []);

  async function checkVault() {
    try {
      const handle = await getVaultDirectory();
      if (handle) {
        setVaultName(handle.name);
        setVaultHandle(handle);

        // Track permission for UI/debug, but don't force a "re-authorize" UI on popup open.
        // Permission requests should happen only on user gesture (e.g. click Clip/Save).
        try {
          const p = await handle.queryPermission({ mode: 'readwrite' });
          setPermission(p);
        } catch {
          setPermission('unknown');
        }

        setStatus('ready');
      } else {
        setStatus('no-vault');
        setPermission('unknown');
      }
    } catch (error) {
      console.error('[useVault] Error checking vault:', error);
      setStatus('no-vault');
      setPermission('unknown');
    }
  }

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      if (!vaultHandle) return false;

      // Fast path: if permission is already granted, don't do anything.
      try {
        const p = await vaultHandle.queryPermission({ mode: 'readwrite' });
        setPermission(p);
        if (p === 'granted') return true;
      } catch {
        // fall through to explicit permission request
      }

      const handle = await getVaultDirectoryWithPermission();
      if (handle) {
        setVaultHandle(handle);
        setVaultName(handle.name);
        setStatus('ready');
        setPermission('granted');
        return true;
      }
      setPermission('denied');
      return false;
    } catch (error) {
      console.error('[useVault] Error requesting permission:', error);
      return false;
    }
  }, [vaultHandle]);

  const openSettings = useCallback(() => {
    browser.runtime.openOptionsPage();
  }, []);

  return {
    status,
    vaultName,
    vaultHandle,
    permission,
    requestPermission,
    openSettings,
  };
}
