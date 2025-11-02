# 环境变量配置指南

## 创建环境变量文件

在项目根目录创建 `.env.local` 文件，并添加以下配置：

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

## 获取 Supabase 配置

1. 登录 [Supabase](https://supabase.com)
2. 创建新项目或选择现有项目
3. 进入项目设置（Settings）
4. 点击 API 选项卡
5. 复制以下信息：
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 配置说明

### NEXT_PUBLIC_SUPABASE_URL
Supabase 项目的 URL，格式通常是：`https://xxxxx.supabase.co`

### NEXT_PUBLIC_SUPABASE_ANON_KEY
Supabase 的匿名/公开密钥，用于客户端访问。

### ALLOWED_ORIGINS
允许跨域请求的源地址。在生产环境中，应该设置为你的实际域名。

示例：
- 开发环境：`http://localhost:3000`
- 生产环境：`https://yourdomain.com,https://www.yourdomain.com`

### NODE_ENV
运行环境，通常为 `development` 或 `production`。

## 安全提示

⚠️ **重要**：
- `.env.local` 文件已添加到 `.gitignore`，不会被提交到 Git
- 不要在生产环境中使用 `NEXT_PUBLIC_*` 前缀暴露敏感信息
- `ALLOWED_ORIGINS` 不要在生产环境中使用 `*`

