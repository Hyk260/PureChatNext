import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

import { optionalUrlEnv, parseEnvBoolean } from './helpers'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      /** 桌面端 Generic 更新源覆盖地址；开发环境用于本地下载测试，生产默认使用 GitHub Releases。 */
      PURECHAT_DESKTOP_UPDATE_URL?: string
      /** 桌面端是否允许多个实例同时运行；Windows 始终单实例以便正确处理授权回跳。 */
      PURECHAT_DESKTOP_MULTI_INSTANCE?: string
    }
  }
}

/** 读取桌面端自动更新配置；调用时读取环境变量，便于开发环境先加载 `.env.desktop.local`。 */
export const getDesktopUpdateConfig = () => {
  return createEnv({
    server: {
      /** 桌面端自动更新源地址；必须是 HTTP(S) URL。 */
      PURECHAT_DESKTOP_UPDATE_URL: optionalUrlEnv(),
    },
    runtimeEnv: {
      // 桌面端自动更新
      PURECHAT_DESKTOP_UPDATE_URL: process.env.PURECHAT_DESKTOP_UPDATE_URL,
    },
  })
}

/** 读取桌面端实例运行配置；调用方可为开发版提供与生产包不同的默认值。 */
export const getDesktopRuntimeConfig = (defaultMultiInstance = false) => {
  return createEnv({
    server: {
      /** 允许非 Windows 平台的多实例；Windows 始终单实例，生产包缺省为关闭。 */
      PURECHAT_DESKTOP_MULTI_INSTANCE: z.boolean(),
    },
    runtimeEnv: {
      // 桌面端多开开关
      PURECHAT_DESKTOP_MULTI_INSTANCE: parseEnvBoolean(
        process.env.PURECHAT_DESKTOP_MULTI_INSTANCE,
        defaultMultiInstance
      ),
    },
  })
}
