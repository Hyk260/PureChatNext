import { IS_VERCEL } from '@/envs/app'
import { gatewayEnv } from '@/envs/gateway'
import { serverDBEnv } from '@/envs/serverDB'

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (IS_VERCEL || !serverDBEnv.DATABASE_URL) return
  const { ensureTaskSchedulerRunning } = await import('@/server/tasks/manager')
  ensureTaskSchedulerRunning()
  if (!gatewayEnv.CHANNEL_GATEWAY_ENABLED) return
  const { ensureChannelGatewayRunning } = await import('@/server/channel-gateway')
  ensureChannelGatewayRunning().catch((error) => {
    console.error('[Channel Gateway] 启动失败', error)
  })
}
