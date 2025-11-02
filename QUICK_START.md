# 快速开始指南

## 1. 安装依赖

```bash
pnpm install
```

## 2. 配置 Supabase

### 2.1 创建 Supabase 项目

1. 访问 [https://supabase.com](https://supabase.com)
2. 注册/登录账号
3. 创建新项目
4. 等待项目创建完成（通常需要 1-2 分钟）

### 2.2 获取配置信息

1. 进入项目后，点击左侧菜单的 **Settings**（设置）
2. 点击 **API** 选项卡
3. 复制以下信息：
   - **Project URL** → 用作 `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → 用作 `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 2.3 配置认证

1. 点击左侧菜单的 **Authentication**（认证）
2. 确保 **Email** 认证方式已启用（默认已启用）
3. 可以根据需要调整其他设置（如密码强度要求等）

## 3. 配置环境变量

在项目根目录创建 `.env.local` 文件：

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
ALLOWED_ORIGINS=http://localhost:3000
NODE_ENV=development
```

⚠️ **注意**：将上面的 URL 和 KEY 替换为你从 Supabase 获取的实际值。

## 4. 启动开发服务器

```bash
pnpm dev
```

## 5. 测试认证功能

1. 打开浏览器访问：`http://localhost:3000/test-auth`
2. 尝试注册一个新账号
3. 注册成功后会自动登录
4. 测试获取当前用户信息
5. 测试登出功能

## 6. API 接口测试

你也可以使用 Postman、curl 或其他工具测试 API：

### 注册用户
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### 登录
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### 获取当前用户（需要 token）
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 常见问题

### Q: 登录时提示 "Invalid login credentials"
**A**: 检查邮箱和密码是否正确，或先使用注册接口创建账号。

### Q: 提示 "Missing Supabase environment variables"
**A**: 确保已创建 `.env.local` 文件，并且环境变量名称正确。

### Q: CORS 错误
**A**: 检查 `.env.local` 中的 `ALLOWED_ORIGINS` 是否包含你的前端地址。

### Q: Token 过期
**A**: Token 会自动刷新，如果仍然失败，需要重新登录。

## 下一步

- 查看 [README.md](./README.md) 了解完整的 API 文档
- 查看 [ENV_SETUP.md](./ENV_SETUP.md) 了解环境变量详细配置
- 开始开发你的应用功能！

