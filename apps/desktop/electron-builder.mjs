import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadEnv } from 'vite'

import { syncDesktopVersion } from './scripts/sync-version.mjs'
import { verifyAfterPack } from './scripts/verify-package.mjs'
import { prepareTerminalRuntime } from './scripts/terminal-runtime.mjs'

const desktopDir = path.dirname(fileURLToPath(import.meta.url))
// 从根 package.json 同步桌面应用版本，作为安装包和更新比较的版本来源。
const version = syncDesktopVersion(desktopDir)
// electron-builder 与 electron-vite 独立运行，需自行加载桌面环境变量文件。
const desktopEnv = loadEnv('desktop', desktopDir, 'PURECHAT_DESKTOP_')
const updateUrl = desktopEnv.PURECHAT_DESKTOP_UPDATE_URL?.trim()
const appIcon = path.join(desktopDir, 'build/icon.png')
const trayIcon = path.join(desktopDir, 'build/tray.png')

/** @type {import('electron-builder').Configuration} */
const config = {
  // 应用程序的唯一标识符。
  appId: 'com.purechat.desktop',
  // 应用名称，用于程序显示名称及安装包文件名中的 productName。
  productName: 'PureChat',
  // Builder 在加载配置前已读取 manifest，需同时覆盖其缓存的应用版本。
  extraMetadata: { version },
  // 从 Markdown 文件读取更新说明，写入生成的更新渠道元数据。
  releaseInfo: {
    releaseNotesFile: path.join(desktopDir, 'build/release-notes.md'),
  },
  // 保留的 Electron 语言资源：简体中文。
  electronLanguages: ['zh-CN'],
  directories: {
    // 构建资源目录，存放应用图标、托盘图标和更新说明等文件。
    buildResources: path.join(desktopDir, 'build'),
    // 安装包、更新元数据及解包目录的输出位置。
    output: path.join(desktopDir, 'release'),
  },
  // 默认应用图标，各平台也显式复用同一图标。
  icon: appIcon,
  // 仅打包构建产物和 manifest，排除依赖目录及 sourcemap。
  // main/preload 打包普通依赖，终端原生依赖在签名前单独复制到资源目录。
  files: ['dist/**/*', 'package.json', '!node_modules', '!**/*.map', '!dist/terminal/**'],
  // 返回 false 表示 node_modules 已在 Builder 外处理，跳过原生依赖重建和 pnpm workspace 收集。
  // 不要同时设置 npmRebuild: false，否则 beforeBuild 被跳过，monorepo 依赖收集仍会执行。
  beforeBuild: () => false,
  beforePack: async (context) => {
    const arch = { 1: 'x64', 3: 'arm64' }[context.arch]
    await prepareTerminalRuntime(context.electronPlatformName, arch)
  },
  // 额外资源复制到 resources 目录，供运行时读取，不放入 app.asar。
  extraResources: [
    { from: appIcon, to: 'purechat-appicon.png' },
    { from: trayIcon, to: 'tray.png' },
  ],
  // 打包后校验 ASAR 文件边界、必要入口、64 MiB 体积预算及额外图标资源。
  afterPack: verifyAfterPack,
  // 注册 purechat:// 自定义协议，用于从系统浏览器回调桌面应用。
  protocols: [{ name: 'PureChat', schemes: ['purechat'] }],
  // macOS 系统相关配置。
  mac: {
    // 应用分类：效率工具。
    category: 'public.app-category.productivity',
    icon: appIcon,
    // ZIP 使用普通压缩，缩短构建耗时，归档体积仅小幅增加。
    compression: 'normal',
    // 产物名称包含应用名、版本和架构；ext 由目标格式决定。
    artifactName: '${productName}-${version}-${arch}.${ext}',
    // arm64 = Apple Silicon（M 系列）；x64 = Intel Mac，取消注释可另生成 Intel 包。
    target: [
      {
        // DMG 磁盘映像，用于拖拽安装。
        target: 'dmg',
        arch: [
          'arm64',
          // 'x64'
        ],
      },
      {
        // ZIP 归档，同时作为 macOS 自动更新载荷。
        target: 'zip',
        arch: [
          'arm64',
          // 'x64'
        ],
      },
    ],
  },
  // DMG 磁盘映像配置。
  dmg: {
    // 单独使用 bzip2 压缩（UDBZ），保留较小的 DMG 体积。
    format: 'UDBZ',
    artifactName: '${productName}-${version}-${arch}.${ext}',
  },
  // Windows 系统相关配置。
  win: {
    icon: appIcon,
    // 生成 x64 NSIS 安装包和 portable 免安装 EXE。
    target: [
      { target: 'nsis', arch: ['x64'] },
      { target: 'portable', arch: ['x64'] },
    ],
  },
  // Windows NSIS 安装向导配置。
  nsis: {
    // 安装包名称。
    artifactName: '${productName}-${version}-setup.${ext}',
    // false = 显示安装向导，true = 一键安装。
    oneClick: false,
    // 不强制为所有用户安装，由安装向导提供安装范围选择。
    perMachine: false,
    // 允许用户修改安装目录，仅适用于安装向导模式。
    allowToChangeInstallationDirectory: true,
  },
  // Windows 便携版配置，生成可直接运行的自解压 EXE。
  portable: {
    artifactName: '${productName}-${version}-portable.${ext}',
  },
  // 生产默认使用公开 GitHub Releases；仅在本地下载测试或自托管时用更新地址覆盖。
  // Shell/CI 环境变量优先于桌面 env 文件；--publish never 只禁止上传，仍生成更新配置和元数据。
  publish: updateUrl
    ? [{ provider: 'generic', url: updateUrl }]
    : [{ provider: 'github', owner: 'Hyk260', repo: 'PureChatNext' }],
}

export default config
