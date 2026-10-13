import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite'

// Serve the built renderer without electron-vite starting a second Electron process.
export default defineConfig({
  root: fileURLToPath(new URL('../../../apps/desktop/', import.meta.url)),
  build: { outDir: 'dist/renderer' },
  preview: { host: '127.0.0.1', port: 5176, strictPort: true },
})
