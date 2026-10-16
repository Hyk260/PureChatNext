import type { RouteObject } from 'react-router'

import NotFound from '@/components/404'
import { dynamicElement, dynamicLayout } from '@/utils/router'

/**
 * Web SPA 的 react-router 路由树。
 * Web 和桌面端共用此路由树；桌面端仅替换 fetch 传输层。
 * 布局和页面位于 `src/routes/*`（轻量封装）→ `@/features/*`。
 */

/** `settings/empty` 中的具名导出共用一个代码块，路径对应设置标签页。 */
const SETTINGS_FROM_EMPTY = [
  ['appearance', 'AppearancePage'],
  ['language', 'LanguagePage'],
  ['hotkey', 'HotkeyPage'],
  ['notification', 'NotificationPage'],
  ['stats', 'StatsPage'],
  ['advanced', 'AdvancedPage'],
  ['storage', 'StoragePage'],
  ['memory', 'MemoryPage'],
  ['creds', 'CredsPage'],
  ['connector', 'ConnectorPage'],
  ['service-model', 'ServiceModelPage'],
] as const

function settingsFromEmpty([path, page]: (typeof SETTINGS_FROM_EMPTY)[number]): RouteObject {
  return {
    element: dynamicElement(
      () => import('@/routes/settings/empty').then((mod) => ({ default: mod[page] })),
      `Settings > ${page}`
    ),
    path,
  }
}

const PUBLIC_PAGES = [
  ['help', 'HelpPage'],
  ['privacy', 'PrivacyPage'],
  ['terms', 'TermsPage'],
] as const

function publicPage([path, page]: (typeof PUBLIC_PAGES)[number]): RouteObject {
  return {
    element: dynamicElement(
      () => import('@/features/public/PublicInfoPages').then((mod) => ({ default: mod[page] })),
      page
    ),
    path,
  }
}

