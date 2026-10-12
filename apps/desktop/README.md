# PureChat Desktop

本包是现有 Vite SPA 的 Electron 壳。路由与业务 UI 仍以 Web 应用为准。

## 开发

启动完整桌面开发环境：

```bash
pnpm dev:desktop
```

该命令会复用或启动共享 Next BFF（端口 `3000`），再启动 Electron 渲染进程（`http://127.0.0.1:5176`）。桌面渲染端口与浏览器 SPA 端口 `5174` 分开，避免冲突。渲染进程只监听 `127.0.0.1`，不会打印 `localhost` 地址。

若只启动 Electron 进程：

```bash
pnpm --filter purechat-desktop dev
```

此模式下需另行启动兼容的 Next BFF。同时跑多份开发实例时，可用 `PURECHAT_DESKTOP_VITE_PORT` 覆盖渲染端口。

开发环境默认允许多开，并始终使用 `purechat-desktop-dev` 独立数据目录，因此开发版与已安装的 PureChat 可以同时运行；将
`PURECHAT_DESKTOP_MULTI_INSTANCE=false` 写入 `apps/desktop/.env.desktop.local` 可切换回单实例，生产安装包未设置该变量时仍保持单实例。

## 构建与打包命令

```bash
# 只构建 main、preload 和 renderer，不生成安装包
pnpm build:desktop

# 当前宿主平台的未打包目录
pnpm package:desktop

# macOS DMG + ZIP，arm64 和 x64
pnpm package:desktop:mac

# Windows NSIS 安装包 + portable 免安装 EXE，x64
pnpm package:desktop:win

# 只生成 Windows portable 免安装 EXE，x64
pnpm package:desktop:win:portable
```

所有产物都写入 `apps/desktop/release/`。打包命令会先执行生产构建，再调用 electron-builder，并使用 `--publish never`，因此不会自动上传或发布。

### 产物矩阵

| 命令 | 平台/架构 | 产物 | 适用场景 |
| --- | --- | --- | --- |
| `build:desktop` | 当前平台 | `dist/` | 只验证编译结果 |
| `package:desktop` | 当前平台 | 未打包目录 | 本地调试、安装包前验收 |
| `package:desktop:mac` | macOS arm64/x64 | `.dmg`、`.zip` | macOS 正式分发 |
| `package:desktop:win` | Windows x64 | NSIS `.exe`、portable `.exe` | Windows 正式分发和绿色运行 |
| `package:desktop:win:portable` | Windows x64 | portable `.exe` | 只需要免安装包 |

当前配置生成的产物名称遵循以下规则：

- macOS：`PureChat-${version}-${arch}.dmg`、`PureChat-${version}-${arch}.zip`
- Windows 安装包：`PureChat-${version}-setup.exe`
- Windows 免安装包：`PureChat-${version}-portable.exe`

实际文件名中的 `${version}` 来自 `apps/desktop/package.json`，`${arch}` 是 `arm64` 或 `x64`。

## DMG、ZIP、NSIS 与 portable 的区别

### macOS DMG

DMG 是 macOS 常见的磁盘映像分发格式。用户打开 DMG 后，通常把 `PureChat.app` 拖入 `Applications` 文件夹。它适合面向普通 macOS 用户发布，但本身不是自动更新服务，也不代表已经完成签名或公证。

### ZIP

ZIP 是压缩归档，需要先解压，再运行其中的应用目录或 `.app`。它没有安装向导、卸载程序、注册表写入或快捷方式配置，适合开发测试、手动分发和更新系统下载。

ZIP 不是“单文件免安装程序”：Windows ZIP 解压后仍然是一组应用文件；macOS ZIP 解压后是一个 `.app`。ZIP 体积通常比未压缩目录小，但用户必须执行解压步骤。

### Windows NSIS 安装包

NSIS 是正式安装程序。当前配置使用：

- `oneClick: false`：显示安装向导。
- `perMachine: false`：默认按当前用户安装，不要求管理员权限。
- `allowToChangeInstallationDirectory: true`：用户可以选择安装目录。

它适合普通 Windows 用户，支持安装目录、开始菜单/桌面快捷方式和卸载流程。它不是绿色软件，卸载时也可能保留用户数据目录。

### Windows portable 免安装包

portable 是 electron-builder 生成的单个自解压 EXE，不显示安装向导，通常可以直接运行或放在 U 盘、临时目录中使用。

portable 与 ZIP 的核心区别是：

