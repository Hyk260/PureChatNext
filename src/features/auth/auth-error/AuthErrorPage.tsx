'use client'

import { Flex, Button, Typography } from 'antd'
import { cssVar } from 'antd-style'
import Link from '@/utils/link'
import { useSearchParams } from '@/utils/navigation'
import { Suspense, memo } from 'react'

import { AuthPageContainer } from '@/components/AuthPageContainer'
import AuthCard from '@/features/AuthCard'

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

const normalizeErrorCode = (code?: string | null) => {
  return (code || 'UNKNOWN').trim().toUpperCase().replaceAll('-', '_').replace(/\s+/g, '_')
}

const AuthErrorContent = memo(() => {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')?.trim()

  const code = normalizeErrorCode(error)
  const description = errorDescription || ERROR_MESSAGES[code] || ERROR_MESSAGES.UNKNOWN

  return (
    <AuthPageContainer>
      <AuthCard
        footer={
          <Flex vertical gap={12} justify='center' wrap='wrap'>
            <Link href='/signin'>
              <Button block size='large' type='primary'>
                返回登录
              </Button>
            </Link>
            <Link href='/'>
              <Button block size='large'>
                返回首页
              </Button>
            </Link>
          </Flex>
        }
        subtitle={description}
        title='登录失败'
      >
        <Typography.Text style={{ fontFamily: cssVar.fontFamilyCode }} type='secondary'>
          ErrorCode: {error || 'UNKNOWN'}
        </Typography.Text>
      </AuthCard>
    </AuthPageContainer>
  )
})

AuthErrorContent.displayName = 'AuthErrorContent'

const AuthErrorPage = () => {
  return (
    <Suspense fallback={null}>
      <AuthErrorContent />
    </Suspense>
  )
}

export default AuthErrorPage
