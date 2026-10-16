import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * 轻量级路由冒烟测试：检查 SPA 路由配置源码是否包含预期路径，
 * 不导入完整的 React 组件树，以避免加载 UI 和 emoji 依赖。
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
      "path: 'data'",
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

  it('exposes the desktop authorization page as a dev test route', () => {
    const devRoutes = source
      .split('// —— Dev (dev-only; production can 404 later) ——')[1]
      ?.split('// —— Fallback ——')[0]

    expect(devRoutes).toContain("path: 'desktop-authorize'")
    expect(devRoutes).toContain("import('@/features/desktop/DesktopAuthorizePage')")
  })

  it('exposes Context Window in the dev preview route and navigation', () => {
    const devRoutes = source
      .split('// —— Dev (dev-only; production can 404 later) ——')[1]
      ?.split('// —— Fallback ——')[0]
    const navigationPath = path.resolve(path.dirname(configPath), '../../const/frontend-routes.ts')
    const navigationSource = readFileSync(navigationPath, 'utf-8')

    expect(devRoutes).toContain("path: 'context-window'")
    expect(devRoutes).toContain("import('@/features/dev/ContextWindowPage')")
    expect(navigationSource).toContain("{ href: '/dev/context-window', label: 'Context Window' }")
  })

  it('uses RequireAuth for chat layout', () => {
    expect(source).toContain("import('@/routes/chat/layout')")
  })

  it('gates home, settings, and resources layouts with RequireAuth', () => {
    const routesDir = path.resolve(path.dirname(configPath), '../../routes')
    const layoutFiles = ['main/layout.tsx', 'settings/layout.tsx', 'resources/layout.tsx', 'chat/layout.tsx']

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
