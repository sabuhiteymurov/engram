import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  vite: () => ({
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@lib': fileURLToPath(new URL('./src/lib', import.meta.url)),
        '@hooks': fileURLToPath(new URL('./src/hooks', import.meta.url)),
        '@components': fileURLToPath(new URL('./src/components', import.meta.url)),
      },
    },
  }),

  // Don't auto-launch Chrome during dev.
  // This lets you keep using your already-running Chrome Default profile (where Gemini Nano is already working)
  // and load the unpacked extension from `.output/chrome-mv3-dev` manually.
  webExt: {
    disabled: true,
  },

  manifest: {
    name: 'Engram',
    description: 'Local-first AI web clipper',
    version: '0.1.0',
    options_ui: {
      page: 'options.html',
      open_in_tab: true,
    },
    permissions: ['activeTab', 'storage', 'contextMenus', 'clipboardWrite'],
    commands: {
      'clip-page': {
        suggested_key: {
          default: 'Ctrl+Shift+M',
          mac: 'Command+Shift+M',
        },
        description: 'Clip current page to markdown',
      },
    },
    host_permissions: ['<all_urls>'],
  },
});
