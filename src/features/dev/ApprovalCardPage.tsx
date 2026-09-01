'use client'

import { useCallback, useState } from 'react'
import { ListChecks } from 'lucide-react'

import { ApprovalCard } from '@pure/ui'
import type { ApprovalCardProps, ApprovalPlanStep, ApprovalQuestion, ApprovalVariant } from '@pure/ui'

type VariantMeta = {
  description: string
  label: string
  value: ApprovalVariant
}

const DEMO_QUESTIONS: ApprovalQuestion[] = [
  {
    id: 'q1',
    prompt: '鉴权方式用哪一种？',
    options: ['会话 Cookie', 'JWT Bearer', '仅 OAuth'],
  },
  {
    id: 'q2',
    prompt: '密钥应该放在哪里？',
    options: ['.env.local', 'Vault / 密钥管理服务', '仅 CI'],
  },
  {
    id: 'q3',
    prompt: '是否用功能开关灰度发布？',
    options: ['是，逐步放量', '否，全量发布'],
  },
]

const DEMO_PLAN: ApprovalPlanStep[] = [
  { id: 'p1', title: '新增 sessions 表迁移', detail: '编写并执行 SQL，保留回滚脚本' },
  { id: 'p2', title: '接入鉴权中间件', detail: '保护 /account 与 /api/checkout' },
  { id: 'p3', title: '更新登录流程与测试', detail: 'Magic-link 路径与主路径 e2e' },
  { id: 'p4', title: '增加账号设置页', detail: '资料、会话与危险操作区' },
  { id: 'p5', title: '收紧 CSRF 与限流', detail: '保护鉴权与结账接口' },
  { id: 'p6', title: '编写放量说明', detail: '更新日志与客服话术' },
]

const DEMO_CARDS: Record<ApprovalVariant, ApprovalCardProps> = {
  questions: {
    variant: 'questions',
    title: '问题确认',
    questions: DEMO_QUESTIONS,
    approveLabel: '继续',
    rejectLabel: '跳过',
  },
  command: {
    variant: 'command',
    title: '运行这条命令？',
    command: 'pnpm db:migrate && pnpm build',
    cwd: '~/aicss',
    approveLabel: '运行',
    rejectLabel: '跳过',
  },
  plan: {
    variant: 'plan',
    title: '计划概览',
    planTitle: '会话鉴权迁移',
    planSummary: '上线基于 Cookie 的会话，并配上中间件与测试。\n包含面向生产的安全放量路径。',
    plan: DEMO_PLAN,
    approveLabel: '批准',
    rejectLabel: '查看计划',
  },
}

const EMPTY_COMMAND_CARD: ApprovalCardProps = {
  variant: 'command',
  title: '允许读取系统信息？',
  command: '',
  cwd: '',
  approveLabel: '批准',
  rejectLabel: '拒绝',
}

const VARIANTS: VariantMeta[] = [
  { description: '多题单选、自定义其他、步进与继续', label: '问答', value: 'questions' },
  { description: '工作目录、命令预览；二者皆空时隐藏命令块', label: '命令', value: 'command' },
  { description: '待办折叠、30s 自动批准、批准 / 查看计划', label: '计划', value: 'plan' },
]

const ACTION_LABELS = {
  approve: '批准',
  reject: '拒绝',
} as const

const VARIANT_LABELS: Record<ApprovalVariant, string> = {
  command: '命令',
  plan: '计划',
  questions: '问答',
}

const MAX_EVENTS = 12

type ApprovalEvent = {
  action: keyof typeof ACTION_LABELS
  at: string
  payload?: { answers?: Record<string, string> }
  variant: ApprovalVariant
}

const formatEventTime = () =>
  new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', hour12: false, minute: '2-digit', second: '2-digit' })

const formatEventDetail = (event: ApprovalEvent) => {
  if (event.action === 'reject') return 'onReject()'
  if (event.payload?.answers) return `onApprove(${JSON.stringify(event.payload.answers)})`
  return 'onApprove()'
}

const variantButtonClass = (active: boolean) =>
  `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
    active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
  }`

