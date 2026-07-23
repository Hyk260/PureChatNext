'use client'

import { AlertCircle, Loader2 } from 'lucide-react'

import { type RenderedEmailTemplate } from '@/libs/better-auth/email-templates/preview'

type Props = {
  error?: string | null
  isLoading?: boolean
  label?: string
  template: RenderedEmailTemplate | null
}

export function EmailTemplatePreviewBlock({ error, isLoading, label, template }: Props) {
  if (isLoading) {
    return (
      <div className='grid min-h-96 place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center'>
        <div>
          <Loader2 className='mx-auto size-8 animate-spin text-slate-400' />
          <div className='mt-3 text-sm font-semibold text-slate-950'>正在渲染模板…</div>
          <div className='mt-1 text-sm text-slate-500'>参数变更后将自动更新预览。</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className='flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800'>
        <AlertCircle className='mt-0.5 size-5 shrink-0' />
        <div>
          <div className='text-sm font-semibold'>模板渲染失败</div>
          <div className='mt-1 text-sm leading-5'>{error}</div>
        </div>
      </div>
    )
  }

  if (!template) {
    return (
      <div className='grid min-h-96 place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center'>
        <div>
          <div className='text-sm font-semibold text-slate-950'>暂无预览</div>
          <div className='mt-1 text-sm text-slate-500'>选择模板并填写参数后将显示预览。</div>
        </div>
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-4'>
      {label ? (
        <div className='text-sm font-medium text-slate-700'>
          当前模板：<span className='text-slate-950'>{label}</span>
        </div>
      ) : null}

      <div className='rounded-lg border border-slate-200 bg-slate-50 p-4'>
        <dl className='grid gap-3 text-sm'>
          <div>
            <dt className='text-xs font-medium text-slate-500'>Subject</dt>
            <dd className='mt-1 font-medium text-slate-950'>{template.subject}</dd>
          </div>
          <div>
            <dt className='text-xs font-medium text-slate-500'>Text</dt>
            <dd className='mt-1 whitespace-pre-wrap text-slate-700'>{template.text}</dd>
          </div>
        </dl>
      </div>

      <div className='overflow-hidden rounded-lg border border-slate-200 bg-[#f4f4f5] shadow-sm'>
        <iframe
          title={label ? `${label} preview` : 'Email template preview'}
          srcDoc={template.html}
          sandbox='allow-same-origin'
          className='h-[600px] w-full border-0'
        />
      </div>
    </div>
  )
}
