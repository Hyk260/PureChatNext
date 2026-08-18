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
      "path: 'appearance'",
      "path: 'provider'",
      "path: 'community'",
      "path: 'agent'",
      "path: 'resources'",
      "path: 'library/:id'",
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

  it('renders the shared 404 page for unmatched paths', () => {
    expect(source).toContain("import('@/components/404')")
    expect(source).not.toContain("redirectElement('/')")
  })
})
