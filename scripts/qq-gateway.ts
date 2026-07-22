/**
 * 本地 / 自托管 QQ WebSocket Gateway 常驻进程。
 *
 * 用法：
 *   bun scripts/qq-gateway.ts
 *   pnpm qq:gateway
 *
 * 仅处理 connectionMode=websocket 的绑定；Webhook 模式无需本进程。
 * 需要 DATABASE_URL；建议配置 APP_URL、OPENAI_API_KEY 或 DEEPSEEK_API_KEY。
 */
import 'dotenv/config'

import {
  DEFAULT_QQ_GATEWAY_DURATION_MS,
  runAllQQWebSocketGateways,
} from '../src/libs/channels/qq'

const LOOP_GAP_MS = 5_000

async function main() {
  console.log('[qq-gateway] starting WebSocket gateway loop…')

  for (;;) {
    const controller = new AbortController()
    try {
      const result = await runAllQQWebSocketGateways({
        durationMs: DEFAULT_QQ_GATEWAY_DURATION_MS,
        signal: controller.signal,
      })
      console.log(
        `[qq-gateway] window done started=${result.started} skipped=${result.skipped}`,
      )
    } catch (error) {
      console.error('[qq-gateway] error:', error)
    }
    await new Promise((r) => setTimeout(r, LOOP_GAP_MS))
  }
}

main().catch((error) => {
  console.error('[qq-gateway] fatal:', error)
  process.exit(1)
})
