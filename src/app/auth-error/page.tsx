'use client'

import { Button, Card } from 'antd'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, memo } from 'react'

import Loading from '@/components/Loading/BrandTextLoading'

const ERROR_MESSAGES: Record<string, string> = {
  ACCOUNT_ALREADY_LINKED_TO_DIFFERENT_USER: '该第三方账户已关联到其他用户',
  ACCOUNT_NOT_LINKED:
    '该邮箱已注册，但尚未关联此登录方式。请使用邮箱密码或魔法链接登录；登录成功后可在账户设置中关联 GitHub。',
  EMAIL_IS_MISSING: '第三方登录未返回邮箱，无法完成登录',
  EMAIL_NOT_FOUND: '第三方登录未返回邮箱，无法完成登录',
  EXPIRED_TOKEN: '登录链接已过期，请重新获取',
  FAILED_TO_GET_USER_INFO: '获取用户信息失败，请重试',
  FAILED_TO_GET_USER_INFO_BY_EMAIL: '通过邮箱获取用户信息失败',
  FAILED_TO_SEND_EMAIL: '发送邮件失败，请稍后重试',
  FAILED_TO_UNLINK_LAST_ACCOUNT: '无法解除最后一个关联账户',
  FAILED_TO_VERIFY_EMAIL: '邮箱验证失败',
  INTERNAL_SERVER_ERROR: '服务器内部错误，请稍后重试',
  INVALID_CALLBACK_REQUEST: '无效的登录回调请求，请重试',
  INVALID_CODE: '授权码无效或已过期，请重新登录',
  INVALID_TOKEN: '无效的登录链接',
  INVALID_ORIGIN: '请求来源不合法',
  NO_CODE: '授权失败，未收到授权码',
  OAUTH_PROVIDER_NOT_FOUND: '未找到此登录方式',
  PROVIDER_NOT_FOUND: '未找到此登录方式',
  RATE_LIMIT_EXCEEDED: '请求过于频繁，请稍后重试',
  SESSION_EXPIRED: '登录已过期，请重新登录',
  UNABLE_TO_LINK_ACCOUNT: '无法关联第三方账户，请稍后重试',
  UNABLE_TO_GET_USER_INFO: '获取用户信息失败，请重试',
  UNEXPECTED_ERROR: '发生了未知错误，请稍后重试',
  UNKNOWN: '发生了未知错误，请稍后重试',
  USER_ALREADY_EXISTS: '该账户已存在',
  USER_NOT_FOUND: '未找到该用户',
}

const normalizeErrorCode = (code: string | null) => {
  if (!code) return 'UNKNOWN'
  return code.trim().replace(/\s+/g, '_').toUpperCase()
}

const AuthErrorContent = memo(() => {
  const searchParams = useSearchParams()
  const errorCode = normalizeErrorCode(searchParams.get('error'))
  const errorDescription = searchParams.get('error_description')?.trim()
  const description = errorDescription || ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.UNKNOWN

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card title={<div className="text-2xl">登录失败</div>}>
          <div className="mb-6 text-sm leading-relaxed text-muted-foreground">{description}</div>
          <div className="flex flex-col gap-3">
            <Link className="block w-full" href="/signin">
              <Button block type="primary">
                返回登录
              </Button>
            </Link>
            <Link className="block w-full" href="/">
              <Button block>返回首页</Button>
            </Link>
          </div>
          <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
            若问题持续出现，请尝试清除浏览器缓存后重试，或联系管理员。
          </p>
        </Card>
      </div>
    </div>
  )
})

AuthErrorContent.displayName = 'AuthErrorContent'

const AuthErrorPage = () => {
  return (
    <Suspense fallback={<Loading debugId="AuthError" />}>
      <AuthErrorContent />
    </Suspense>
  )
}

export default AuthErrorPage
