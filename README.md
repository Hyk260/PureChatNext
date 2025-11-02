# PureChatNext

这是一个基于 [Next.js](https://nextjs.org) 的项目，使用 Supabase 作为后端数据库和认证服务。

## 功能特性

- ✅ 用户认证（登录、注册、登出）
- ✅ JWT Token 鉴权
- ✅ CORS 跨域支持
- ✅ Supabase 集成
- ✅ TypeScript 支持

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

复制 `.env.example` 文件并重命名为 `.env.local`，然后填入你的 Supabase 配置：

```env
# Supabase 配置
# 从 Supabase 项目设置中获取这些值
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# CORS 配置
# 允许的源（多个用逗号分隔，* 表示允许所有源）
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Node 环境
NODE_ENV=development
```

### 3. 设置 Supabase

1. 前往 [Supabase](https://supabase.com) 创建项目
2. 在项目设置中获取以下信息：
   - Project URL
   - Anon/Public Key
3. 将这些值填入 `.env.local` 文件

### 4. 运行开发服务器

```bash
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看应用。

## API 接口

### 认证相关

#### 1. 用户注册
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### 2. 用户登录
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

响应示例：
```json
{
  "message": "登录成功",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "created_at": "2024-01-01T00:00:00Z"
  },
  "session": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "refresh-token",
    "expires_at": 1234567890
  }
}
```

#### 3. 获取当前用户信息
```http
GET /api/auth/me
Authorization: Bearer <access_token>
```

#### 4. 用户登出
```http
POST /api/auth/logout
Authorization: Bearer <access_token>
```

#### 5. 刷新 Token
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refresh_token": "your_refresh_token"
}
```

## 项目结构

```
PureChatNext/
├── app/
│   ├── api/
│   │   └── auth/          # 认证相关 API 路由
│   │       ├── login/     # 登录接口
│   │       ├── register/  # 注册接口
│   │       ├── logout/    # 登出接口
│   │       ├── me/        # 获取当前用户
│   │       └── refresh/   # 刷新 Token
│   ├── layout.tsx         # 根布局
│   └── page.tsx           # 首页
├── lib/
│   ├── supabase/          # Supabase 客户端配置
│   │   ├── client.ts      # 客户端 Supabase
│   │   └── server.ts      # 服务端 Supabase
│   ├── auth/              # 认证相关工具
│   │   └── middleware.ts  # 鉴权中间件
│   ├── utils/             # 工具函数
│   │   └── cors.ts        # CORS 中间件
│   └── types/             # TypeScript 类型定义
│       └── auth.ts        # 认证类型
├── .env.example           # 环境变量示例
├── next.config.ts         # Next.js 配置
└── package.json           # 项目依赖
```

## 使用示例

### 前端调用登录接口

```typescript
async function login(email: string, password: string) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();
  
  if (response.ok) {
    // 保存 token
    localStorage.setItem('access_token', data.session.access_token);
    localStorage.setItem('refresh_token', data.session.refresh_token);
    return data;
  } else {
    throw new Error(data.error);
  }
}
```

### 调用需要鉴权的接口

```typescript
async function getCurrentUser() {
  const token = localStorage.getItem('access_token');
  
  const response = await fetch('/api/auth/me', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();
  
  if (response.ok) {
    return data.user;
  } else {
    throw new Error(data.error);
  }
}
```

## 技术栈

- **框架**: Next.js 16
- **语言**: TypeScript
- **数据库**: Supabase
- **样式**: Tailwind CSS
- **包管理**: pnpm

## 开发

```bash
# 开发模式
pnpm dev

# 构建生产版本
pnpm build

# 启动生产服务器
pnpm start

# 代码检查
pnpm lint
```

## 部署

该项目可以部署到 [Vercel](https://vercel.com) 或其他支持 Next.js 的平台。

部署前请确保：
1. 设置环境变量
2. 配置 CORS 允许的源
3. 确保 Supabase 项目配置正确

## 许可证

查看 [LICENSE](LICENSE) 文件了解详情。
