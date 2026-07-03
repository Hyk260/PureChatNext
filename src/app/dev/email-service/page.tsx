'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clipboard,
  Code2,
  ExternalLink,
  Eye,
  FileJson,
  Loader2,
  Mail,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import type { RenderedEmailTemplate } from '@/libs/better-auth/email-templates/utils/preview-catalog';

import { EmailTemplateComposer } from './EmailTemplateComposer';
import { EmailTemplatePreviewBlock } from './EmailTemplatePreviewBlock';

type ActionMode = 'verify' | 'sendMail';
type ContentMode = 'custom' | 'template';
type ResultView = 'summary' | 'json';
type RightPanelView = 'preview' | 'response';
type ProviderOption = '' | 'nodemailer' | 'resend';

type VerifyResult = {
  valid: boolean;
};

type SendMailResult = {
  messageId: string;
  previewUrl?: string;
};

type ApiSuccess = {
  action: ActionMode;
  result: VerifyResult | SendMailResult;
  success: true;
};

type ApiFailure = {
  error: string;
  success: false;
};

type RunState = {
  durationMs: number;
  status: number;
  submittedAt: string;
};

const examples = {
  sendMail: {
    from: '',
    html: '<p>这是一封来自 <strong>EmailService</strong> 测试台的邮件。</p>',
    replyTo: '',
    subject: 'PureChatNext EmailService 测试',
    text: '这是一封来自 EmailService 测试台的邮件。',
    to: 'recipient@example.com',
  },
};

const actionOptions: Array<{
  description: string;
  icon: typeof ShieldCheck;
  label: string;
  value: ActionMode;
}> = [
  {
    description: '验证 SMTP 连接配置（Nodemailer 专用）',
    icon: ShieldCheck,
    label: 'Verify',
    value: 'verify',
  },
  {
    description: '发送测试邮件并查看 messageId / previewUrl',
    icon: Mail,
    label: 'Send Mail',
    value: 'sendMail',
  },
];

const providerOptions: Array<{ label: string; value: ProviderOption }> = [
  { label: 'Env 默认 · default', value: '' },
  { label: 'Nodemailer (SMTP)', value: 'nodemailer' },
  { label: 'Resend', value: 'resend' },
];

const contentModeOptions: Array<{ label: string; value: ContentMode }> = [
  { label: '自定义内容', value: 'custom' },
  { label: '认证模板', value: 'template' },
];

const isVerifyResult = (value: VerifyResult | SendMailResult | null): value is VerifyResult => {
  return Boolean(value && 'valid' in value);
};

const isSendMailResult = (value: VerifyResult | SendMailResult | null): value is SendMailResult => {
  return Boolean(value && 'messageId' in value);
};

const buildRequestBody = (
  action: ActionMode,
  values: {
    from: string;
    html: string;
    impl: ProviderOption;
    replyTo: string;
    subject: string;
    text: string;
    to: string;
  },
) => {
  const body: Record<string, unknown> = { action };

  if (values.impl) {
    body.impl = values.impl;
  }

  if (action === 'sendMail') {
    body.payload = {
      ...(values.from.trim() ? { from: values.from.trim() } : {}),
      ...(values.html.trim() ? { html: values.html.trim() } : {}),
      ...(values.replyTo.trim() ? { replyTo: values.replyTo.trim() } : {}),
      ...(values.text.trim() ? { text: values.text.trim() } : {}),
      subject: values.subject.trim(),
      to: values.to.trim(),
    };
  }

  return body;
};

