export type FrontendRoute = {
  href: string
  label: string
}

export type FrontendRouteGroup = {
  adminOnly?: boolean
  title: string
  routes: FrontendRoute[]
}

export const FRONTEND_ROUTE_GROUPS: FrontendRouteGroup[] = [
  {
    title: '主要',
    routes: [
      { href: '/', label: '首页' },
      { href: '/chat', label: '聊天' },
      { href: '/community', label: '社区' },
      { href: '/resources', label: '资源' },
    ],
  },
  {
    title: '认证',
    routes: [
      { href: '/signin', label: '登录' },
      { href: '/signup', label: '注册' },
      { href: '/login', label: '登录（旧）' },
      { href: '/reset-password', label: '重置密码' },
      { href: '/verify-email', label: '验证邮箱' },
      { href: '/auth-error', label: '认证错误' },
    ],
  },
  {
    title: '用户',
    routes: [
      { href: '/profile', label: '个人资料' },
      { href: '/settings', label: '设置' },
      { href: '/settings/profile', label: '账号设置' },
      { href: '/protected', label: '受保护页' },
    ],
  },
  {
    adminOnly: true,
    title: '管理',
    routes: [
      { href: '/admin/web-search', label: '联网搜索' },
      { href: '/admin/users', label: '用户管理' },
      { href: '/admin/email-service', label: '邮件服务' },
      { href: '/admin/read-file', label: '文件读取' },
      { href: '/admin/s3', label: 'S3 测试' },
    ],
  },
  {
    title: '开发',
    routes: [
      { href: '/dev/wechat-conversation', label: '微信对话' },
      { href: '/dev/qq-conversation', label: 'QQ 对话' },
      { href: '/dev/code-block', label: 'CodeBlock' },
      { href: '/dev/approval-card', label: 'ApprovalCard' },
    ],
  },
]
