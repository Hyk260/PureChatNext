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

非 Windows 开发环境默认允许多开，并始终使用 `purechat-desktop-dev` 独立数据目录，因此开发版与已安装的 PureChat 可以同时运行。Windows 始终启用单实例，以确保浏览器授权回跳由已打开的应用窗口处理。将
`PURECHAT_DESKTOP_MULTI_INSTANCE=false` 写入 `apps/desktop/.env.desktop.local` 可在其他平台切换回单实例；生产安装包未设置该变量时默认单实例。

## 构建与打包命令

```bash
# 只构建 main、preload 和 renderer，不生成安装包
pnpm build:desktop

# 当前宿主平台的未打包目录
pnpm package:desktop

# macOS DMG + ZIP，arm64
pnpm package:desktop:mac

# Windows NSIS 安装包 + portable 免安装 EXE，x64
pnpm package:desktop:win

# 只生成 Windows portable 免安装 EXE，x64
pnpm package:desktop:win:portable
```

所有产物都写入 `apps/desktop/release/`。打包命令会先执行生产构建，成功后清空 `release/`，再调用 electron-builder，并使用 `--publish never`，因此不会自动上传或发布。旧安装包、blockmap、渠道 YAML 和解包目录会一起清理；同一次命令的多架构、多目标产物会保留。单独运行 `build:desktop` 不会清理发布产物；若分多次命令构建不同平台，应在下一次打包前将已生成的产物归档到其他目录。

`package:desktop` 的 `--dir` 目标用于运行与归档校验，不会生成更新所需的 `app-update.yml`；更新验收应使用 macOS ZIP/DMG 或 Windows NSIS 发行目标，并确认包内存在该文件。

### 产物矩阵

| 命令 | 平台/架构 | 产物 | 适用场景 |
| --- | --- | --- | --- |
| `build:desktop` | 当前平台 | `dist/` | 只验证编译结果 |
| `package:desktop` | 当前平台 | 未打包目录 | 本地调试、安装包前验收 |
| `package:desktop:mac` | macOS arm64 | `.dmg`、`.zip` | macOS 分发 |
| `package:desktop:win` | Windows x64 | NSIS `.exe`、portable `.exe` | Windows 正式分发和绿色运行 |
| `package:desktop:win:portable` | Windows x64 | portable `.exe` | 只需要免安装包 |

当前配置生成的产物名称遵循以下规则：

- macOS：`PureChat-${version}-${arch}.dmg`、`PureChat-${version}-${arch}.zip`
- Windows 安装包：`PureChat-${version}-setup.exe`
- Windows 免安装包：`PureChat-${version}-portable.exe`

实际文件名中的 `${version}` 来自根 `package.json`，构建时自动同步至桌面 manifest。当前 macOS 仅生成 `arm64`，Windows 仅生成 `x64`。

### GitHub Actions 手动打包

工作流 [Desktop release](../../.github/workflows/desktop-release.yml) 仅手动触发，每次同时构建 Windows x64 和 macOS arm64，生成四个分发文件及五个更新元数据文件。

1. 将工作流合入 `main`，在根 `package.json` 维护 `X.Y.Z` 稳定版本，并更新 [build/release-notes.md](build/release-notes.md)。首版流程不支持 RC/Beta 版本号。
2. 打开 GitHub 仓库的 **Actions → Desktop release → Run workflow**，选择要构建的分支。所有 job 都使用触发时的固定 commit，无需另填版本。
3. 构建通过后，从运行页下载 `desktop-X.Y.Z-windows-x64` 和 `desktop-X.Y.Z-mac-arm64` Artifacts，保留期为 30 天。
4. 两端全部成功后，工作流汇总安装文件、`latest.yml`、`latest-mac.yml` 和三个 blockmap 到 `vX.Y.Z` 的 Release 草稿，并生成 Installer、Portable、DMG、ZIP 下载表格。检查草稿和安装包后手动发布；下载链接和更新元数据在发布后可用。

Windows 使用 `windows-2022`，macOS 使用 `macos-15`，均使用 Node.js 22.23.2 和 pnpm 10.33.4。Node 版本与 Docker 工作流保持一致，满足当前依赖要求的 `>=22.22.0`。构建前先检查稳定版本、发行说明、服务地址和工作流分支条件；每个平台打包后校验安装文件和更新元数据存在且非空，再上传。一端失败不会取消另一端，成功端的 Artifact 仍可下载，但不会创建或更新草稿；不会上传解包目录或构建调试 YAML。