export default function EmailServiceTestPage() {
  const [action, setAction] = useState<ActionMode>('verify');
  const [contentMode, setContentMode] = useState<ContentMode>('custom');
  const [rightPanel, setRightPanel] = useState<RightPanelView>('preview');
  const [view, setView] = useState<ResultView>('summary');
  const [impl, setImpl] = useState<ProviderOption>('');
  const [to, setTo] = useState(examples.sendMail.to);
  const [from, setFrom] = useState(examples.sendMail.from);
  const [subject, setSubject] = useState(examples.sendMail.subject);
  const [text, setText] = useState(examples.sendMail.text);
  const [html, setHtml] = useState(examples.sendMail.html);
  const [replyTo, setReplyTo] = useState(examples.sendMail.replyTo);
  const [renderedTemplate, setRenderedTemplate] = useState<RenderedEmailTemplate | null>(null);
  const [templateLabel, setTemplateLabel] = useState('注册验证');
  const [templateRenderLoading, setTemplateRenderLoading] = useState(false);
  const [templateRenderError, setTemplateRenderError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [runState, setRunState] = useState<RunState | null>(null);
  const [payload, setPayload] = useState<ApiSuccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const requestBody = useMemo(
    () => buildRequestBody(action, { from, html, impl, replyTo, subject, text, to }),
    [action, from, html, impl, replyTo, subject, text, to],
  );

  const result = payload?.result ?? null;
  const rawJson = payload ? JSON.stringify(payload, null, 2) : '';
  const requestJson = JSON.stringify(requestBody, null, 2);
  const verifyResult = isVerifyResult(result) ? result : null;
  const sendMailResult = isSendMailResult(result) ? result : null;
  const showTemplatePreview = action === 'sendMail' && contentMode === 'template';
  const canSubmit =
    action === 'verify' ||
    (to.trim().length > 0 &&
      subject.trim().length > 0 &&
      (text.trim().length > 0 || html.trim().length > 0) &&
      (!showTemplatePreview || (!templateRenderLoading && !templateRenderError)));

  const handleTemplateRendered = useCallback((template: RenderedEmailTemplate) => {
    setRenderedTemplate(template);
    setSubject(template.subject);
    setText(template.text);
    setHtml(template.html);
  }, []);

  const handleTemplateRenderStateChange = useCallback(
    (state: { error: string | null; isLoading: boolean }) => {
      setTemplateRenderLoading(state.isLoading);
      setTemplateRenderError(state.error);
    },
    [],
  );

  const handleTemplateChange = useCallback((_key: string, label: string) => {
    setTemplateLabel(label);
  }, []);

  const selectAction = (nextAction: ActionMode) => {
    setAction(nextAction);
    setError(null);
    setPayload(null);
    setRunState(null);
    setCopyState('idle');
    if (nextAction === 'sendMail' && contentMode === 'template') {
      setRightPanel('preview');
    }
  };

  const selectContentMode = (nextMode: ContentMode) => {
    setContentMode(nextMode);
    setError(null);
    setPayload(null);
    setRunState(null);
    setCopyState('idle');
    setRightPanel(nextMode === 'template' ? 'preview' : 'response');
  };

  const submit = async () => {
    if (!canSubmit) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setPayload(null);
    setCopyState('idle');

    const startedAt = performance.now();
    const submittedAt = new Date().toLocaleString();

    try {
      const response = await fetch('/api/dev/email', {
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      const data = (await response.json()) as ApiSuccess | ApiFailure;

      setRunState({
        durationMs: Math.round(performance.now() - startedAt),
        status: response.status,
        submittedAt,
      });

      if (!response.ok || !data.success) {
        setError('error' in data ? data.error : `Request failed with ${response.status}`);
        return;
      }

      setPayload(data);
      setView('summary');
      if (showTemplatePreview) {
        setRightPanel('response');
      }
    } catch (requestError) {
      setRunState({
        durationMs: Math.round(performance.now() - startedAt),
        status: 0,
        submittedAt,
      });
      setError(requestError instanceof Error ? requestError.message : 'Request failed');
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setAction('verify');
    setContentMode('custom');
    setRightPanel('preview');
    setImpl('');
    setTo(examples.sendMail.to);
    setFrom(examples.sendMail.from);
    setSubject(examples.sendMail.subject);
    setText(examples.sendMail.text);
    setHtml(examples.sendMail.html);
    setReplyTo(examples.sendMail.replyTo);
    setRenderedTemplate(null);
    setTemplateLabel('注册验证');
    setTemplateRenderLoading(false);
    setTemplateRenderError(null);
    setPayload(null);
    setError(null);
    setRunState(null);
    setCopyState('idle');
  };

  const copyJson = async () => {
    const textToCopy = view === 'json' && rawJson ? rawJson : requestJson;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1600);
    } catch {
      setCopyState('failed');
    }
  };

  const providerLabel = providerOptions.find(option => option.value === impl)?.label ?? 'Env 默认';

  return (
    <main className="h-screen overflow-y-auto bg-[#f5f7fb] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-sm font-medium text-cyan-700 ring-1 ring-cyan-200">
              <Sparkles className="size-4" />
              email API tester
            </div>
            <h1 className="text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
              邮件服务测试台
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              验证 EmailService 的 verify 与 sendMail 路径；Send Mail 支持选择认证模板、调整参数并预览后再发送。
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-lg bg-white p-1 shadow-sm ring-1 ring-slate-200">
            {actionOptions.map(option => {
              const Icon = option.icon;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => selectAction(option.value)}
                  title={option.description}
                  className={`inline-flex min-w-0 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                    action === option.value
                      ? 'bg-slate-950 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-950'
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{option.label}</span>
                </button>
              );
            })}
          </div>
        </header>

        <div className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <section className="flex min-w-0 flex-col gap-4">
            <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3 rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-cyan-900">
                {action === 'verify' ? (
                  <ShieldCheck className="mt-0.5 size-5 shrink-0" />
                ) : (
                  <Mail className="mt-0.5 size-5 shrink-0" />
                )}
                <div>
                  <div className="text-sm font-semibold">
                    {actionOptions.find(option => option.value === action)?.label}
                  </div>
                  <div className="mt-1 text-sm leading-5">
                    {actionOptions.find(option => option.value === action)?.description}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <label className="text-sm font-medium text-slate-800" htmlFor="email-service-impl">
                  Provider · 邮件提供商
                </label>
                <select
                  id="email-service-impl"
                  value={impl}
                  onChange={event => setImpl(event.target.value as ProviderOption)}
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-3 focus:ring-cyan-100"
                >
                  {providerOptions.map(option => (
                    <option key={option.value || 'default'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {action === 'sendMail' ? (
                <div className="mt-4 grid min-w-0 gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-800">内容来源</div>
                    <div className="mt-2 grid min-w-0 grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                      {contentModeOptions.map(option => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => selectContentMode(option.value)}
                          className={`min-w-0 truncate rounded-md px-2 py-2 text-xs font-medium transition sm:px-3 sm:text-sm ${
                            contentMode === option.value
                              ? 'bg-white text-slate-950 shadow-sm'
                              : 'text-slate-500 hover:text-slate-900'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-800" htmlFor="email-service-to">
                      收件人 · To
                    </label>
                    <input
                      id="email-service-to"
                      value={to}
                      onChange={event => {
                        setTo(event.target.value);
                        setError(null);
                      }}
                      placeholder="recipient@example.com"
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:ring-3 focus:ring-cyan-100"
                    />
                    <p className="mt-2 text-xs leading-5 text-slate-500">多个收件人可用逗号或换行分隔。</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-800" htmlFor="email-service-from">
                      发件人 · From
                    </label>
                    <input
                      id="email-service-from"
                      value={from}
                      onChange={event => setFrom(event.target.value)}
                      placeholder="留空则使用 SMTP_FROM / RESEND_FROM"
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:ring-3 focus:ring-cyan-100"
                    />
                  </div>

                  {contentMode === 'template' ? (
                    <EmailTemplateComposer
                      onRendered={handleTemplateRendered}
                      onRenderStateChange={handleTemplateRenderStateChange}
                      onTemplateChange={handleTemplateChange}
                    />
                  ) : (
                    <>
                      <div>
                        <label className="text-sm font-medium text-slate-800" htmlFor="email-service-subject">
                          主题 · Subject
                        </label>
                        <input
                          id="email-service-subject"
                          value={subject}
                          onChange={event => {
                            setSubject(event.target.value);
                            setError(null);
                          }}
                          placeholder="邮件主题"
                          className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:ring-3 focus:ring-cyan-100"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium text-slate-800" htmlFor="email-service-text">
                          纯文本 · Text
                        </label>
                        <textarea
                          id="email-service-text"
                          value={text}
                          onChange={event => {
                            setText(event.target.value);
                            setError(null);
                          }}
                          rows={3}
                          placeholder="Plain text body"
                          className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:ring-3 focus:ring-cyan-100"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium text-slate-800" htmlFor="email-service-html">
                          HTML 正文 · HTML
                        </label>
                        <textarea
                          id="email-service-html"
                          value={html}
                          onChange={event => {
                            setHtml(event.target.value);
                            setError(null);
                          }}
                          rows={4}
                          placeholder="<p>HTML body</p>"
                          className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:ring-3 focus:ring-cyan-100"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="text-sm font-medium text-slate-800" htmlFor="email-service-reply-to">
                      回复地址 · Reply-To
                    </label>
                    <input
                      id="email-service-reply-to"
                      value={replyTo}
                      onChange={event => setReplyTo(event.target.value)}
                      placeholder="support@example.com"
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:ring-3 focus:ring-cyan-100"
                    />
                  </div>
                </div>
              ) : null}

              <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                <button
                  type="button"
                  disabled={!canSubmit || isLoading}
                  onClick={submit}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  发送请求
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="grid size-10 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-950"
                  aria-label="重置测试"
                  title="重置测试"
                >
                  <RefreshCcw className="size-4" />
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-950">请求详情</h2>
              <dl className="mt-3 grid gap-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Endpoint</dt>
                  <dd className="font-mono text-xs text-slate-900">POST /api/dev/email</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Action</dt>
                  <dd className="font-mono text-xs text-slate-900">{action}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Provider</dt>
                  <dd className="font-mono text-xs text-slate-900">{providerLabel}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">状态码</dt>
                  <dd className="font-mono text-xs text-slate-900">{runState?.status ?? 'N/A'}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">耗时</dt>
                  <dd className="font-mono text-xs text-slate-900">
                    {runState ? `${runState.durationMs.toLocaleString()} ms` : 'N/A'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">提交时间</dt>
                  <dd className="text-right text-xs text-slate-900">{runState?.submittedAt ?? 'N/A'}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-950">请求体</h2>
                <button
                  type="button"
                  onClick={copyJson}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <Clipboard className="size-3.5" />
                  {copyState === 'copied' ? '已复制' : copyState === 'failed' ? '复制失败' : '复制'}
                </button>
              </div>
              <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-100">
                {requestJson}
              </pre>
            </div>
          </section>

          <section className="flex min-w-0 flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-4">
              {error ? (
                <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
                  <AlertCircle className="mt-0.5 size-5 shrink-0" />
                  <div>
                    <div className="text-sm font-semibold">请求失败</div>
                    <div className="mt-1 text-sm leading-5">{error}</div>
                  </div>
                </div>
              ) : payload ? (
                <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
                  <div>
                    <div className="text-sm font-semibold">请求完成</div>
                    <div className="mt-1 text-sm leading-5">
                      {payload.action} 返回成功，下面可查看摘要与原始 JSON。
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-600">
                  <FileJson className="mt-0.5 size-5 shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">等待请求</div>
                    <div className="mt-1 text-sm leading-5">
                      选择方法并填写参数后发送请求，响应会显示在这里。
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ['Action', payload?.action ?? action],
                  ['Provider', providerLabel],
                  [
                    '结果',
                    verifyResult
                      ? verifyResult.valid
                        ? 'valid'
                        : 'invalid'
                      : sendMailResult?.messageId,
                  ],
                  ['HTTP 耗时', runState ? `${runState.durationMs.toLocaleString()} ms` : undefined],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-medium text-slate-500">{label}</div>
                    <div className="mt-1 truncate text-sm font-semibold text-slate-950">{value ?? 'N/A'}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              {showTemplatePreview ? (
                <div className="grid w-full grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 sm:max-w-md">
                  <button
                    type="button"
                    onClick={() => setRightPanel('preview')}
                    className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                      rightPanel === 'preview'
                        ? 'bg-white text-slate-950 shadow-sm'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <Eye className="size-4" />
                    模板预览
                  </button>
                  <button
                    type="button"
                    onClick={() => setRightPanel('response')}
                    className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                      rightPanel === 'response'
                        ? 'bg-white text-slate-950 shadow-sm'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <FileJson className="size-4" />
                    请求响应
                  </button>
                </div>
              ) : null}

              {showTemplatePreview && rightPanel === 'preview' ? null : (
                <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 sm:ml-auto">
                  {[
                    ['summary', '摘要'],
                    ['json', 'JSON'],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setView(key as ResultView)}
                      className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                        view === key ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      {key === 'json' ? <Code2 className="size-4" /> : <FileJson className="size-4" />}
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {showTemplatePreview && rightPanel === 'preview' ? (
                <EmailTemplatePreviewBlock
                  error={templateRenderError}
                  isLoading={templateRenderLoading}
                  label={templateLabel}
                  template={renderedTemplate}
                />
              ) : view === 'json' ? (
                <pre className="h-full overflow-auto rounded-lg bg-slate-950 p-4 font-mono text-xs leading-5 text-slate-100">
                  {rawJson || '// Response JSON will appear here'}
                </pre>
              ) : verifyResult ? (
                <article className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheck
                      className={`mt-0.5 size-5 shrink-0 ${
                        verifyResult.valid ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    />
                    <div>
                      <div className="text-base font-semibold text-slate-950">
                        {verifyResult.valid ? 'SMTP 连接验证通过' : 'SMTP 连接验证失败'}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {verifyResult.valid
                          ? 'EmailService.verify() 返回 true，当前 Provider 配置可用。'
                          : 'EmailService.verify() 返回 false，请检查 SMTP 环境变量。'}
                      </p>
                      <span
                        className={`mt-3 inline-flex rounded-md px-2 py-1 text-xs font-medium ${
                          verifyResult.valid
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        valid: {String(verifyResult.valid)}
                      </span>
                    </div>
                  </div>
                </article>
              ) : sendMailResult ? (
                <article className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start gap-3">
                    <Mail className="mt-0.5 size-5 shrink-0 text-cyan-700" />
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-semibold text-slate-950">邮件发送成功</div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        EmailService.sendMail() 已完成，可在下方查看 messageId 与预览链接。
                      </p>

                      <dl className="mt-4 grid gap-3 text-sm">
                        <div>
                          <dt className="text-xs font-medium text-slate-500">Message ID</dt>
                          <dd className="mt-1 break-all font-mono text-xs text-slate-900">
                            {sendMailResult.messageId}
                          </dd>
                        </div>
                        {sendMailResult.previewUrl ? (
                          <div>
                            <dt className="text-xs font-medium text-slate-500">Preview URL</dt>
                            <dd className="mt-1">
                              <a
                                href={sendMailResult.previewUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 break-all text-sm font-medium text-cyan-700 hover:text-cyan-900"
                              >
                                {sendMailResult.previewUrl}
                                <ExternalLink className="size-3.5 shrink-0" />
                              </a>
                            </dd>
                          </div>
                        ) : null}
                      </dl>
                    </div>
                  </div>
                </article>
              ) : (
                <div className="grid min-h-96 place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <div>
                    <Mail className="mx-auto size-10 text-slate-400" />
                    <div className="mt-3 text-sm font-semibold text-slate-950">还没有响应</div>
                    <div className="mt-1 text-sm text-slate-500">发送请求后会展示 verify 或 sendMail 结果。</div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