export default function ApprovalCardPage() {
  const [variant, setVariant] = useState<ApprovalVariant>('questions')
  const [instanceId, setInstanceId] = useState(0)
  const [events, setEvents] = useState<ApprovalEvent[]>([])

  const pushEvent = useCallback((event: Omit<ApprovalEvent, 'at'>) => {
    setEvents((prev) => [{ ...event, at: formatEventTime() }, ...prev].slice(0, MAX_EVENTS))
  }, [])

  const makeHandlers = (nextVariant: ApprovalVariant) => ({
    onApprove: (payload?: { answers?: Record<string, string> }) => {
      pushEvent({ action: 'approve', payload, variant: nextVariant })
    },
    onReject: () => {
      pushEvent({ action: 'reject', variant: nextVariant })
    },
  })

  const activeMeta = VARIANTS.find((item) => item.value === variant)

  return (
    <main className='h-screen overflow-y-auto bg-[#f5f7fb] text-slate-950'>
      <div className='mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8'>
        <header className='flex flex-col gap-2'>
          <div className='flex items-center gap-3'>
            <span className='flex size-10 items-center justify-center rounded-xl bg-white shadow-sm'>
              <ListChecks className='size-5 text-slate-700' />
            </span>
            <div>
              <h1 className='text-2xl font-semibold'>ApprovalCard</h1>
              <p className='text-sm text-slate-500'>验证 `@pure/ui` 问答、命令、计划三种审批卡片。</p>
            </div>
          </div>
        </header>

        <section className='rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <h2 className='text-sm font-medium text-slate-700'>当前变体</h2>
            <button
              className='rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200'
              onClick={() => setInstanceId((id) => id + 1)}
              type='button'
            >
              重置卡片
            </button>
          </div>
          <div className='mt-3 flex flex-wrap gap-2'>
            {VARIANTS.map((item) => (
              <button
                className={variantButtonClass(variant === item.value)}
                key={item.value}
                onClick={() => setVariant(item.value)}
                type='button'
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className='mt-2 text-xs text-slate-500'>{activeMeta?.description}</p>

          <div className='mt-5 grid gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:items-start'>
            <div className='flex flex-col gap-4'>
              <ApprovalCard key={`${variant}-${instanceId}`} {...DEMO_CARDS[variant]} {...makeHandlers(variant)} />
              {variant === 'command' ? (
                <div className='flex flex-col gap-2'>
                  <p className='text-xs text-slate-500'>无参工具：cwd / command 皆空时应隐藏命令块</p>
                  <ApprovalCard
                    key={`command-empty-${instanceId}`}
                    {...EMPTY_COMMAND_CARD}
                    {...makeHandlers('command')}
                  />
                </div>
              ) : null}
            </div>

            <div className='rounded-xl border border-slate-200 bg-slate-50 p-4'>
              <div className='flex items-center justify-between gap-2'>
                <h3 className='text-sm font-medium text-slate-700'>回调日志</h3>
                <button
                  className='text-xs text-slate-500 hover:text-slate-800'
                  disabled={events.length === 0}
                  onClick={() => setEvents([])}
                  type='button'
                >
                  清空
                </button>
              </div>
              {events.length === 0 ? (
                <p className='mt-3 text-xs text-slate-500'>尚未触发回调。选择选项、批准或跳过后，onApprove / onReject 会出现在这里。</p>
              ) : (
                <ul className='mt-3 space-y-2 font-mono text-xs text-slate-600'>
                  {events.map((event, index) => (
                    <li className='rounded-lg bg-white px-3 py-2 shadow-sm' key={`${event.at}-${index}`}>
                      <span className='text-slate-400'>{event.at}</span>
                      <span className='mx-2 text-slate-300'>·</span>
                      <span className='font-medium text-slate-800'>{VARIANT_LABELS[event.variant]}</span>
                      <span className='mx-2 text-slate-300'>·</span>
                      <span>{ACTION_LABELS[event.action]}</span>
                      <div className='mt-1 break-all text-slate-500'>{formatEventDetail(event)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        <section className='grid gap-6 xl:grid-cols-3'>
          {VARIANTS.map((item) => (
            <div className='rounded-2xl border border-slate-200 bg-white p-5 shadow-sm' key={item.value}>
              <h2 className='text-sm font-medium text-slate-700'>{item.label}</h2>
              <p className='mt-1 text-xs text-slate-500'>{item.description}</p>
              <div className='mt-4'>
                <ApprovalCard {...DEMO_CARDS[item.value]} {...makeHandlers(item.value)} />
              </div>
            </div>
          ))}
        </section>

        <section className='rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm'>
          <h2 className='font-medium text-slate-800'>对照清单</h2>
          <ul className='mt-3 list-disc space-y-1 pl-5'>
            <li>问答：选完自动进下一题；Other 输入后 Enter；未答完「继续」禁用；继续回调带 answers</li>
            <li>命令：展示 cwd 与命令原文；二者皆空时隐藏命令块（只留标题+按钮）；运行 / 跳过触发回调</li>
            <li>计划：默认预览 3 条，展开看剩余；倒计时 30s 自动批准；点 X 取消自动批准</li>
            <li>长标题/摘要应换行，而不是横向撑破卡片</li>
          </ul>
        </section>
      </div>
    </main>
  )
}