| 对比项 | ZIP | portable |
| --- | --- | --- |
| 文件形态 | 一个压缩包，解压后是一组文件 | 通常是一个 EXE |
| 使用方式 | 先解压再运行 | 直接运行 |
| 安装向导 | 没有 | 没有 |
| 解压过程 | 用户手动完成 | 启动时由程序处理 |
| 适合场景 | 手动分发、更新、调试 | 绿色运行、临时使用 |
| 数据行为 | 由应用自身决定 | 仍可能写入用户目录和系统临时目录 |

“免安装”不等于“完全不写磁盘”。portable 可能产生临时解压文件、日志、缓存和用户配置；如果需要真正的数据便携，还需要应用层明确配置数据目录，本次不改变该行为。

## 版本、架构与打包配置

这些概念互相独立：

| 项目 | 当前值/来源 | 作用 |
| --- | --- | --- |
| 桌面应用版本 | `apps/desktop/package.json` 的 `version`，当前为 `0.2.0` | 产物文件名、应用版本和后续更新比较 |
| 根项目版本 | 根 `package.json`，当前为 `0.2.2` | Web/monorepo 项目版本，不会自动覆盖桌面版本 |
| Electron 版本 | `apps/desktop/package.json` 的 `electron`，当前为 `41.3.0` | Chromium、Node.js、Electron Framework 和运行时能力 |
| electron-builder 版本 | `electron-builder`，当前为 `26.14.0` | 打包器能力、目标格式和配置语义 |
| 打包目标 | `mac.target`、`win.target` | 决定生成 DMG、ZIP、NSIS 或 portable |
| 架构 | macOS `arm64`/`x64`，Windows `x64` | 决定运行平台和原生二进制兼容性 |

升级应用版本不会自动升级 Electron；升级 Electron 也不会自动改变应用版本。架构不同的产物不能互换，macOS Apple Silicon 应使用 arm64，Intel Mac 应使用 x64。

客户端更新支持稳定（`latest`）、RC 和 Beta 渠道，沿用同一个应用身份与配置目录；发布端需要相应版本策略和渠道元数据。独立 nightly/canary 应用的协议 scheme、数据目录隔离与发布流程尚未实现。

## 配置审查结论

当前配置中值得保留或借鉴的发行设计包括：

- 显式设置 `appId`、`productName`、构建资源目录和输出目录。
- 使用精确的 `files` 规则，只把生产构建产物和应用 manifest 放入 ASAR。
- 排除 sourcemap，并在 `afterPack` 阶段校验入口、文件边界和 ASAR 体积。
- 按平台和架构声明产物，而不是依赖 electron-builder 默认目标。
- 为不同产物设置稳定、可读的 artifact name。
- 将签名、公证、发布服务器和多渠道作为发行阶段能力。

当前没有引入 Linux 目标、动态 publish provider、stable/nightly/canary 渠道、原生依赖复制、CLI 嵌入或 Electron Framework 本地化裁剪。当前应用尚未需要这些能力，提前加入会扩大构建和验收范围。

## 体积与构建调优

当前测量基线约为：

- `app.asar`：约 29 MiB。
- 完整 macOS App：约 291–298 MiB。
- Electron Framework：约 262–269 MiB，是完整 App 的主要体积来源。

因此，继续压缩 ASAR 不会等比例减少最终应用体积。当前已经采取的低风险措施包括：

- 只打包 `dist/**/*` 和 `package.json`。
- 排除 `node_modules`、环境文件和 sourcemap。
- 通过 `beforeBuild: () => false` 跳过 electron-builder 的原生 rebuild 和 pnpm workspace 依赖收集。
- 生产构建 renderer，避免把开发服务器内容打入安装包。
- 使用 ASAR 入口和 64 MiB 预算校验，防止依赖意外膨胀。
- macOS 使用 `compression: 'maximum'`，以换取较小归档体积；代价是打包时间可能增加。
- 使用 `reportCompressedSize: false` 减少构建过程中的重复压缩统计开销。

后续如果需要继续瘦身，优先顺序应是：

1. 审查 renderer 中的大型 vendor chunk、重复依赖和无需首屏加载的模块。
2. 对图表、编辑器、代码高亮和 WASM 等资源进行懒加载。
3. 减少不必要的图片、字体和语言资源。
4. 只有在确实引入原生模块后，才建立精确的 native dependency 白名单和 `asarUnpack` 规则。
5. 在实际发布验收后，再评估 Electron Framework 本地化裁剪；错误裁剪可能导致运行时缺少资源。

