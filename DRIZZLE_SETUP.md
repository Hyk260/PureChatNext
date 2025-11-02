# Drizzle ORM 配置和运行指南

本指南将帮助您配置和使用 Drizzle ORM 连接 Supabase 数据库，并创建 User 表。

## 📋 前置要求

1. 已安装项目依赖：`pnpm install` 或 `npm install`
2. 已创建 Supabase 项目
3. 已配置 `.env.local` 文件（参考 `ENV_SETUP.md`）

## 🔧 配置步骤

### 1. 配置环境变量

在 `.env.local` 文件中添加 Supabase 数据库连接字符串：

```env
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

**获取连接字符串的方法：**
1. 登录 Supabase 控制台
2. 进入项目设置 → Database
3. 在 Connection string 部分选择 URI 模式
4. 复制连接字符串并替换 `[YOUR-PASSWORD]` 为实际数据库密码

### 2. 验证配置

运行以下命令检查 Drizzle 配置是否正确：

```bash
pnpm db:check
```

## 🚀 使用步骤

### 步骤 1: 生成迁移文件

根据 `src/database/schema.ts` 中的定义生成数据库迁移文件：

```bash
pnpm db:generate
```

这将在 `src/database/migrations` 目录下创建新的迁移文件。

### 步骤 2: 运行迁移

将迁移应用到 Supabase 数据库：

```bash
pnpm db:migrate
```

### 步骤 3: 验证表已创建（可选）

打开 Drizzle Studio 查看数据库结构：

```bash
pnpm db:studio
```

这将在浏览器中打开 Drizzle Studio，您可以查看和编辑数据库内容。

## 📊 当前 Schema

项目已定义 User 表，位于 `src/database/schema.ts`：

```typescript
export const user = pgTable("User", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  email: varchar("email", { length: 64 }).notNull(),
  password: varchar("password", { length: 64 }),
});
```

## 📝 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm db:check` | 检查 Drizzle 配置是否正确 |
| `pnpm db:generate` | 根据 schema 生成迁移文件 |
| `pnpm db:migrate` | 运行迁移，将更改应用到数据库 |
| `pnpm db:studio` | 打开 Drizzle Studio 可视化工具 |

## 🛠️ 修改 Schema 并更新数据库

1. 编辑 `src/database/schema.ts` 文件
2. 运行 `pnpm db:generate` 生成新的迁移文件
3. 运行 `pnpm db:migrate` 应用更改

## ⚠️ 注意事项

1. **生产环境**：建议使用连接池模式（端口 6543）以提高性能和连接管理
2. **迁移文件**：不要手动编辑生成的迁移文件
3. **备份**：在生产环境运行迁移前，请先备份数据库
4. **密码安全**：确保 `.env.local` 文件已添加到 `.gitignore`，不要提交到版本控制

## 🔍 故障排除

### 错误：缺少 DATABASE_URL 环境变量
- 检查 `.env.local` 文件是否存在
- 确认 `DATABASE_URL` 已正确配置
- 重启开发服务器

### 错误：连接数据库失败
- 检查 Supabase 项目是否正常运行
- 验证数据库密码是否正确
- 确认网络连接是否正常
- 检查 Supabase 项目的 IP 白名单设置（如果启用了）

### 迁移失败
- 检查迁移文件是否已存在冲突
- 查看 Supabase 日志获取详细错误信息
- 确认数据库用户有足够权限执行 DDL 操作

