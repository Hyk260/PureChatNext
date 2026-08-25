# Drizzle ORM 配置和运行指南

本指南介绍如何使用 Drizzle ORM 连接 PostgreSQL（Supabase 或本地实例）并管理数据库迁移。

## 📋 前置要求

1. 已安装项目依赖：`pnpm install` 或 `npm install`
2. 已准备 Supabase 项目或本地 PostgreSQL 17
3. 已配置 `.env.local` 文件（参考 [环境变量配置](../../self-hosting/configuration/environment.md)）

## 🔧 配置步骤

### 1. 配置环境变量

在 `.env.local` 文件中添加 Supabase 数据库连接字符串：

```env
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

本地实例使用：

```env
DATABASE_DRIVER=node
DATABASE_URL=postgresql://purechat:[LOCAL-PASSWORD]@127.0.0.1:5432/purechat
```

本地实例启动方式见 [本地 PostgreSQL 管理](../../self-hosting/infrastructure/postgresql.md)。

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

根据 `packages/database/src/schemas/user.ts` 中的定义生成数据库迁移文件：

```bash
pnpm db:generate
```

这将在 `packages/database/src/migrations` 目录下创建新的迁移文件。

### 步骤 2: 运行迁移

将迁移应用到当前 `DATABASE_URL` 指向的数据库：

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

Schema 位于 `packages/database/src/schemas/`，覆盖用户与 Better Auth、聊天主题/消息、Agent、文件与知识库、渠道绑定和积分账本。迁移文件位于 `packages/database/src/migrations/`，以该目录的 journal 为应用顺序依据。

Docker 生产镜像会在启动应用前自动执行同一组迁移，并使用 PostgreSQL advisory lock 避免多个容器同时修改 schema。Vercel 部署仍需在发布流程中单独执行 `pnpm db:migrate`。

## 📝 常用命令

| 命令               | 说明                           |
| ------------------ | ------------------------------ |
| `pnpm db:check`    | 检查 Drizzle 配置是否正确      |
| `pnpm db:generate` | 根据 schemas 生成迁移文件      |
| `pnpm db:migrate`  | 运行迁移，将更改应用到数据库   |
| `pnpm db:studio`   | 打开 Drizzle Studio 可视化工具 |

## 🛠️ 修改 Schema 并更新数据库

1. 编辑 `packages/database/src/schemas` 文件
2. 运行 `pnpm db:generate` 生成新的迁移文件
3. 运行 `pnpm db:migrate` 应用更改

## ⚠️ 注意事项

1. **生产环境**：建议使用连接池模式（端口 6543）以提高性能和连接管理
2. **迁移文件**：不要手动编辑生成的迁移文件
3. **备份**：在生产环境运行迁移前，请先备份数据库
4. **密码安全**：确保 `.env.local` 文件已添加到 `.gitignore`，不要提交到版本控制

## 🔍 故障排除

### 错误：缺少 DATABASE\_URL 环境变量

- 检查 `.env.local` 文件是否存在
- 确认 `DATABASE_URL` 已正确配置
- 重启开发服务器

### 错误：连接数据库失败

- 检查 Supabase 项目是否正常运行
- 验证数据库密码是否正确
- 确认网络连接是否正常
- 检查 Supabase 项目的 IP 白名单设置（如果启用了）

### 迁移失败

#### `relation "xxx" already exists`

这通常表示 **数据库 schema 与 `drizzle.__drizzle_migrations` 记录不同步**：表已经存在，但 Drizzle 认为对应迁移尚未执行，从而重复 `CREATE TABLE`。

常见原因：

- 手动向 `drizzle.__drizzle_migrations` 写入了错误记录（如 `hash` 填迁移 tag 名而非 SHA256，`created_at` 填 `0`）
- 直接执行了 SQL 文件，但未更新迁移记录
- `_journal.json` 与已应用的迁移不一致

Drizzle 判定逻辑：取 `__drizzle_migrations` 中 `created_at` 最大的一条，若小于 journal 中某条迁移的 `when`，就会重跑该迁移。

**修复步骤（已有表、需对齐记录时）：**

1. 确认 `packages/database/src/migrations/meta/_journal.json` 包含所有已应用的 `.sql` 条目
2. 计算对应 `.sql` 文件的 SHA256 哈希（Drizzle 写入 `hash` 字段的值）：

```bash
node -e "
const { createHash } = require('crypto');
const fs = require('fs');
const sql = fs.readFileSync('packages/database/src/migrations/0000_xxx.sql', 'utf8');
console.log(createHash('sha256').update(sql).digest('hex'));
"
```

3. 将最新已应用迁移的记录写入数据库（`created_at` 取 journal 中该条的 `when`）：

```sql
DELETE FROM drizzle.__drizzle_migrations;

INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
VALUES ('<SHA256>', <when>);
```

4. 重新执行 `pnpm db:migrate`

**注意：** 不要手动往 `drizzle.__drizzle_migrations` 写迁移 tag 名（如 `0000_flowery_microchip`），`hash` 必须是 SQL 文件内容的 SHA256。`pnpm db:migrate` 会在执行前预检此类异常并提前报错。

#### 其他迁移错误

- 检查迁移文件是否已存在冲突
- 查看 Supabase 日志获取详细错误信息
- 确认数据库用户有足够权限执行 DDL 操作