不要在正式发布命令中使用 `asar: false`。不打 ASAR 只适合本地调试和定位路径问题，会产生更多散文件，也会削弱当前的归档边界校验。

`electronDownload.mirror` 只影响 Electron 二进制下载速度，不会减少最终安装包体积。

## 签名、公证、自动更新与 blockmap

当前配置没有接入代码签名、公证或固定的自动更新服务器：

- macOS 产物可以生成，但正式分发前仍需配置 Apple Developer 签名和 notarization。
- Windows 产物可以生成，但正式分发前应配置代码签名证书。
- 未设置 `PURECHAT_DESKTOP_UPDATE_URL` 时，`publish: null` 配合命令行 `--publish never` 表示只构建，不上传。
- `.blockmap` 是供差分更新使用的元数据，不代表应用已经具备自动更新能力。
- 客户端已接入 `electron-updater`：打包安装版本启动后延迟检查，并每 4 小时再次检查；失败后以 5–60 分钟退避重试。关于页可手动检查、查看下载进度和确认重启安装，普通退出不会自动安装。
- 要启用自动更新，发布构建需要设置 `PURECHAT_DESKTOP_UPDATE_URL`（Generic provider 地址），并同时配置签名、版本策略和端到端验收。

关于页的自动更新开关控制后台检测与下载；关闭后仍可手动检查。更新设置保存在客户端配置中，测试计划默认关闭，启用后可选择 RC 或 Beta。渠道切换会取消旧下载并清除安装就绪状态，禁止自动降级。Web 端在浏览器 tab 重新可见时检测部署变化并提示用户刷新，关于页不提供更新按钮或更新开关。

更新源需提供对应平台、架构和渠道的元数据：稳定渠道 `latest`、预览渠道 `rc`、测试渠道 `beta`。预发布客户端版本使用 `X.Y.Z-rc.N` 或 `X.Y.Z-beta.N`；将 electron-builder 生成的渠道 YAML、安装包和校验文件一起上传到同一个更新根地址。macOS 自动更新需 ZIP 产物，Windows 使用 NSIS 安装包；portable 和未配置更新源的构建提供手动发布页入口。设置页面中的 RC/Beta 选择不会自动创建远端发布渠道。

打包配置会独立加载 `apps/desktop/` 下的 `.env`、`.env.local`、`.env.desktop` 和 `.env.desktop.local`，后者覆盖前者；shell/CI 中已有的环境变量优先级最高。`electron-vite` 加载的变量不会传递给后续的 `electron-builder` 进程。正式发布时应覆盖本地下载测试地址：

```bash
PURECHAT_DESKTOP_UPDATE_URL=https://updates.example.com/purechat pnpm package:desktop:mac
```

设置更新地址后，`--publish never` 仍会把更新源写入安装包的 `resources/app-update.yml`，只禁止上传；macOS 对应路径为 `PureChat.app/Contents/Resources/app-update.yml`。安装后的客户端读取该文件，无需运行时再设置环境变量；修改更新地址后必须重新打包。可通过 `apps/desktop/release/builder-effective-config.yaml` 的 `publish` 字段和安装包中的 `app-update.yml` 确认地址已写入。

桌面开发环境可在启动 `pnpm dev:desktop` 前设置 `PURECHAT_DESKTOP_UPDATE_URL`，从 Generic 更新源手动检查并下载更新。开发版本下载完成后只显示下载完成状态，不会提示或执行安装；安装验证仍需使用已打包的发行版本。

### 本地更新下载测试

在仓库根目录打开两个终端：

```bash
# 终端 1：启动更新服务（默认限速 3 MiB/s，便于观察下载进度）
pnpm dev:desktop:update-server

# 终端 2：启动桌面开发环境
pnpm dev:desktop
```

将 `apps/desktop/.env.desktop.example` 中的更新地址加入本机的 `apps/desktop/.env.desktop.local`：

```dotenv
PURECHAT_DESKTOP_UPDATE_URL=http://127.0.0.1:5500
PURECHAT_DESKTOP_MULTI_INSTANCE=true
```

`apps/desktop/dev-app-update.yml` 已配置相同地址和独立开发缓存目录。主进程在开发模式下启用 `forceDevUpdateConfig`，使用完整文件下载；生产环境仍读取打包后的 `resources/app-update.yml`。修改环境变量后需重新启动桌面进程。

