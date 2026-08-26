import type { RouteObject } from 'react-router'

import NotFound from '@/components/404'
import { dynamicElement, dynamicLayout } from '@/utils/router'

/**
 * Web SPA route tree (react-router).
 * Mirrors App Router paths from `docs/spa-migration-checklist.md` §2.
 * Layouts / pages live in `src/routes/*` (thin) → `@/features/*`.
 */
export const webRoutes: RouteObject[] = [
  // —— Main (home) ——
  {
    children: [
      {
        element: dynamicElement(() => import('@/routes/main/page'), 'Home'),
        index: true,
      },
    ],
    element: dynamicLayout(() => import('@/routes/main/_layout'), 'MainLayout'),
  },

  // —— Chat ——
  {
    children: [
      {
        element: dynamicElement(() => import('@/routes/chat/page'), 'Chat'),
        index: true,
      },
    ],
    element: dynamicLayout(() => import('@/routes/chat/_layout'), 'ChatLayout'),
    path: 'chat',
  },

  // —— Resources ——
  {
    children: [
      {
        children: [
          {
            element: dynamicElement(() => import('@/routes/resources/home/page'), 'Resources > Home'),
            index: true,
          },
        ],
        element: dynamicLayout(() => import('@/routes/resources/home/_layout'), 'Resources > HomeLayout'),
      },
      {
        children: [
          {
            element: dynamicElement(() => import('@/routes/resources/library/$id/page'), 'Resources > Library'),
            index: true,
          },
          {
            element: dynamicElement(
              () => import('@/routes/resources/library/$id/$slug/page'),
              'Resources > Library > Slug'
            ),
            path: '*',
          },
        ],
        element: dynamicLayout(() => import('@/routes/resources/library/$id/_layout'), 'Resources > LibraryLayout'),
        path: 'library/:id',
      },
    ],
    element: dynamicLayout(() => import('@/routes/resources/_layout'), 'ResourcesLayout'),
    path: 'resources',
  },

  // —— Auth / account ——
  {
    element: dynamicElement(() => import('@/routes/signin/page'), 'SignIn'),
    path: 'signin',
  },
  {
    element: dynamicElement(() => import('@/routes/signup/page'), 'SignUp'),
    path: 'signup',
  },
  {
    element: dynamicElement(() => import('@/routes/login/page'), 'Login'),
    path: 'login',
  },
  {
    element: dynamicElement(() => import('@/routes/verify-email/page'), 'VerifyEmail'),
    path: 'verify-email',
  },
  {
    element: dynamicElement(() => import('@/routes/reset-password/page'), 'ResetPassword'),
    path: 'reset-password',
  },
  {
    element: dynamicElement(() => import('@/routes/auth-error/page'), 'AuthError'),
    path: 'auth-error',
  },
  {
    element: dynamicElement(() => import('@/routes/welcome/page'), 'Welcome'),
    path: 'welcome',
  },
  {
    element: dynamicElement(() => import('@/routes/profile/page'), 'Profile'),
    path: 'profile',
  },
  {
    element: dynamicElement(() => import('@/routes/protected/page'), 'Protected'),
    path: 'protected',
  },

  // —— Public information ——
  {
    element: dynamicElement(
      () => import('@/features/public/PublicInfoPages').then((module) => ({ default: module.HelpPage })),
      'Help'
    ),
    path: 'help',
  },
  {
    element: dynamicElement(
      () => import('@/features/public/PublicInfoPages').then((module) => ({ default: module.PrivacyPage })),
      'Privacy'
    ),
    path: 'privacy',
  },
  {
    element: dynamicElement(
      () => import('@/features/public/PublicInfoPages').then((module) => ({ default: module.TermsPage })),
      'Terms'
    ),
    path: 'terms',
  },

  // —— Settings ——
  {
    children: [
      {
        element: dynamicElement(() => import('@/routes/settings/page'), 'Settings'),
        index: true,
      },
      {
        element: dynamicElement(() => import('@/routes/settings/profile/page'), 'Settings > Profile'),
        path: 'profile',
      },
      {
        element: dynamicElement(
          () => import('@/routes/settings/empty').then((m) => ({ default: m.AppearancePage })),
          'Settings > Appearance'
        ),
        path: 'appearance',
      },
      {
        element: dynamicElement(
          () => import('@/routes/settings/empty').then((m) => ({ default: m.LanguagePage })),
          'Settings > Language'
        ),
        path: 'language',
      },
      {
        element: dynamicElement(
          () => import('@/routes/settings/empty').then((m) => ({ default: m.HotkeyPage })),
          'Settings > Hotkey'
        ),
        path: 'hotkey',
      },
      {
        element: dynamicElement(
          () => import('@/routes/settings/empty').then((m) => ({ default: m.NotificationPage })),
          'Settings > Notification'
        ),
        path: 'notification',
      },
      {
        element: dynamicElement(
          () => import('@/routes/settings/empty').then((m) => ({ default: m.StatsPage })),
          'Settings > Stats'
        ),
        path: 'stats',
      },
      {
        element: dynamicElement(() => import('@/routes/settings/credits/page'), 'Settings > Credits'),
        path: 'credits',
      },
      {
        element: dynamicElement(() => import('@/routes/settings/usage/page'), 'Settings > Usage'),
        path: 'usage',
      },
      {
        element: dynamicElement(
          () => import('@/routes/settings/empty').then((m) => ({ default: m.AdvancedPage })),
          'Settings > Advanced'
        ),
        path: 'advanced',
      },
      {
        element: dynamicElement(
          () => import('@/routes/settings/empty').then((m) => ({ default: m.StoragePage })),
          'Settings > Storage'
        ),
        path: 'storage',
      },
      {
        element: dynamicElement(
          () => import('@/routes/settings/empty').then((m) => ({ default: m.MemoryPage })),
          'Settings > Memory'
        ),
        path: 'memory',
      },
      {
        element: dynamicElement(
          () => import('@/routes/settings/empty').then((m) => ({ default: m.CredsPage })),
          'Settings > Creds'
        ),
        path: 'creds',
      },
      {
        element: dynamicElement(() => import('@/routes/settings/about/page'), 'Settings > About'),
        path: 'about',
      },
      {
        element: dynamicElement(() => import('@/routes/settings/messenger/page'), 'Settings > Messenger'),
        path: 'messenger',
      },
      // 同一页读 `:platform` 切换列表/详情（嵌套路由参数）
      {
        element: dynamicElement(() => import('@/routes/settings/messenger/page'), 'Settings > Messenger > Platform'),
        path: 'messenger/:platform',
      },
      {
        element: dynamicElement(
          () => import('@/routes/settings/empty').then((m) => ({ default: m.ConnectorPage })),
          'Settings > Connector'
        ),
        path: 'connector',
      },
      {
        element: dynamicElement(
          () => import('@/routes/settings/empty').then((m) => ({ default: m.SkillPage })),
          'Settings > Skill'
        ),
        path: 'skill',
      },
      {
        element: dynamicElement(
          () => import('@/routes/settings/empty').then((m) => ({ default: m.ServiceModelPage })),
          'Settings > ServiceModel'
        ),
        path: 'service-model',
      },
      {
        children: [
          {
            element: dynamicElement(() => import('@/routes/settings/provider/page'), 'Settings > Provider'),
            index: true,
          },
          {
            element: dynamicElement(() => import('@/routes/settings/provider/all/page'), 'Settings > Provider > All'),
            path: 'all',
          },
          {
            element: dynamicElement(
              () => import('@/routes/settings/provider/$id/page'),
              'Settings > Provider > Detail'
            ),
            path: ':id',
          },
        ],
        element: dynamicLayout(() => import('@/routes/settings/provider/_layout'), 'Settings > ProviderLayout'),
        path: 'provider',
      },
    ],
    element: dynamicLayout(() => import('@/routes/settings/_layout'), 'SettingsLayout'),
    path: 'settings',
  },

  // —— Community ——
  {
    children: [
      {
        element: dynamicElement(() => import('@/routes/community/page'), 'Community'),
        index: true,
      },
      {
        element: dynamicElement(() => import('@/routes/community/agent/page'), 'Community > Agent'),
        path: 'agent',
      },
      {
        element: dynamicElement(() => import('@/routes/community/model/page'), 'Community > Model'),
        path: 'model',
      },
      {
        element: dynamicElement(() => import('@/routes/community/provider/page'), 'Community > Provider'),
        path: 'provider',
      },
    ],
    element: dynamicLayout(() => import('@/routes/community/_layout'), 'CommunityLayout'),
    path: 'community',
  },

  // —— Dev (dev-only; production can 404 later) ——
  ...(import.meta.env.DEV
    ? ([
        {
          children: [
            {
              element: dynamicElement(() => import('@/features/dev/WebSearchPage'), 'Dev > WebSearch'),
              path: 'web-search',
            },
            {
              element: dynamicElement(() => import('@/features/dev/EmailServicePage'), 'Dev > EmailService'),
              path: 'email-service',
            },
            {
              element: dynamicElement(() => import('@/features/dev/EmailTemplatesPage'), 'Dev > EmailTemplates'),
              path: 'email-templates',
            },
            {
              element: dynamicElement(() => import('@/features/dev/S3Page'), 'Dev > S3'),
              path: 's3',
            },
            {
              element: dynamicElement(() => import('@/features/dev/ReadFilePage'), 'Dev > ReadFile'),
              path: 'read-file',
            },
            {
              element: dynamicElement(() => import('@/features/dev/DeleteUserPage'), 'Dev > DeleteUser'),
              path: 'delete-user',
            },
            {
              element: dynamicElement(() => import('@/features/dev/WechatConversationPage'), 'Dev > WechatConversation'),
              path: 'wechat-conversation',
            },
          ],
          path: 'dev',
        },
      ] satisfies RouteObject[])
    : []),

  // —— Fallback ——
  // 根路由 errorElement 已静态引入 404，这里再动态 import 无法拆 chunk。
  {
    element: <NotFound />,
    path: '*',
  },
]
