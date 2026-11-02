# 桌面端发布脚本

`publish-desktop.mts` 可发布已经生成的 Windows / macOS 安装包，也可以先打包单个平台再发布到腾讯云 COS。命令入口是仓库根目录的 `pnpm desktop:upload`。

## 发布环境配置

建议将发布专用变量写入 `scripts/electron/.env`。该文件会被根目录 `.gitignore` 忽略，适合保存本机凭据；不要把密钥写进提交的文档或脚本。

```dotenv
S3_ACCESS_KEY_ID=填写腾讯云访问密钥 ID
S3_SECRET_ACCESS_KEY=填写腾讯云访问密钥
S3_BUCKET=purechat-1234567890
S3_ENDPOINT=https://cos.ap-shanghai.myqcloud.com
S3_REGION=ap-shanghai
S3_ENABLE_PATH_STYLE=0
S3_SET_ACL=0

# 可选：自定义静态下载域名。留空时由桶名和 Endpoint 推导。
S3_PUBLIC_DOMAIN=

# 可选：覆盖桌面客户端更新源。正式发布地址必须是 HTTPS，且路径对应 COS 桶下的 desktop/。
PURECHAT_DESKTOP_UPDATE_URL=
```

同名变量按以下顺序选取，越靠前优先级越高：

1. 启动命令时已经存在的 shell / CI 环境变量。
2. `scripts/electron/.env`（可选；文件不存在时回退到根目录环境文件）。
3. `--env-file` 指定的文件；没有指定时读取仓库根目录 `.env.local`。
4. 仓库根目录 `.env`。

例如，若 `scripts/electron/.env` 和根目录 `.env.local` 都定义了 `S3_BUCKET`，会使用 `scripts/electron/.env` 中的值；若终端已经导出了 `S3_BUCKET`，则使用终端中的值。自定义 `--env-file` 会替换默认的根目录 `.env.local`，但不会取代 `scripts/electron/.env`。

## 命令示例

先查看参数和环境变量优先级：

```sh
pnpm desktop:upload --help
```

只检查两个平台的现有产物，并读取远端发布状态，不执行上传、加锁或删除：

```sh
pnpm desktop:upload --dry-run
```

只发布 macOS 产物：

```sh
pnpm desktop:upload --platform mac
```

发布 Windows 产物并显式指定版本：

```sh
pnpm desktop:upload --platform windows --version 0.3.7
```

如果安装包在仓库根目录之外的子目录，可指定产物目录。相对路径按仓库根目录解析：

```sh
pnpm desktop:upload --platform mac --dir apps/desktop/release
```

先打包再发布一个平台：

```sh
pnpm desktop:upload --platform windows --package
pnpm desktop:upload --platform mac --package
```

`--package` 一次只能选择一个平台，版本固定读取根目录 `package.json`，产物目录固定为 `apps/desktop/release`。搭配 `--dry-run` 时跳过打包，只验证已有产物并执行模拟发布流程。

临时使用其他环境文件时，传入绝对路径或相对仓库根目录的路径：

```sh
pnpm desktop:upload --platform mac --env-file /secure/desktop.env --dry-run
pnpm desktop:upload --platform windows --env-file .env.desktop-ci
```

显式传入但不存在的 `--env-file` 会直接报错，以免意外使用其他配置。`--dry-run` 仍需要有效的 COS 配置，并会检查本地发布文件及远端状态。
