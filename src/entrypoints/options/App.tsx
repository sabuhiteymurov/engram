import { useEffect, useState } from 'react';
import { getVaultDirectory } from '../../lib/filesystem';
import { saveDirectoryHandle } from '../../lib/storage';

type Status = 'idle' | 'checking' | 'ready' | 'error';

export default function App() {
  const [status, setStatus] = useState<Status>('checking');
  const [vaultName, setVaultName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setStatus('checking');
    setError(null);
    try {
      const handle = await getVaultDirectory();
      if (handle) {
        setVaultName(handle.name);
        setStatus('ready');
      } else {
        setVaultName(null);
        setStatus('idle');
      }
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
  }

  async function onSelectVault() {
    setError(null);
    if (typeof window.showDirectoryPicker !== 'function') {
      setStatus('error');
      setError('showDirectoryPicker is not available in this browser/context');
      return;
    }

    // Call the picker directly inside the click handler (Linux/Chromium is strict about user gestures).
    window
      .showDirectoryPicker({ mode: 'readwrite' })
      .then(async (handle) => {
        await saveDirectoryHandle(handle, 'vault');
        setVaultName(handle.name);
        setStatus('ready');
      })
      .catch((e) => {
        setStatus('error');
        setError(
          e instanceof Error ? e.name + ': ' + e.message : 'Unknown error',
        );
      });
  }

  return (
    <div className='page'>
      <header className='header'>
        <div className='title'>Engram</div>
        <div className='subtitle'>Options</div>
      </header>

      <main className='card'>
        <div className='row'>
          <div className='label'>Export Folder</div>
          <div className='value'>
            {status === 'checking'
              ? 'Checking…'
              : vaultName
              ? vaultName
              : 'Not selected'}
          </div>
        </div>

        <button className='btn' onClick={onSelectVault}>
          Select export folder
        </button>

        <button className='btn secondary' onClick={refresh}>
          Refresh
        </button>

        {error && <div className='error'>{error}</div>}
      </main>
    </div>
  );
}
