# 邮件服务

一个灵活的邮件服务实现，支持多种邮件提供商。

## 架构

基于搜索服务模式，本服务为跨不同提供商发送邮件提供了统一接口。

```plaintext
EmailService
  └── EmailServiceImpl (接口)
      └── NodemailerImpl (SMTP 提供商)
```

## 使用方式

### 基础示例

```typescript
import { EmailService } from '@/server/services/email'

const emailService = new EmailService()

// 发送一封简单的文本邮件
await emailService.sendMail({
  from: 'noreply@example.com',
  to: 'user@example.com',
  subject: '欢迎来到 PureChat',
  text: '感谢注册！',
  html: '<p>感谢注册！</p>',
})
```

### 多个收件人

```typescript
await emailService.sendMail({
  from: 'team@example.com',
  to: ['user1@example.com', 'user2@example.com'],
  subject: '团队更新',
  text: '查看我们的最新更新',
})
```

### 带附件

```typescript
await emailService.sendMail({
  from: 'support@example.com',
  to: 'user@example.com',
  subject: '您的发票',
  text: '请查收附件中的发票。',
  attachments: [
    {
      filename: 'invoice.pdf',
      path: '/path/to/invoice.pdf',
    },
  ],
})
```

### 设置回复地址

```typescript
await emailService.sendMail({
  from: 'noreply@example.com',
  replyTo: 'support@example.com',
  to: 'user@example.com',
  subject: '联系我们',
  text: '回复此邮件获取支持。',
})
```

## 配置

### 环境变量

通过环境变量配置 SMTP 设置：

```bash
# SMTP 服务器配置
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false # 端口 465 设为 true，其他端口设为 false
SMTP_USER=your-username
SMTP_PASS=your-password
```

### Resend

如果你偏好使用 Resend，配置以下环境变量，并使用 `EmailImplType.Resend` 初始化服务：

```bash
RESEND_API_KEY=your-resend-api-key
RESEND_FROM=noreply@example.com
```

当 `from` 未在请求中提供时，将使用 `RESEND_FROM`。

### 通过环境变量选择提供商

设置 `EMAIL_SERVICE_PROVIDER` 为 `nodemailer` 或 `resend`，无需修改代码即可选择默认实现：

```bash
EMAIL_SERVICE_PROVIDER=resend
```

### 使用知名服务

你也可以使用知名的邮件服务（Gmail、SendGrid 等）：

```typescript
import { EmailImplType, EmailService } from '@/server/services/email'
import { NodemailerImpl } from '@/server/services/email/impls/nodemailer'

const emailService = new EmailService(EmailImplType.Nodemailer)
// 在构造函数中配置服务名称
```

### 使用 Ethereal 测试

在开发和测试阶段，可使用 [Ethereal Email](https://ethereal.email/)：

```typescript
// 预览 URL 会在开发环境中自动打印日志
const result = await emailService.sendMail({...});
console.log('Preview URL:', result.previewUrl);
```

## 验证连接

发送邮件前，验证你的 SMTP 配置：

```typescript
import { EmailService } from '@/server/services/email'

const emailService = new EmailService()

try {
  await emailService.verify()
  console.log('SMTP 连接验证通过 ✓')
} catch (error) {
  console.error('SMTP 验证失败:', error)
}
```

## 与 Better-Auth 集成

邮件验证集成示例：

```typescript
import { betterAuth } from 'better-auth'

import { EmailService } from '@/server/services/email'

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    sendResetPasswordEmail: async ({ user, url }) => {
      const emailService = new EmailService()

      await emailService.sendMail({
        from: 'noreply@purechat.com',
        to: user.email,
        subject: '重置你的密码',
        text: `点击此处重置你的密码：${url}`,
        html: `
          <h1>重置你的密码</h1>
          <p>点击下方链接重置你的密码：</p>
          <a href="${url}">重置密码</a>
        `,
      })
    },
  },
  emailVerification: {
    enabled: true,
    sendVerificationEmail: async ({ user, url }) => {
      const emailService = new EmailService()

      await emailService.sendMail({
        from: 'noreply@purechat.com',
        to: user.email,
        subject: '验证你的邮箱',
        text: `点击此处验证你的邮箱：${url}`,
        html: `
          <h1>验证你的邮箱</h1>
          <p>点击下方链接验证你的邮箱地址：</p>
          <a href="${url}">验证邮箱</a>
        `,
      })
    },
  },
})
```

## 添加新的提供商

要添加新的邮件提供商（例如 Resend、SendGrid）：

1. 在 `impls/[provider-name]/index.ts` 中创建提供商实现：

```typescript
import { EmailPayload, EmailResponse, EmailServiceImpl } from '../type'

export class ResendImpl implements EmailServiceImpl {
  async sendMail(payload: EmailPayload): Promise<EmailResponse> {
    // 使用 Resend API 实现
  }
}
```

2. 在 `impls/index.ts` 中添加枚举值：

```typescript
export enum EmailImplType {
  Nodemailer = 'nodemailer',
  Resend = 'resend', // 添加新提供商
}
```

3. 在 `impls/index.ts` 中更新工厂函数：

```typescript
export const createEmailServiceImpl = (type: EmailImplType) => {
  switch (type) {
    case EmailImplType.Nodemailer:
      return new NodemailerImpl()
    case EmailImplType.Resend:
      return new ResendImpl()
    default:
      return new NodemailerImpl()
  }
}
```

## 错误处理

服务会针对各种失败场景抛出普通 `Error`：

```typescript
try {
  await emailService.sendMail({...});
} catch (error) {
  if (error instanceof Error) {
    // 根据 error.message / error.cause 处理
  }
}
```

## 调试

启用调试日志：

```bash
DEBUG=email:* node your-app.js
```

这将输出邮件发送操作的详细信息。
