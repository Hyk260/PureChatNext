export type FrontendRoute = {
  href: string
  label: string
}

export type FrontendRouteGroup = {
  title: string
  routes: FrontendRoute[]
}

export const FRONTEND_ROUTE_GROUPS: FrontendRouteGroup[] = [
  {
    title: '主要',
    routes: [
      { href: '/', label: '首页' },
      { href: '/welcome', label: '欢迎页' },
      { href: '/chat', label: '聊天' },
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
      { href: '/settings/profile', label: '账号设置' },
      { href: '/protected', label: '受保护页' },
    ],
  },
  {
    title: '开发',
    routes: [
      { href: '/dev/email-service', label: '邮件服务' },
      { href: '/dev/email-templates', label: '邮件模板' },
      { href: '/dev/read-file', label: '文件读取' },
      { href: '/dev/s3', label: 'S3 测试' },
      { href: '/dev/web-search', label: '联网搜索' },
    ],
  },
]
