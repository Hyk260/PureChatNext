import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * Lightweight route smoke — asserts the SPA router config source lists
 * expected paths without importing the full React tree (avoids UI/emoji deps).
 */
const configPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'webRouter.config.tsx')
const source = readFileSync(configPath, 'utf-8')

describe('webRouter.config smoke', () => {
  it('declares core app route paths', () => {
    const expectedSnippets = [
      "path: 'chat'",
      "path: 'signin'",
      "path: 'signup'",
      "path: 'settings'",
      "path: 'profile'",
      "['appearance', 'AppearancePage']",
      "path: 'messenger/:platform?'",
      "path: 'system-tools'",
      "path: 'provider'",
      "path: 'community'",
      "path: 'admin'",
      "path: 'agent'",
      "path: 'resources'",
      "path: 'library/:id'",
      "path: 'share/t/:id'",
      "path: '*'",
    ]

    for (const snippet of expectedSnippets) {
      expect(source).toContain(snippet)
    }
  })

  it('gates /dev behind import.meta.env.DEV', () => {
    expect(source).toContain('import.meta.env.DEV')
    expect(source).toMatch(/path:\s*'dev'/)
  })

  it('uses RequireAuth for chat layout', () => {
    expect(source).toContain("import('@/routes/chat/_layout')")
  })

  it('gates home, settings, and resources layouts with RequireAuth', () => {
    const routesDir = path.resolve(path.dirname(configPath), '../../routes')
    const layoutFiles = ['main/_layout.tsx', 'settings/_layout.tsx', 'resources/_layout.tsx', 'chat/_layout.tsx']

    for (const file of layoutFiles) {
      const layoutSource = readFileSync(path.join(routesDir, file), 'utf-8')
      expect(layoutSource).toContain("import RequireAuth from '@/spa/auth/RequireAuth'")
    }
  })

  it('renders the shared 404 page for unmatched paths', () => {
    expect(source).toContain("import NotFound from '@/components/404'")
    expect(source).not.toContain("import('@/components/404')")
    expect(source).not.toContain("redirectElement('/')")
  })
})
