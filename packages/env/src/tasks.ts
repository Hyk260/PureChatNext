import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

import { parseEnvBoolean } from './helpers'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      /** 自部署常驻任务调度器；开发默认关闭，Vercel 强制关闭。 */
      TASK_SCHEDULER_ENABLED?: string
    }
  }
}

export const getTaskConfig = () =>
  createEnv({
    server: { TASK_SCHEDULER_ENABLED: z.boolean() },
    runtimeEnv: {
      TASK_SCHEDULER_ENABLED:
        !parseEnvBoolean(process.env.VERCEL) && parseEnvBoolean(process.env.TASK_SCHEDULER_ENABLED),
    },
  })

export const taskEnv = getTaskConfig()