export const webRoutes: RouteObject[] = [
  // —— 主页面（首页） ——
  {
    children: [
      {
        element: dynamicElement(() => import('@/routes/main/page'), 'Home'),
        index: true,
      },
    ],
    element: dynamicLayout(() => import('@/routes/main/layout'), 'MainLayout'),
  },

  // —— 聊天 ——
  {
    children: [
      {
        element: dynamicElement(() => import('@/routes/chat/page'), 'Chat'),
        index: true,
      },
    ],
    element: dynamicLayout(() => import('@/routes/chat/layout'), 'ChatLayout'),
    path: 'chat',
  },

  // —— 资源 ——
  {
    children: [
      {
        children: [
          {
            element: dynamicElement(() => import('@/routes/resources/home/page'), 'Resources > Home'),
            index: true,
          },
        ],
        element: dynamicLayout(() => import('@/routes/resources/home/layout'), 'Resources > HomeLayout'),
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
        element: dynamicLayout(() => import('@/routes/resources/library/$id/layout'), 'Resources > LibraryLayout'),
        path: 'library/:id',
      },
    ],
    element: dynamicLayout(() => import('@/routes/resources/layout'), 'ResourcesLayout'),
    path: 'resources',
  },

  {
    element: dynamicElement(() => import('@/features/referrals/AcceptReferralPage'), 'AcceptReferral'),
    path: 'accept-referral',
  },

  // —— 认证与账户 ——
  {
    element: dynamicElement(() => import('@/routes/signin/page'), 'SignIn'),
    path: 'signin',
  },
  {
    element: dynamicElement(() => import('@/routes/signup/page'), 'SignUp'),
    path: 'signup',
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
    element: dynamicElement(() => import('@/features/desktop/DesktopAuthorizePage'), 'DesktopAuthorize'),
    path: 'desktop-authorize',
  },
  {
    element: dynamicElement(() => import('@/routes/profile/page'), 'Profile'),
    path: 'profile',
  },

  // —— 公开信息 ——
  ...PUBLIC_PAGES.map(publicPage),
  {
    element: dynamicElement(() => import('@/routes/share/t/$id/page'), 'Share > Topic'),
    path: 'share/t/:id',
  },

  // —— 设置 ——
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
        element: dynamicElement(() => import('@/routes/settings/credits/page'), 'Settings > Credits'),
        path: 'credits',
      },
      {
        element: dynamicElement(() => import('@/routes/settings/usage/page'), 'Settings > Usage'),
        path: 'usage',
      },
      {
        element: dynamicElement(() => import('@/routes/settings/about/page'), 'Settings > About'),
        path: 'about',
      },
      {
        element: dynamicElement(
          () => import('@/routes/settings/system-tools/page'),
          'Settings > System Tools'
        ),
        path: 'system-tools',
      },
      {
        element: dynamicElement(() => import('@/routes/settings/data/page'), 'Settings > Data'),
        path: 'data',
      },
      {
        element: dynamicElement(() => import('@/routes/settings/users/page'), 'Settings > Users'),
        path: 'users',
      },
      {
        element: dynamicElement(() => import('@/routes/settings/web-search/page'), 'Settings > Web Search'),
        path: 'web-search',
      },
      {
        element: dynamicElement(() => import('@/routes/settings/email-service/page'), 'Settings > Email'),
        path: 'email-service',
      },
      {
        element: dynamicElement(() => import('@/routes/settings/read-file/page'), 'Settings > ReadFile'),
        path: 'read-file',
      },
      {
        element: dynamicElement(() => import('@/routes/settings/s3/page'), 'Settings > S3'),
        path: 's3',
      },
      {
        element: dynamicElement(
          () => import('@/routes/settings/qq-conversation/page'),
          'Settings > QQ Conversation'
        ),
        path: 'qq-conversation',
      },
      {
        element: dynamicElement(
          () => import('@/routes/settings/wechat-conversation/page'),
          'Settings > WeChat Conversation'
        ),
        path: 'wechat-conversation',
      },
      {
        element: dynamicElement(() => import('@/routes/settings/messenger/page'), 'Settings > Messenger'),
        path: 'messenger/:platform?',
      },
      {
        element: dynamicElement(() => import('@/routes/settings/skill/page'), 'Settings > Skill'),
        path: 'skill',
      },
      ...SETTINGS_FROM_EMPTY.map(settingsFromEmpty),
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
        element: dynamicLayout(() => import('@/routes/settings/provider/layout'), 'Settings > ProviderLayout'),
        path: 'provider',
      },
    ],
    element: dynamicLayout(() => import('@/routes/settings/layout'), 'SettingsLayout'),
    path: 'settings',
  },

  // —— 社区 ——
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
        element: dynamicElement(() => import('@/routes/community/skill/page'), 'Community > Skill'),
        path: 'skill',
      },
      {
        element: dynamicElement(() => import('@/routes/community/provider/page'), 'Community > Provider'),
        path: 'provider',
      },
    ],
    element: dynamicLayout(() => import('@/routes/community/layout'), 'CommunityLayout'),
    path: 'community',
  },

  // —— 管理 ——
  {
    children: [
      {
        element: dynamicElement(() => import('@/features/admin/web-search/WebSearchPage'), 'Admin > WebSearch'),
        path: 'web-search',
      },
      {
        element: dynamicElement(() => import('@/features/admin/UsersPage'), 'Admin > Users'),
        path: 'users',
      },
      {
        element: dynamicElement(() => import('@/features/admin/email-service/EmailServicePage'), 'Admin > EmailService'),
        path: 'email-service',
      },
      {
        element: dynamicElement(() => import('@/features/admin/read-file/ReadFilePage'), 'Admin > ReadFile'),
        path: 'read-file',
      },
      {
        element: dynamicElement(() => import('@/features/admin/s3/S3Page'), 'Admin > S3'),
        path: 's3',
      },
      {
        element: dynamicElement(
          () => import('@/features/admin/qq-conversation/QqConversationPage'),
          'Admin > QqConversation'
        ),
        path: 'qq-conversation',
      },
      {
        element: dynamicElement(
          () => import('@/features/admin/wechat-conversation/WechatConversationPage'),
          'Admin > WechatConversation'
        ),
        path: 'wechat-conversation',
      },
    ],
    element: dynamicLayout(() => import('@/routes/admin/layout'), 'AdminLayout'),
    path: 'admin',
  },

  // —— 开发工具（仅开发环境；生产环境后续可返回 404） ——
  ...(import.meta.env.DEV
    ? ([
        {
          children: [
            {
              element: dynamicElement(() => import('@/features/dev/CodeBlockPage'), 'Dev > CodeBlock'),
              path: 'code-block',
            },
            {
              element: dynamicElement(() => import('@/features/dev/ApprovalCardPage'), 'Dev > ApprovalCard'),
              path: 'approval-card',
            },
            {
              element: dynamicElement(() => import('@/features/dev/ContextWindowPage'), 'Dev > ContextWindow'),
              path: 'context-window',
            },
            {
              element: dynamicElement(() => import('@/features/referrals/AcceptReferralPage'), 'Dev > AcceptReferral'),
              path: 'accept-referral',
            },
            {
              element: dynamicElement(() => import('@/features/desktop/DesktopLoginPage'), 'Dev > DesktopLogin'),
              path: 'desktop-login',
            },
            {
              element: dynamicElement(
                () => import('@/features/desktop/DesktopAuthorizePage'),
                'Dev > DesktopAuthorize'
              ),
              path: 'desktop-authorize',
            },
          ],
          element: dynamicLayout(() => import('@/routes/dev/layout'), 'DevLayout'),
          path: 'dev',
        },
      ] satisfies RouteObject[])
    : []),

  // —— 兜底路由 ——
  // 根路由 errorElement 已静态引入 404，这里再动态 import 无法拆 chunk。
  {
    element: <NotFound />,
    path: '*',
  },
]
