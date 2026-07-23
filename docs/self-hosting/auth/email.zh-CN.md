# 邮件服务配置

邮件服务用于邮箱验证、密码重置和魔法链接发送。支持两种邮件服务提供商。

## Nodemailer（SMTP）

使用 SMTP 协议发送邮件，适合已有邮箱服务的用户。参考 [Nodemailer SMTP 文档](https://nodemailer.com/smtp/)。

| 环境变量                 | 类型 | 描述                                                          | 示例                             |
| ------------------------ | ---- | ------------------------------------------------------------- | -------------------------------- |
| `EMAIL_SERVICE_PROVIDER` | 可选 | 设置为 `nodemailer`（默认值）                                 | `nodemailer`                     |
| `SMTP_HOST`              | 必选 | SMTP 服务器主机名                                             | `gz-smtp.qcloudmail.com`         |
| `SMTP_PORT`              | 必选 | SMTP 服务器端口（TLS 通常为 `587`，SSL 为 `465`）             | `465`                            |
| `SMTP_SECURE`            | 可选 | SSL 设置为 `true`（端口 465），TLS 设置为 `false`（端口 587） | `true`                           |
| `SMTP_USER`              | 必选 | SMTP 认证用户名（通常为发信地址）                             | `noreply@purechat.cn`            |
| `SMTP_PASS`              | 必选 | SMTP 认证密码                                                 | `your-smtp-password`             |
| `SMTP_FROM`              | 可选 | 发件人地址，默认为 `SMTP_USER`                                | `PureChat <noreply@purechat.cn>` |

## 腾讯云邮件推送（推荐）

适用于 `.cn` 域名与国内投递，与 Vercel 部署兼容（使用 465/587 端口，勿用 25）。

控制台：[腾讯云邮件推送](https://console.cloud.tencent.com/ses)

> **注意**：2026-03-02 后新开通的个人认证账号不再支持 SMTP 发信，需完成**企业认证**或使用 API 发信。

### 第一步：控制台配置

1. 开通邮件推送并完成**企业认证**。
2. 进入 **邮件配置 → 发信域名 → 新建**，添加发信域名 `purechat.cn`（使用根域，不要用 `next.purechat.cn`）。
3. 进入 **邮件配置 → 发信地址 → 新建**，创建 `noreply@purechat.cn`。
4. 在发信地址操作栏点击 **设置 SMTP 密码**，保存专用密码（非腾讯云登录密码）。

### 第二步：DNS 验证

在域名 DNS 服务商处为 `purechat.cn` 添加记录（**以控制台显示的值为准**）：

| 类型        | 主机记录            | 记录值（示例）                       |
| ----------- | ------------------- | ------------------------------------ |
| MX          | `@`                 | `mxbiz1.qq.com.`                     |
| TXT (SPF)   | `@`                 | `v=spf1 include:qcloudmail.com ~all` |
| TXT (DKIM)  | `qcloud._domainkey` | 控制台生成的唯一值                   |
| TXT (DMARC) | `_dmarc`            | `v=DMARC1; p=none`                   |

**SPF 冲突**：若 `purechat.cn` 已用于企业邮箱，需合并 SPF（同一域名只能有一条 SPF TXT），例如：

```txt
v=spf1 include:qcloudmail.com include:spf.mail.qq.com ~all
```

验证命令：

```bash
dig txt +short purechat.cn
dig txt +short qcloud._domainkey.purechat.cn
dig txt +short _dmarc.purechat.cn
```

DNS 同步后，在控制台点击 **验证**，状态变为「已验证」即可。

### 第三步：SMTP 接入点

| 地域 | `SMTP_HOST`              |
| ---- | ------------------------ |
| 广州 | `gz-smtp.qcloudmail.com` |
| 香港 | `smtp.qcloudmail.com`    |

在控制台 **SMTP 服务地址** 页确认你的账号应使用哪一个。

**Vercel 推荐配置**（465 + SSL）：

```bash
EMAIL_SERVICE_PROVIDER=nodemailer
SMTP_HOST=gz-smtp.qcloudmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=noreply@purechat.cn
SMTP_PASS=控制台设置的SMTP专用密码
SMTP_FROM=PureChat <noreply@purechat.cn>
```

**587 + STARTTLS 备选**：

```bash
SMTP_PORT=587
SMTP_SECURE=false
```

### 第四步：Vercel 环境变量

在 Vercel Project Settings → Environment Variables → **Production** 配置：

```bash
APP_URL=https://next.purechat.cn
EMAIL_SERVICE_PROVIDER=nodemailer
SMTP_HOST=gz-smtp.qcloudmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=noreply@purechat.cn
SMTP_PASS=你的SMTP专用密码
SMTP_FROM=PureChat <noreply@purechat.cn>
```

删除或留空 `RESEND_API_KEY`、`RESEND_FROM`，避免误用 Resend。

`APP_URL` 必须设为生产域名 `https://next.purechat.cn`，否则认证邮件中的链接会指向 `*.vercel.app` 预览域。

本地开发请设 `APP_URL=http://localhost:5174`（与 SPA 同源；`/api` 经 Vite 代理到 Next），不要用 `:3000`。详见 [env-setup.zh-CN.md · APP\_URL](../../env-setup.zh-CN.md#app_url)。

变更环境变量后需重新 Deploy。

### 发信限制

- 同一 AppId：约 20 封/秒
- 同一发信人对同一收信人：约 10 封/小时

## Resend

[Resend](https://resend.com/) 是一个现代邮件 API 服务，配置简单。

| 环境变量                 | 类型 | 描述                                       | 示例                        |
| ------------------------ | ---- | ------------------------------------------ | --------------------------- |
| `EMAIL_SERVICE_PROVIDER` | 必选 | 设置为 `resend`                            | `resend`                    |
| `RESEND_API_KEY`         | 必选 | Resend API Key                             | `re_xxxxxxxxxxxxxxxxxxxxxx` |
| `RESEND_FROM`            | 推荐 | 发件人地址，需为 Resend 已验证域名下的邮箱 | `noreply@your-domain.com`   |

使用 Resend 前需先 [验证发件域名](https://resend.com/docs/dashboard/domains/introduction)，否则只能发送到自己的邮箱。

## 测试与验证

### 开发环境

复制 `.env.example` 中邮件相关变量到 `.env.local`，填入真实 `SMTP_PASS` 后启动 `pnpm dev`。

访问 `/dev/email-service`：

1. Provider 选 **Nodemailer**
2. 点击 **Verify** 验证 SMTP 连接
3. 发送测试邮件

或通过 API：

```bash
curl -X POST http://localhost:3000/api/dev/email \
  -H "Content-Type: application/json" \
  -d '{"action":"verify","impl":"nodemailer"}'
```

### 业务流验收

- \[ ] 注册验证邮件（若 `AUTH_EMAIL_VERIFICATION=1`）
- \[ ] 忘记密码邮件
- \[ ] 魔法链接（若 `AUTH_ENABLE_MAGIC_LINK=1`）
- \[ ] 修改邮箱确认邮件
- \[ ] 邮件内链接指向 `https://next.purechat.cn/...`

## 邮箱验证

启用邮箱验证以确保用户拥有其注册的邮箱地址（默认关闭）：

| 环境变量                       | 类型 | 描述                                                         |
| ------------------------------ | ---- | ------------------------------------------------------------ |
| `AUTH_EMAIL_VERIFICATION`      | 可选 | 设置为 `1` 以要求注册后进行邮箱验证                          |
| `AUTH_EMAIL_VERIFICATION_MODE` | 可选 | 注册验证方式：`otp`（6 位验证码，默认）或 `link`（邮件链接） |

邮箱验证需要上方已配置好的邮件服务（SMTP 或 Resend）。启用后，用户必须验证其邮箱地址才能登录。

## 魔法链接（免密）登录

启用魔法链接登录（依赖上方已配置好的邮件服务，默认关闭）：

| 环境变量                 | 类型 | 描述                                      |
| ------------------------ | ---- | ----------------------------------------- |
| `AUTH_ENABLE_MAGIC_LINK` | 可选 | 设置为 `1` 以启用魔法链接登录（默认关闭） |
