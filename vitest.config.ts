import { dirname, join, resolve } from 'node:path'

// import tsconfigPaths from 'vite-tsconfig-paths'
import { coverageConfigDefaults, defineConfig } from 'vitest/config'

if (process.env.NODE_ENV === 'production') {
  Reflect.set(process.env, 'NODE_ENV', 'test')
}

const alias = {
  '@/envs': resolve(__dirname, './packages/env/src'),
  '@': resolve(__dirname, './src'),
}

export default defineConfig({
  define: {
    __CI__: process.env.CI === 'true' ? 'true' : 'false',
    __DEV__: process.env.NODE_ENV !== 'production' ? 'true' : 'false',
    __ELECTRON__: 'false',
    __MOBILE__: 'false',
    __TEST__: 'true',
  },
  optimizeDeps: {
    exclude: ['crypto', 'util', 'tty'],
    include: [],
  },
  plugins: [
    // tsconfigPaths({ projects: ['.'] }),
    // Let `.md` imports resolve to their raw text content so Rollup/Vitest
    // doesn't try to parse Markdown as JavaScript.
    {
      name: 'raw-md',
      transform(_, id) {
        if (id.endsWith('.md')) return { code: 'export default ""', map: null }
      },
    },
  ],
  resolve: {
    alias,
  },
  test: {
    alias,
    coverage: {
      all: false,
      exclude: [...coverageConfigDefaults.exclude, '__mocks__/**', '**/packages/**'],
      provider: 'v8',
      reporter: ['text', 'json', 'lcov', 'text-summary'],
      reportsDirectory: './coverage/app',
    },
    environment: 'happy-dom',
    exclude: [
      '**/node_modules/**',
      '**/.*/**',
      '**/dist/**',
      '**/build/**',
      '**/tmp/**',
      '**/temp/**',
      '**/docs/**',
      '**/locales/**',
      '**/public/**',
      '**/packages/**',
      '**/e2e/**',
    ],
    globals: true,
    server: {
      deps: {
        inline: ['vitest-canvas-mock'],
      },
    },
    setupFiles: join(__dirname, './tests/setup.ts'),
  },
})