脚本只监听 `127.0.0.1:5500`，默认从 `apps/desktop/release/` 选择宿主架构最新修改的标准 ZIP（macOS）或 NSIS 安装包（Windows），计算真实 SHA-512 和文件大小，并在内存中提供渠道 YAML。不会修改、复制原始产物，也不会开放整个 release 目录。支持 GET、HEAD 和单段 Range；Ctrl+C 关闭服务。

默认测试版本为桌面 `package.json` 版本的下一补丁版本，例如当前 `0.2.0` 对应 `0.2.1`。这只是为了触发下载的元数据版本，ZIP 内的应用仍为原始版本，**此服务仅用于开发版下载测试，不用于验证安装升级**。

关于页保持稳定渠道（测试计划关闭），点击“检查更新”后应经历“正在检查 → 正在下载 → 下载完成（开发环境不可安装）”。开启自动更新时，启动约 5 秒后也会开始检测。已下载的文件可能被缓存，重复检查可能跳过网络下载；要再次观察进度，在关于页“测试计划”下方点击“清理下载安装包缓存”中的“清理缓存”，再点击“检查更新”，无需重启或修改测试版本。该行显示实际缓存路径，仅配置了更新源的桌面开发环境可见；检查或下载期间不可清理。

```bash
# 指定产物、版本和端口；改端口时同步修改本地环境变量及 dev-app-update.yml
pnpm dev:desktop:update-server --artifact PureChat-0.2.0-arm64.zip --version 0.2.2 --port 5500

# RC 下载测试：关于页开启测试计划并选择 RC
pnpm dev:desktop:update-server --channel rc --version 0.2.2-rc.1 --kbps 1024

# Windows 下载测试：release 中需先生成 NSIS 安装包
pnpm dev:desktop:update-server --platform win --arch x64 --artifact PureChat-0.2.0-setup.exe
```

当前本机 release 目录中，测试所需文件及用途如下：

| 文件 | 用途 |
| --- | --- |
| `PureChat-0.2.0-arm64.zip` | Apple Silicon 自动更新下载载荷；默认选用 |
| `PureChat-0.2.0-x64.zip` | Intel Mac 自动更新下载载荷，需使用相应架构客户端 |
| 对应 `.zip.blockmap` | 差分下载元数据；脚本可提供，开发测试默认下载完整 ZIP |
| `PureChat-0.2.0-arm64.dmg` | 首次或手动安装，不能代替自动更新所需 ZIP |
| `latest-mac.yml` / `rc-mac.yml` / `beta-mac.yml` | 更新检测元数据；现有目录缺少，由脚本按所选渠道生成 |
| `builder-debug.yml`、`builder-effective-config.yaml`、`mac-arm64/` | 构建日志、配置和未压缩应用，不作为更新服务下载文件 |

Windows 自动更新需要 NSIS `*-setup.exe` 和 `latest.yml`（或 RC/Beta 渠道 YAML）；现有本机目录没有 Windows 安装包。实际安装验收需要两个真实、递增版本的发行包、正确的发布元数据与平台签名配置，不应使用脚本模拟的更高版本号。

## 打包前验证

```bash
pnpm --filter purechat-desktop test
pnpm exec eslint apps/desktop/src/ apps/desktop/scripts/
pnpm --filter purechat-desktop typecheck
pnpm package:desktop
```

生产构建通过 `purechat://renderer` 协议加载打包后的渲染页。首次启动可在界面配置服务地址；开发调试也可使用桌面进程环境变量 `PURECHAT_DESKTOP_REMOTE_URL`。打包后的 `/api` 请求由 Electron 主进程通过 session 代理并注入主进程管理的 Bearer 令牌。桌面登录使用系统浏览器完成 Web 授权，通过 `purechat://auth/callback` 返回应用；授权码采用 PKCE、短时一次性消费，令牌和桌面配置由 `electron-store` 文件级加密保存，不访问 macOS Keychain。构建时可通过非敏感的 `PURECHAT_DESKTOP_CLOUD_URL` 指定官方服务地址，缺省回退到 `SITE_DEFAULT_URL`。

打包会自动检查 ASAR：只允许应用 manifest 和构建产物，拒绝 `node_modules`、环境文件、sourcemap 和缺失入口，归档预算为 64 MiB。未来引入外置原生依赖时必须同步调整精确白名单和验证，不要直接关闭检查。

桌面 OAuth PKCE、本地数据库和 MCP 进程管理均保持在 Electron 主进程边界内；认证页面不会在 Electron renderer 中渲染，Web 端登录行为保持不变。
