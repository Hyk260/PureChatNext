import { NextResponse } from 'next/server'

/** 微信长轮询只能由常驻 Gateway 执行，避免 Cron 与 Gateway 重复消费同一绑定。 */
export async function GET() {
  return NextResponse.json(
    { error: 'WeChat Cron polling is disabled. Run the local or Docker Gateway instead.' },
    { status: 410 }
  )
}
