import { z } from 'zod'

import { normalizeLoginIdentifier } from '@/libs/better-auth/shared'

const emailSchema = z.string().trim().min(1, '请输入邮箱地址').email('请输入有效的邮箱地址')

const passwordSchema = z
  .string()
  .min(1, '请输入密码')
  .min(8, '密码至少 8 个字符')
  .max(64, '密码最多 64 个字符')
  .refine((value) => /[a-z]/i.test(value) && /\d/.test(value), '密码须同时包含字母和数字')

const matchingPasswords = <T extends { password: string; confirmPassword: string }>(
  values: T,
  context: z.RefinementCtx
) => {
  if (values.password !== values.confirmPassword) {
    context.addIssue({ code: 'custom', message: '两次输入的密码不一致', path: ['confirmPassword'] })
  }
}

export const signInEmailSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, '请输入邮箱或用户名')
    .superRefine((value, context) => {
      if (normalizeLoginIdentifier(value)) return
      context.addIssue({
        code: 'custom',
        message: value.includes('@') ? '请输入有效的邮箱地址' : '用户名只能包含字母、数字和下划线',
      })
    }),
})

export const signInPasswordSchema = z.object({ password: z.string().min(1, '请输入密码') })

export const signUpSchema = z
  .object({ email: emailSchema, password: passwordSchema, confirmPassword: z.string().min(1, '请确认密码') })
  .superRefine(matchingPasswords)

export const resetPasswordSchema = z
  .object({
    password: z.string().min(1, '请输入新密码').min(8, '密码至少 8 个字符').max(64, '密码最多 64 个字符'),
    confirmPassword: z.string().min(1, '请确认密码'),
  })
  .superRefine(matchingPasswords)

export const changeEmailSchema = z.object({
  newEmail: z.string().trim().min(1, '请输入新邮箱').email('请输入有效的邮箱地址'),
})
