'use client';

import { Tabs } from 'antd';
import { Mail } from 'lucide-react';

import { type EmailTemplatePreview } from '@/libs/better-auth/email-templates/preview';

type Props = {
  templates: EmailTemplatePreview[];
};

export function EmailTemplatePreviewPanel({ templates }: Props) {
  const items = templates.map(template => ({
    key: template.key,
    label: template.label,
    children: (
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-xs font-medium text-slate-500">Subject</dt>
              <dd className="mt-1 font-medium text-slate-950">{template.subject}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Text</dt>
              <dd className="mt-1 whitespace-pre-wrap text-slate-700">{template.text}</dd>
            </div>
          </dl>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-[#f4f4f5] shadow-sm">
          <iframe
            title={`${template.label} preview`}
            srcDoc={template.html}
            sandbox="allow-same-origin"
            className="h-[700px] w-full border-0"
          />
        </div>
      </div>
    ),
  }));

  return (
    <main className="h-screen overflow-y-auto bg-[#f5f7fb] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="border-b border-slate-200 pb-5">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-sm font-medium text-violet-700 ring-1 ring-violet-200">
            <Mail className="size-4" />
            email template preview
          </div>
          <h1 className="text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
            邮件模板预览
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            切换 Tab 预览 better-auth 邮件模板的 HTML 渲染效果（仅开发环境可用）。
          </p>
        </header>

        <Tabs defaultActiveKey={templates[0]?.key} items={items} />
      </div>
    </main>
  );
}
