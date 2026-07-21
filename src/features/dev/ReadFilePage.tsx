'use client';

import { type ChangeEvent, type DragEvent, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clipboard,
  Download,
  FileJson,
  FileText,
  Loader2,
  Link2,
  RefreshCcw,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react';

import { type DocumentPage, type FileDocument } from '@pure/file-loaders';

type RequestMode = 'file' | 'url';
type ResultView = 'content' | 'pages' | 'json';

type ApiError = {
  error?: string;
};

type RunState = {
  durationMs: number;
  mode: RequestMode;
  status: number;
  submittedAt: string;
};

const supportedFormats = ['TXT', 'MD', 'CSV', 'JSON', 'PDF', 'DOCX', 'XLSX', 'XLS', 'PPTX'];

const exampleText = `# PureChat read-file smoke test

This sample checks the multipart upload path.

- Plain text extraction
- Line and character counts
- Page/chunk rendering
`;

const formatBytes = (bytes: number) => {
  if (bytes === 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;

  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
};

const summarizeValue = (value: unknown) => {
  if (value === undefined || value === null || value === '') {
    return 'N/A';
  }

  if (typeof value === 'number') {
    return value.toLocaleString();
  }

  return String(value);
};

const pageTitle = (page: DocumentPage, index: number) => {
  const metadata = page.metadata ?? {};
  const label =
    metadata.pageNumber ??
    metadata.slideNumber ??
    metadata.sheetName ??
    metadata.sectionTitle ??
    metadata.chunkIndex;

  return label === undefined ? `Page ${index + 1}` : `Page ${label}`;
};

export default function ReadFileTestPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<RequestMode>('file');
  const [view, setView] = useState<ResultView>('content');
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<FileDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runState, setRunState] = useState<RunState | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const rawJson = useMemo(() => {
    if (!result) {
      return '';
    }

    return JSON.stringify(result, null, 2);
  }, [result]);

  const pages = result?.pages ?? [];
  const canSubmit = mode === 'file' ? Boolean(file) : url.trim().length > 0;

  const pickFile = (nextFile: File | null) => {
    setFile(nextFile);
    setError(null);
    setResult(null);
    setRunState(null);
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    pickFile(event.target.files?.[0] ?? null);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    pickFile(event.dataTransfer.files?.[0] ?? null);
  };

  const loadSampleFile = () => {
    const sample = new File([exampleText], 'read-file-sample.md', { type: 'text/markdown' });
    pickFile(sample);
    setMode('file');
  };

  const reset = () => {
    setFile(null);
    setUrl('');
    setResult(null);
    setError(null);
    setRunState(null);
    setCopyState('idle');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const submit = async () => {
    if (!canSubmit) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);
    setCopyState('idle');

    const startedAt = performance.now();
    const submittedAt = new Date().toLocaleString();

    try {
      let response: Response;

      if (mode === 'file' && file) {
        const formData = new FormData();
        formData.append('file', file);
        response = await fetch('/api/read-file', {
          method: 'POST',
          body: formData,
        });
      } else {
        response = await fetch('/api/read-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: url.trim() }),
        });
      }

      const payload = (await response.json()) as FileDocument | ApiError;
      const durationMs = Math.round(performance.now() - startedAt);

      setRunState({
        durationMs,
        mode,
        status: response.status,
        submittedAt,
      });

      if (!response.ok) {
        setError('error' in payload && payload.error ? payload.error : `Request failed with ${response.status}`);
        return;
      }

      setResult(payload as FileDocument);
      setView('content');
    } catch (requestError) {
      setRunState({
        durationMs: Math.round(performance.now() - startedAt),
        mode,
        status: 0,
        submittedAt,
      });
      setError(requestError instanceof Error ? requestError.message : 'Request failed');
    } finally {
      setIsLoading(false);
    }
  };

  const copyJson = async () => {
    if (!rawJson) {
      return;
    }

    try {
      await navigator.clipboard.writeText(rawJson);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1600);
    } catch {
      setCopyState('failed');
    }
  };

  const downloadJson = () => {
    if (!rawJson) {
      return;
    }

    const blob = new Blob([rawJson], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = `${result?.filename ?? 'read-file-result'}.json`;
    anchor.click();
    URL.revokeObjectURL(href);
  };

  return (
    <main className="h-screen overflow-y-auto bg-[#f6f7fb] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200">
              <Sparkles className="size-4" />
              read-file API tester
            </div>
            <h1 className="text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
              文件解析功能测试台
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              测试上传文件和远程 URL 两种入口，查看标准化内容、分页块、统计信息和原始 JSON 响应。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {supportedFormats.map(format => (
              <span
                key={format}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm"
              >
                {format}
              </span>
            ))}
          </div>
        </header>

        <div className="grid flex-1 gap-6 lg:grid-cols-[390px_minmax(0,1fr)]">
          <section className="flex flex-col gap-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setMode('file')}
                  className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                    mode === 'file'
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <UploadCloud className="size-4" />
                  上传文件
                </button>
                <button
                  type="button"
                  onClick={() => setMode('url')}
                  className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                    mode === 'url'
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Link2 className="size-4" />
                  URL
                </button>
              </div>

              {mode === 'file' ? (
                <div className="mt-4">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        fileInputRef.current?.click();
                      }
                    }}
                    onDragOver={event => {
                      event.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center transition ${
                      isDragging
                        ? 'border-emerald-400 bg-emerald-50'
                        : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-white'
                    }`}
                  >
                    <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileInput} />
                    <div className="grid size-12 place-items-center rounded-lg bg-white text-emerald-600 shadow-sm ring-1 ring-slate-200">
                      <UploadCloud className="size-6" />
                    </div>
                    <div className="mt-4 text-sm font-medium text-slate-900">
                      拖拽文件到这里，或点击选择
                    </div>
                    <div className="mt-1 text-xs text-slate-500">支持文本、PDF、Office 文档和表格</div>
                  </div>

                  {file ? (
                    <div className="mt-3 flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <FileText className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-slate-900">{file.name}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {formatBytes(file.size)} · {file.type || 'unknown MIME'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => pickFile(null)}
                        className="grid size-8 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-white hover:text-slate-900"
                        aria-label="移除文件"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={loadSampleFile}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                  >
                    <FileText className="size-4" />
                    载入 Markdown 示例文件
                  </button>
                </div>
              ) : (
                <div className="mt-4">
                  <label className="text-sm font-medium text-slate-800" htmlFor="read-file-url">
                    文件 URL
                  </label>
                  <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-emerald-400 focus-within:bg-white focus-within:ring-3 focus-within:ring-emerald-100">
                    <Link2 className="size-4 shrink-0 text-slate-400" />
                    <input
                      id="read-file-url"
                      type="url"
                      value={url}
                      onChange={event => {
                        setUrl(event.target.value);
                        setError(null);
                      }}
                      placeholder="https://example.com/report.pdf"
                      className="min-w-0 flex-1 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
                    />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    API 会在服务端下载文件并按扩展名解析；URL 需要可被当前服务访问。
                  </p>
                </div>
              )}

              <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                <button
                  type="button"
                  disabled={!canSubmit || isLoading}
                  onClick={submit}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  开始解析
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="grid size-10 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-950"
                  aria-label="重置测试"
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
                  <dd className="font-mono text-xs text-slate-900">POST /api/read-file</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Content-Type</dt>
                  <dd className="text-right font-mono text-xs text-slate-900">
                    {mode === 'file' ? 'multipart/form-data' : 'application/json'}
                  </dd>
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
          </section>

          <section className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-4">
              {error ? (
                <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
                  <AlertCircle className="mt-0.5 size-5 shrink-0" />
                  <div>
                    <div className="text-sm font-semibold">解析失败</div>
                    <div className="mt-1 text-sm leading-5">{error}</div>
                  </div>
                </div>
              ) : result ? (
                <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
                  <div>
                    <div className="text-sm font-semibold">解析完成</div>
                    <div className="mt-1 text-sm leading-5">
                      已读取 {summarizeValue(result.filename)}，共 {summarizeValue(result.totalCharCount)} 字符。
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-600">
                  <FileJson className="mt-0.5 size-5 shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">等待测试</div>
                    <div className="mt-1 text-sm leading-5">
                      选择文件或输入 URL 后开始解析，响应会显示在这里。
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ['文件名', result?.filename],
                  ['文件类型', result?.fileType],
                  ['字符数', result?.totalCharCount],
                  ['行数', result?.totalLineCount],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-medium text-slate-500">{label}</div>
                    <div className="mt-1 truncate text-sm font-semibold text-slate-950">
                      {summarizeValue(value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
                {[
                  ['content', '内容'],
                  ['pages', `分页 ${pages.length || ''}`],
                  ['json', 'JSON'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setView(key as ResultView)}
                    className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                      view === key ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!rawJson}
                  onClick={copyJson}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  <Clipboard className="size-4" />
                  {copyState === 'copied' ? '已复制' : copyState === 'failed' ? '复制失败' : '复制 JSON'}
                </button>
                <button
                  type="button"
                  disabled={!rawJson}
                  onClick={downloadJson}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  <Download className="size-4" />
                  下载
                </button>
              </div>
            </div>

            <div className="min-h-[420px] p-4">
              {view === 'content' ? (
                <pre className="max-h-[58vh] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-4 font-mono text-sm leading-6 text-slate-100">
                  {result?.content || '解析后的聚合内容会显示在这里。'}
                </pre>
              ) : null}

              {view === 'pages' ? (
                <div className="grid max-h-[58vh] gap-3 overflow-auto pr-1">
                  {pages.length > 0 ? (
                    pages.map((page, index) => (
                      <article key={`${pageTitle(page, index)}-${index}`} className="rounded-lg border border-slate-200">
                        <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <h3 className="text-sm font-semibold text-slate-950">{pageTitle(page, index)}</h3>
                          <div className="text-xs text-slate-500">
                            {summarizeValue(page.charCount)} chars · {summarizeValue(page.lineCount)} lines
                          </div>
                        </div>
                        <pre className="max-h-64 overflow-auto whitespace-pre-wrap p-4 font-mono text-sm leading-6 text-slate-700">
                          {page.pageContent || 'No page content.'}
                        </pre>
                      </article>
                    ))
                  ) : (
                    <div className="grid min-h-72 place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                      暂无分页数据
                    </div>
                  )}
                </div>
              ) : null}

              {view === 'json' ? (
                <pre className="max-h-[58vh] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-4 font-mono text-sm leading-6 text-emerald-100">
                  {rawJson || '{\n  "message": "Raw JSON response will appear here."\n}'}
                </pre>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
