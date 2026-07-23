/**
 * 本地 / 自托管微信 iLink 常驻轮询进程。
 *
 * 用法：
 *   bun scripts/wechat-gateway.ts
 *   pnpm wechat:gateway
 *
 * 需要 DATABASE_URL；建议配置 REDIS_URL、OPENAI_API_KEY 或 DEEPSEEK_API_KEY。
 */
import 'dotenv/config'

import { DEFAULT_DURATION_MS, pollAllEnabledBindings } from '../src/libs/channels/wechat'

const LOOP_GAP_MS = 2_000

async function main() {
  console.log('[wechat-gateway] starting continuous poll loop…')

  for (;;) {
    try {
      const result = await pollAllEnabledBindings({ durationMs: DEFAULT_DURATION_MS })
      console.log(`[wechat-gateway] window done polled=${result.polled} sessionExpired=${result.sessionExpired}`)
    } catch (error) {
      console.error('[wechat-gateway] error:', error)
    }
    await new Promise((r) => setTimeout(r, LOOP_GAP_MS))
  }
}

main().catch((error) => {
  console.error('[wechat-gateway] fatal:', error)
  process.exit(1)
})