默认官方服务地址为 `https://next.purechat.cn`。需要覆盖时，在仓库 **Settings → Secrets and variables → Actions → Variables** 设置非敏感变量 `PURECHAT_DESKTOP_CLOUD_URL`，必须是无用户名/密码的 HTTP(S) 地址，不要误填到 Secrets。生产更新源默认使用 `Hyk260/PureChatNext` 的公开 GitHub Releases；设置仓库 Variable `PURECHAT_DESKTOP_UPDATE_URL` 后，构建将使用指定的 Generic 更新源。COS 场景需填写正式 `desktop/` 公共下载地址，不能使用本地测试地址。不需要数据库、AI Key、签名证书或 PAT；草稿汇总 job 使用内置 `GITHUB_TOKEN` 的 `contents: write` 权限，其余 job 仅有读取权限。S3 密钥只注入独立 COS 同步 job。

草稿记录完整 commit SHA。同版本、同 commit 重跑会替换安装文件及更新元数据；已公开版本、不同 commit 的草稿、指向不同 commit 的 tag 均会明确失败。源代码变化后应使用新版本；若需要重建未发布的同版本，应先人工处理旧草稿及冲突 tag。API 或网络错误也会直接失败，不会被当作版本不存在。

现有 tag 发布工作流仍然保留。桌面发行请先运行本流程生成草稿，再手动发布；不要提前推送 tag 让旧工作流公开同版本，否则本流程会拒绝覆盖。GitHub 的 Release API 对相对默认分支改动了工作流的 commit 要求额外的 workflow 写权限，内置 `GITHUB_TOKEN` 无法获得该权限；因此 `prepare` 会提前比较所选 commit 与默认分支的 `.github/workflows/`，不一致时要求先合入 `main`。业务源码可以选择其他分支，只要工作流内容与默认分支一致。[GitHub Release 权限说明](https://docs.github.com/en/rest/releases/releases#create-a-release)

### 手动打包失败排查

| 失败阶段 / 提示 | 处理方式 |
| --- | --- |
| 找不到 Run workflow | 确认工作流已进入默认分支，且仓库 Actions 未禁用 |
| `prepare` 提示工作流与默认分支不同 | 先将 `.github/workflows/` 的改动合入默认分支，再重新触发 |
| 版本、说明或 `PURECHAT_DESKTOP_CLOUD_URL` 不合法 | 根版本使用 `X.Y.Z`，说明文件非空，服务地址填入仓库 Variable；未配置 Variable 时使用默认地址 |
| frozen lockfile 不一致 | 本地用 pnpm 同步 manifest 与 lockfile，一起提交；不要在 CI 中改成非冻结安装 |
| 下载依赖或上传产物时网络失败 | 查看具体失败步骤后重跑；同一次运行的 Re-run all jobs 会替换同名 Artifact |
| 草稿步骤出现 403 / Resource not accessible by integration | 确认草稿 job 的 `contents: write` 未被删除，并检查组织策略；无需向构建 job 分发 PAT 或服务端密钥 |
| 草稿步骤提示已公开 / commit 或 tag 冲突 | 使用新版本，或人工处理未发布草稿及冲突 tag；脚本不会覆盖公开版本 |
| 草稿创建成功但文件上传失败 | 草稿仍未发布，使用同 commit 重跑，安装文件和更新元数据全部上传成功后再检查并发布 |

`prepare` / `draft` 脚本只依赖 Node 标准库；GitHub 的 Ubuntu runner 已提供 `git`、`gh`，无需额外安装项目依赖。手动运行 CLI 时需在仓库根目录执行，发行步骤还需设置 `GITHUB_REPOSITORY`、完整 `GITHUB_SHA` 和具有仓库写权限的 `GH_TOKEN`；Actions 会自动注入这些值。

首版 Windows 无正式代码签名，macOS 仅使用 ad-hoc 签名，没有 Developer ID 签名或公证。系统可能显示安全提示；macOS 自动安装更新不作为此流程验收目标。发布前应实际验证 Windows 安装版、Portable，以及 Apple Silicon 上的 DMG、ZIP 启动、版本、服务连接和登录回调。

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
| 应用版本 | 根 `package.json` 的 `version` | Web 展示、桌面应用版本、产物文件名和更新比较的唯一维护来源 |
| 桌面清单版本 | 开发、构建和打包时自动从根版本同步 | 供 Electron 的 `app.getVersion()` 读取，无需单独维护 |
| Electron 版本 | `apps/desktop/package.json` 的 `electron`，当前为 `41.3.0` | Chromium、Node.js、Electron Framework 和运行时能力 |
| electron-builder 版本 | `electron-builder`，当前为 `26.14.0` | 打包器能力、目标格式和配置语义 |
| 打包目标 | `mac.target`、`win.target` | 决定生成 DMG、ZIP、NSIS 或 portable |
| 架构 | macOS `arm64`/`x64`，Windows `x64` | 决定运行平台和原生二进制兼容性 |

升级应用版本不会自动升级 Electron；升级 Electron 也不会自动改变应用版本。架构不同的产物不能互换，macOS Apple Silicon 应使用 arm64，Intel Mac 应使用 x64。

发布新版本只需修改根 `package.json` 的 `version`。`electron-vite` 和 `electron-builder` 加载配置时会自动同步桌面清单，打包配置的 `extraMetadata.version` 也直接使用根版本。修改版本后需重启桌面开发进程或重新打包；更新器和关于页始终读取客户端实际版本。

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

2026-10-12 本机 arm64 产物的测量基线约为：

- `app.asar`：约 23 MiB。
- 完整 macOS App：约 238 MiB。
- Electron 及辅助框架：约 215 MiB，占完整 App 的约 90%。

因此，继续压缩 ASAR 不会等比例减少最终应用体积。当前已经采取的低风险措施包括：

- 只打包 `dist/**/*` 和 `package.json`。
- 排除 `node_modules`、环境文件和 sourcemap。
- 通过 `beforeBuild: () => false` 跳过 electron-builder 的原生 rebuild 和 pnpm workspace 依赖收集。
- 生产构建 renderer，避免把开发服务器内容打入安装包。
- 使用 ASAR 入口和 64 MiB 预算校验，防止依赖意外膨胀。
- macOS 使用 `compression: 'normal'` 加速 ZIP 更新包生成，并通过 `dmg.format: 'UDBZ'` 保留较小的 DMG 安装包体积。
- 使用 `reportCompressedSize: false` 减少构建过程中的重复压缩统计开销。

同一个已打包 App 的单次本机对比中，ZIP 使用 `maximum` 耗时约 223 秒、体积 97.62 MiB；使用 `normal` 耗时约 31 秒、体积 97.86 MiB，归档耗时减少约 86%，体积增加约 0.24%。DMG 保留 `UDBZ`，约 92.33 MiB；若随普通压缩切换为 `UDZO`，则约 101.11 MiB。这些耗时包含归档与 blockmap，排除源码构建、签名、公证和上传，实际耗时随机器与缓存变化。

`pnpm --filter purechat-desktop package:mac` 仍生成 DMG、ZIP、对应 blockmap 和已配置更新源的渠道 YAML。本地仅验证应用启动和功能时，可使用 `pnpm --filter purechat-desktop package:dir` 跳过压缩归档；更新下载验收仍使用完整发布产物。

后续如果需要继续瘦身，优先顺序应是：

1. 审查 renderer 中的大型 vendor chunk、重复依赖和无需首屏加载的模块。
2. 对图表、编辑器、代码高亮和 WASM 等资源进行懒加载以减少首屏开销；减少安装包体积还需排除无用模块与资源，懒加载本身不会减少打包文件。
3. 减少不必要的图片、字体和语言资源。
4. 只有在确实引入原生模块后，才建立精确的 native dependency 白名单和 `asarUnpack` 规则。
5. 在实际发布验收后，再评估 Electron Framework 本地化裁剪；错误裁剪可能导致运行时缺少资源。

不要在正式发布命令中使用 `asar: false`。不打 ASAR 只适合本地调试和定位路径问题，会产生更多散文件，也会削弱当前的归档边界校验。

Electron 下载镜像统一配置在 workspace 根目录 `.npmrc`，可用 `ELECTRON_MIRROR` 和 `ELECTRON_BUILDER_BINARIES_MIRROR` 环境变量覆盖。请通过上述 pnpm 脚本打包，以便注入镜像配置；镜像只影响下载速度，不会减少最终安装包体积。

## 签名、公证、自动更新与 blockmap

生产更新源默认使用公开 GitHub Releases，当前发行工作流尚未接入正式代码签名和公证：

- macOS 产物可以生成，但正式分发前仍需配置 Apple Developer 签名和 notarization。
- Windows 产物可以生成，但正式分发前应配置代码签名证书。
- 未设置 `PURECHAT_DESKTOP_UPDATE_URL` 时，`publish` 使用 `Hyk260/PureChatNext` 的 GitHub Releases；`--publish never` 只禁止 Builder 上传，仍生成包内更新配置和渠道 YAML。
- `.blockmap` 是供差分更新使用的元数据，不代表应用已经具备自动更新能力。
- 客户端已接入 `electron-updater`：打包安装版本启动后延迟检查，并每 4 小时再次检查；失败后以 5–60 分钟退避重试。关于页可手动检查、查看下载进度和确认重启安装，普通退出不会自动安装。
- 发布时必须同时上传安装文件、渠道 YAML 和 blockmap；macOS 自动安装还需正式签名及签名身份兼容性验收。公开仓库的客户端检测和下载不需要 GitHub token，上传权限仅留在发行 job。

关于页的自动更新开关控制后台检测与下载；关闭后仍可手动检查。更新设置保存在客户端配置中，测试计划默认关闭，启用后可选择 RC 或 Beta。渠道切换会取消旧下载并清除安装就绪状态，禁止自动降级。Web 端在浏览器 tab 重新可见时检测部署变化并提示用户刷新，关于页不提供更新按钮或更新开关。

版本号旁的日志图标可打开桌面更新日志弹框，查看 `desktop:update` 记录和对应错误堆栈，并手动刷新。日志读取开发或生产环境对应目录最近三个日志文件（含轮转文件），每个文件及弹框内容均限制在 256 KiB；较早内容省略时会显示提示，完整日志仍可通过帮助菜单打开日志目录查看。

客户端启动时检查当前构建的安装条件。macOS 使用系统 `codesign` 检查 Developer ID Application 签名并进行严格校验；开发版、ad-hoc／未签名构建以及校验无法完成的构建仅支持下载，安装确认按钮禁用，主进程也会拒绝安装。弹框会显示具体原因。此检查只确认当前应用的安装条件，每个更新包仍必须通过 Squirrel.Mac 的签名身份兼容性校验；Windows 保留原生安装器校验，portable 和不支持的平台仍使用手动更新。

更新源需提供对应平台、架构和渠道的元数据：稳定渠道 `latest`、预览渠道 `rc`、测试渠道 `beta`。预发布客户端版本使用 `X.Y.Z-rc.N` 或 `X.Y.Z-beta.N`；将 electron-builder 生成的渠道 YAML、安装包和校验文件一起上传到对应 GitHub Release（Generic 源则上传至同一个更新根地址）。macOS 自动更新需 ZIP 产物，Windows 使用 NSIS 安装包；portable 和未配置更新源的构建提供手动发布页入口。当前手动发行工作流只支持稳定版本，设置页面中的 RC/Beta 选择不会自动创建远端发布渠道。

### 更新说明

当前版本的桌面更新说明统一维护在 [build/release-notes.md](build/release-notes.md)。发布时先更新根 `package.json` 的版本和该文件，再运行打包命令。`releaseInfo.releaseNotesFile` 使用固定的源码文件路径，打包器会将内容写入生成的渠道 YAML 的 `releaseNotes` 字段，关于页通过现有更新状态显示它。

更新说明文件位于 `build/`，清理 `release/` 不会删除它；该文件不作为运行时资源额外装入应用包。生产更新服务会原样提供 YAML 中的说明，开发模式的模拟下载服务仍显示模拟测试说明。已发布的 YAML 需要重新生成并上传，才能包含新说明。

### 打包更新源

打包配置会独立加载 `apps/desktop/` 下的 `.env`、`.env.local`、`.env.desktop` 和 `.env.desktop.local`，后者覆盖前者；shell/CI 中已有的环境变量优先级最高。`electron-vite` 加载的变量不会传递给后续的 `electron-builder` 进程。正式发布时清空本地下载测试地址，使用默认 GitHub provider：

```bash
PURECHAT_DESKTOP_UPDATE_URL= pnpm package:desktop:mac
```

如需本地安装版下载测试或自托管更新服务，设置 `PURECHAT_DESKTOP_UPDATE_URL` 为 HTTP(S) 地址可覆盖为 Generic provider。两种 provider 都会写入安装包的 `resources/app-update.yml`；macOS 对应路径为 `PureChat.app/Contents/Resources/app-update.yml`。安装后的客户端读取该文件，无需运行时再设置环境变量；修改更新源后必须重新打包。可通过 `apps/desktop/release/builder-effective-config.yaml` 的 `publish` 字段和安装包中的 `app-update.yml` 确认配置。

GitHub Release tag 沿用 `vX.Y.Z`，只在草稿资产全部就绪后手动发布；`--publish never` 配合现有 `gh` 草稿汇总流程，无需向 Builder 传 token。旧版没有内置更新源的应用需要先手动安装带 GitHub 配置的新版本，补传远端 YAML 不会改变旧安装包的配置。

桌面开发环境可在启动 `pnpm dev:desktop` 前设置 `PURECHAT_DESKTOP_UPDATE_URL`，从 Generic 更新源手动检查并下载更新。开发版本下载完成后只显示下载完成状态，不会提示或执行安装；安装验证仍需使用已打包的发行版本。

### 腾讯云 COS 上传与最新版本保留

本地上传复用根 `.env.local` 中的 `S3_ACCESS_KEY_ID`、`S3_SECRET_ACCESS_KEY`、`S3_BUCKET`、`S3_ENDPOINT`、`S3_REGION`、`S3_ENABLE_PATH_STYLE`、`S3_SET_ACL` 和 `S3_PUBLIC_DOMAIN`。Shell/CI 已设置的字段优先；也可通过 `--env-file` 指定另一个环境文件。COS 配置示例见[环境变量文档](../../docs/self-hosting/configuration/environment.md#腾讯云-cos)。脚本仅接受 HTTPS COS 地域 Endpoint、匹配的 Region 和 virtual-hosted 模式，避免将开发 RustFS/MinIO 当成发行源。

固定使用桶内 `desktop/` 前缀。未指定 `PURECHAT_DESKTOP_UPDATE_URL` 时，脚本使用 `S3_PUBLIC_DOMAIN`（缺省为 COS 桶域名）下的 `desktop/` 公共地址；显式更新地址必须为 HTTPS，且路径与该前缀一致。不要把临时签名 URL 作为更新源。

```bash
# 校验本地产物，读取远端版本并预览上传/删除计划；无写入、加锁或删除
pnpm desktop:upload --platform windows --dry-run
pnpm desktop:upload --platform mac --dry-run

# 自动设置 COS 更新地址，打包成功后上传当前平台
pnpm package:desktop:win:upload
pnpm package:desktop:mac:upload

# 上传已按相同 COS 更新地址打包的产物
pnpm desktop:upload --platform mac --dir apps/desktop/release
pnpm desktop:upload --platform all --dir /path/to/combined-release --version 0.3.0

# 显式指定配置文件；路径可为绝对路径
pnpm desktop:upload --platform windows --env-file .env.local --dry-run
```

纯 `package:desktop:*` 命令继续只打包。上传包装命令将正式更新地址传给构建子进程，并移除子进程中的 S3 密钥。直接上传时，如果目录存在 `builder-effective-config.yaml`，脚本会确认其第一个 provider 为匹配地址的 Generic；GitHub 下载的纯资产没有该配置文件，必须来自已写入 COS 更新地址的构建。`--package --dry-run` 不构建，仍校验目录中已有的产物。

Windows x64 和 macOS arm64 分别保留最新稳定版。Windows 的 NSIS、portable 和 blockmap 校验通过后上传，最后覆盖 `latest.yml`；macOS 的 DMG、ZIP 和 blockmap 上传后覆盖 `latest-mac.yml`。YAML 的版本、文件大小、SHA-512 必须与本地产物一致；公开文件必须支持匿名 GET 和 Range，公开 YAML 必须与上传内容一致。渠道 YAML 使用 `Cache-Control: no-cache`，版本化安装包使用长期缓存。

确认公开渠道生效后，脚本只删除 `desktop/` 根目录内本平台命名规则匹配、且版本号更低的发行文件。上传 Windows 不删除 macOS，头像、用户文件、嵌套目录和未知文件不参与清理。不能降级；同版本内容不同必须递增版本号。同版本重复上传可恢复中断任务，并重试旧文件清理。失败任务的未发布新文件可能暂时保留，重试成功后完成发布。

**COS 访问与并发要求：**

- 推荐保持 `S3_SET_ACL=0`，在 COS 桶策略中仅允许匿名读取 `desktop/*`，不开放整个共享桶；脚本使用真实公开 URL 检查访问权限。
- 上传账号需要读取桶版本控制、列出 `desktop/`、读写和删除发行文件，以及读写和删除 `.desktop-publish-locks/` 中的发布锁。读取对象权限还用于校验同名旧对象。
- 首版要求桶从未启用版本控制。COS 的 `x-cos-forbid-overwrite` 在已启用或暂停版本控制的桶中无效，脚本会拒绝发布和 dry-run，不会修改共享桶配置。此条件同时保证旧文件删除后不留下历史对象版本。[COS PUT Object](https://cloud.tencent.cn/document/product/436/7749)
- 发布锁分别使用 `.desktop-publish-locks/windows.json` 和 `.desktop-publish-locks/mac.json`，覆盖本地和 Actions 并发。正常退出释放锁；进程被强制终止时，确认没有同平台任务运行后，在 COS 控制台删除报错指明的锁再重试，脚本不会自动抢占锁。
- 删除旧 blockmap 后，缺少本地缓存的旧客户端可能回退完整下载。已获取旧版本下载地址的客户端在旧文件删除后可能遇到 404，需要重新检查更新；COS 清理不撤销 CDN 已缓存的旧文件，接入 CDN 后需同步配置缓存清理策略。

**GitHub Actions 配置：**

在仓库 Actions Secrets 中设置 `S3_ACCESS_KEY_ID`、`S3_SECRET_ACCESS_KEY`；在 Variables 中设置 `S3_BUCKET`、`S3_ENDPOINT`、`S3_REGION`、可选 `S3_PUBLIC_DOMAIN`，以及必填的正式 `PURECHAT_DESKTOP_UPDATE_URL`。同步 job 固定采用 `S3_ENABLE_PATH_STYLE=0`、`S3_SET_ACL=0`，公开读取通过桶策略授权。不要将 `.env.local` 提交到仓库。

现有 `Desktop release` 工作流将该公开更新地址写入双平台安装包，仍只生成 GitHub 草稿。手动将草稿正式发布后，`Sync desktop release to COS` 工作流下载该版本的九个发行资产，调用同一上传脚本并分别清理各平台旧版；草稿和预发布不会同步。没有设置更新地址时，原 GitHub 发行流程保持可用，自动 COS 同步跳过。

需要补同步时，打开该同步工作流的 **Run workflow**，填写 `v0.3.0` 等已公开稳定 tag、选择 `all/windows/mac`。手动运行默认开启 `dry_run`，检查计划后关闭该选项再执行。同步脚本使用默认分支代码，指定 tag 只用于下载资产；版本判断依据该 tag，不依赖当前主分支版本。使用 `GITHUB_TOKEN` 自动发布的 Release 不会触发另一条 workflow，需要手动运行同步任务；本仓库桌面草稿由用户在 GitHub 页面正式发布，因此可触发自动同步。

### 本地真实发布更新验证

更新服务默认使用生产模式，只读 electron-builder 生成的渠道 YAML 和发布文件，不改写版本或安装包：

```bash
# 默认 release 目录，监听 127.0.0.1:5500，模拟 1–10 MiB/s、周期平均 8 MiB/s
pnpm dev:desktop:update-server

# 指定独立发布目录、架构和固定下载速度（KiB/s）；--kbps 0 关闭限速
pnpm dev:desktop:update-server --release-dir /path/to/release --platform mac --arch arm64 --kbps 1024

# Windows NSIS 发布目录
pnpm dev:desktop:update-server --release-dir /path/to/windows-release --platform win --arch x64

# RC 渠道需有真实 rc-mac.yml（Windows 为 rc.yml）及对应版本产物
pnpm dev:desktop:update-server --channel rc
```

生产模式会在启动前校验渠道版本、目标架构、文件大小与 SHA-512；只提供选定 YAML 引用的本地文件和对应 blockmap。macOS 支持 ZIP 更新载荷和 DMG 首次安装下载，Windows 支持当前 x64 NSIS 安装包。不存在 blockmap 时允许客户端回退完整下载。缺失或损坏的文件、外部 URL、目录穿越及越界符号链接会使启动失败；不会开放构建日志或整个 release 目录。生产模式拒绝 `--version`、`--artifact`，需要虚增元数据版本时显式使用开发模式。

服务启动后输出发布版本、渠道 YAML 地址和每个安装包的下载地址。支持 GET、HEAD 和单段 Range。默认网络速率以 10 秒为周期，在 1–10 MiB/s 间连续波动，周期平均 8 MiB/s；每约 50 ms 发送一批数据，保留流背压与取消处理。显式设置 `--kbps 8192` 可固定为 8 MiB/s，`--kbps 0` 为不限速。元数据响应不限速。请求日志包含本地年月日时分秒、路径、Range、状态码、传输量、耗时、完成或中断状态及实际平均 MiB/s。客户端更新器仍约每秒上报一次真实进度。检查中显示独立加载提示，下载进度使用 antd Progress 组件；每次新下载从 0% 开始，完成后立即保留 100% 圆环，避免检查圆弧回退和动画未结束就隐藏。不增加计时器或 IPC。Ctrl+C 关闭服务。

真实升级需要两个递增版本的安装包。例如旧版 `0.2.0`，新发布目录包含真实 `0.2.1` 的 YAML、ZIP/NSIS 和相关文件。两次构建都应将更新源写入包内：

```bash
PURECHAT_DESKTOP_UPDATE_URL=http://127.0.0.1:5500 pnpm package:desktop:mac
```

先保存并安装旧版本，再以更高的桌面应用版本构建新版并保存到独立发布目录。启动该目录的服务，在旧版关于页检查更新，确认“正在下载 → 更新已就绪”，然后由用户确认重启安装。重启后核对实际桌面应用版本和已有用户配置。同版本发布只会显示已是最新版本，不能用于升级验收。

安装版读取内置 `resources/app-update.yml`，修改 shell 环境变量不会覆盖已安装应用的更新源。macOS 完整安装还需满足代码签名及签名身份匹配要求；当前 ad-hoc 本地产物不作为正式安装升级通过的依据。签名包另行提供后完成重启安装验收。下载通过与安装通过分别记录，不能使用虚增版本证明升级成功。

### 开发版下载测试

原来的模拟下载能力改为显式开发模式：

```bash
# 终端 1：虚增元数据版本，原安装包不变
pnpm dev:desktop:update-server --mode development

# 指定载荷和模拟版本
pnpm dev:desktop:update-server --mode development --artifact PureChat-0.2.0-arm64.zip --version 0.2.2

# RC 模拟下载
pnpm dev:desktop:update-server --mode development --channel rc --version 0.2.2-rc.1 --kbps 1024

# 终端 2：启动开发客户端
pnpm dev:desktop
```

将下列配置加入本机 `apps/desktop/.env.desktop.local`，修改后重启开发进程：

```dotenv
PURECHAT_DESKTOP_UPDATE_URL=http://127.0.0.1:5500
PURECHAT_DESKTOP_MULTI_INSTANCE=true
```

开发模式默认从 release 目录选择对应架构最新修改的 ZIP 或 NSIS 载荷，将桌面版本的下一补丁版本作为模拟元数据版本。开发客户端使用完整下载；完成后可点击“重启并安装”预览与生产版相同的确认弹框，弹框中的安装按钮禁用，不能执行安装。重复测试下载可使用关于页的“清理下载安装包缓存”；检查或下载期间不可清理。

### 更新日志排查

主进程复用 `electron-log`，文件与控制台均输出本地时间 `YYYY-MM-DD HH:mm:ss [级别] (模块) 正文`。日志按日期保存，单文件达到 10 MiB 时轮转；开发和生产日志分别位于 `userData/log/dev/` 与 `userData/log/pro/`，菜单“帮助 → 打开日志目录”可直接访问。

`desktop:app` 记录启动版本与运行平台，`desktop:window` 记录页面加载错误，`desktop:update` 记录更新源、配置路径、检查、下载、缓存命中、重试、取消及安装阶段。异常保留错误码、消息和堆栈；下载进度每跨过 10% 记录一次。日志中的 HTTP(S) URL 会去除凭据、查询参数和片段。

出现关于页“更新失败”时，同时查看客户端日志和服务终端日志：没有请求先核对包内更新源及服务是否运行；YAML 请求失败检查渠道与路径；载荷下载失败检查文件及 SHA-512；进入安装后失败查看原生更新器的签名与安装错误。服务不会绕过客户端签名或降级校验。

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
