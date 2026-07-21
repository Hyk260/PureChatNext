'use client';

import { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clipboard,
  Code2,
  Compass,
  FileJson,
  Globe2,
  Loader2,
  RefreshCcw,
  Search,
  Sparkles,
} from 'lucide-react';

import { type CrawlUniformResult, type UniformSearchResponse } from '@pure/types';

type ActionMode = 'query' | 'webSearch' | 'crawlPages';
type ResultView = 'summary' | 'json';

type SearchResponse = UniformSearchResponse;

type CrawlResponse = {
  results: CrawlUniformResult[];
};

type ApiSuccess = {
  action: ActionMode;
  result: SearchResponse | CrawlResponse;
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
  crawlPages: {
    impls: 'naive,jina',
    urls: 'https://example.com\nhttps://nextjs.org',
  },
  query: 'Next.js 16 App Router',
  webSearch: 'PureChatNext web search',
};

const actionOptions: Array<{
  description: string;
  icon: typeof Search;
  label: string;
  value: ActionMode;
}> = [
  {
    description: '调用第一个 provider 的 query 方法',
    icon: Search,
    label: 'Query',
    value: 'query',
  },
  {
    description: '验证聚合搜索、降级重试和 provider fallback',
    icon: Globe2,
    label: 'Web Search',
    value: 'webSearch',
  },
  {
    description: '批量抓取 URL 内容并查看 crawler 输出',
    icon: Compass,
    label: 'Crawl Pages',
    value: 'crawlPages',
  },
];

const parseList = (value: string) => {
  return value
    .split(/[\n,，]/)
    .map(item => item.trim())
    .filter(Boolean);
};

const formatNumber = (value: number | undefined) => {
  return typeof value === 'number' ? value.toLocaleString() : 'N/A';
};

const isSearchResponse = (value: SearchResponse | CrawlResponse | null): value is SearchResponse => {
  return Boolean(value && 'resultNumbers' in value && 'query' in value);
};

const isCrawlResponse = (value: SearchResponse | CrawlResponse | null): value is CrawlResponse => {
  return Boolean(value && 'results' in value && !('query' in value));
};

const buildRequestBody = (
  action: ActionMode,
  values: {
    categories: string;
    engines: string;
    impls: string;
    query: string;
    timeRange: string;
    urls: string;
  },
) => {
  if (action === 'crawlPages') {
    const impls = parseList(values.impls);

    return {
      action,
      ...(impls.length > 0 ? { impls } : {}),
      urls: parseList(values.urls),
    };
  }

  const searchCategories = parseList(values.categories);
  const searchEngines = parseList(values.engines);
  const searchTimeRange = values.timeRange.trim();

  if (action === 'query') {
    return {
      action,
      params: {
        ...(searchCategories.length > 0 ? { searchCategories } : {}),
        ...(searchEngines.length > 0 ? { searchEngines } : {}),
        ...(searchTimeRange ? { searchTimeRange } : {}),
      },
      query: values.query.trim(),
    };
  }

  return {
    action,
    ...(searchCategories.length > 0 ? { searchCategories } : {}),
    ...(searchEngines.length > 0 ? { searchEngines } : {}),
    ...(searchTimeRange ? { searchTimeRange } : {}),
    query: values.query.trim(),
  };
};

export default function WebSearchTestPage() {
  const [action, setAction] = useState<ActionMode>('webSearch');
  const [view, setView] = useState<ResultView>('summary');
  const [query, setQuery] = useState(examples.webSearch);
  const [categories, setCategories] = useState('general');
  const [engines, setEngines] = useState('');
  const [timeRange, setTimeRange] = useState('');
  const [urls, setUrls] = useState(examples.crawlPages.urls);
  const [impls, setImpls] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [runState, setRunState] = useState<RunState | null>(null);
  const [payload, setPayload] = useState<ApiSuccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const requestBody = useMemo(
    () => buildRequestBody(action, { categories, engines, impls, query, timeRange, urls }),
    [action, categories, engines, impls, query, timeRange, urls],
  );

  const result = payload?.result ?? null;
  const rawJson = payload ? JSON.stringify(payload, null, 2) : '';
  const requestJson = JSON.stringify(requestBody, null, 2);
  const searchResult = isSearchResponse(result) ? result : null;
  const crawlResult = isCrawlResponse(result) ? result : null;
  const canSubmit = action === 'crawlPages' ? parseList(urls).length > 0 : query.trim().length > 0;

  const selectAction = (nextAction: ActionMode) => {
    setAction(nextAction);
    setError(null);
    setPayload(null);
    setRunState(null);
    setCopyState('idle');

    if (nextAction === 'query') {
      setQuery(examples.query);
    }

    if (nextAction === 'webSearch') {
      setQuery(examples.webSearch);
    }
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
      const response = await fetch('/api/dev/web-search', {
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
    setAction('webSearch');
    setQuery(examples.webSearch);
    setCategories('general');
    setEngines('');
    setTimeRange('');
    setUrls(examples.crawlPages.urls);
    setImpls('');
    setPayload(null);
    setError(null);
    setRunState(null);
    setCopyState('idle');
  };

  const copyJson = async () => {
    const text = view === 'json' && rawJson ? rawJson : requestJson;

    try {
      await navigator.clipboard.writeText(text);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1600);
    } catch {
      setCopyState('failed');
    }
  };

  return (
    <main className="h-screen overflow-y-auto bg-[#f5f7fb] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-sm font-medium text-cyan-700 ring-1 ring-cyan-200">
              <Sparkles className="size-4" />
              web-search API tester
            </div>
            <h1 className="text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
              联网搜索功能测试台
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              验证 SearchService 的 query、webSearch 和 crawlPages 三条路径，查看请求体、状态、摘要和原始响应。
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-lg bg-white p-1 shadow-sm ring-1 ring-slate-200">
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

        <div className="grid flex-1 gap-6 lg:grid-cols-[410px_minmax(0,1fr)]">
          <section className="flex flex-col gap-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3 rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-cyan-900">
                <Globe2 className="mt-0.5 size-5 shrink-0" />
                <div>
                  <div className="text-sm font-semibold">
                    {actionOptions.find(option => option.value === action)?.label}
                  </div>
                  <div className="mt-1 text-sm leading-5">
                    {actionOptions.find(option => option.value === action)?.description}
                  </div>
                </div>
              </div>

              {action === 'crawlPages' ? (
                <div className="mt-4 grid gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-800" htmlFor="web-search-urls">
                      URL 列表 · URLs
                    </label>
                    <textarea
                      id="web-search-urls"
                      value={urls}
                      onChange={event => {
                        setUrls(event.target.value);
                        setError(null);
                      }}
                      rows={6}
                      placeholder="https://example.com"
                      className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:ring-3 focus:ring-cyan-100"
                    />
                    <p className="mt-2 text-xs leading-5 text-slate-500">每行或逗号分隔一个 URL。</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-800" htmlFor="web-search-impls">
                      抓取实现 · Crawler impls
                    </label>
                    <input
                      id="web-search-impls"
                      value={impls}
                      onChange={event => setImpls(event.target.value)}
                      placeholder="naive,jina,browserless,search1api"
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:ring-3 focus:ring-cyan-100"
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-4 grid gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-800" htmlFor="web-search-query">
                      搜索关键词 · Query
                    </label>
                    <textarea
                      id="web-search-query"
                      value={query}
                      onChange={event => {
                        setQuery(event.target.value);
                        setError(null);
                      }}
                      rows={3}
                      placeholder="输入搜索关键词"
                      className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:ring-3 focus:ring-cyan-100"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-slate-800" htmlFor="web-search-categories">
                        分类 · Categories
                      </label>
                      <select
                        id="web-search-categories"
                        value={categories}
                        onChange={event => setCategories(event.target.value)}
                        className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-3 focus:ring-cyan-100"
                      >
                        <option value="general">通用 · general</option>
                        <option value="news">新闻 · news</option>
                        <option value="images">图片 · images</option>
                        <option value="videos">视频 · videos</option>
                        <option value="science">科学 · science</option>
                        <option value="files">文件 · files</option>
                        <option value="music">音乐 · music</option>
                        <option value="social media">社交媒体 · social media</option>
                        <option value="map">地图 · map</option>
                        <option value="it">IT · it</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-800" htmlFor="web-search-engines">
                        搜索引擎 · Engines
                      </label>
                      <select
                        id="web-search-engines"
                        value={engines}
                        onChange={event => setEngines(event.target.value)}
                        className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-3 focus:ring-cyan-100"
                      >
                        <option value="">全部 · All</option>
                        <option value="google">Google</option>
                        <option value="bing">Bing</option>
                        <option value="duckduckgo">DuckDuckGo</option>
                        <option value="yahoo">Yahoo</option>
                        <option value="youtube">YouTube</option>
                        <option value="x">X (Twitter)</option>
                        <option value="reddit">Reddit</option>
                        <option value="github">GitHub</option>
                        <option value="arxiv">arXiv</option>
                        <option value="wechat">微信 · WeChat</option>
                        <option value="bilibili">Bilibili</option>
                        <option value="imdb">IMDb</option>
                        <option value="wikipedia">Wikipedia</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-800" htmlFor="web-search-time-range">
                      时间范围 · Time range
                    </label>
                    <select
                      id="web-search-time-range"
                      value={timeRange}
                      onChange={event => setTimeRange(event.target.value)}
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-3 focus:ring-cyan-100"
                    >
                      <option value="">不限 · anytime</option>
                      <option value="day">一天 · day</option>
                      <option value="week">一周 · week</option>
                      <option value="month">一月 · month</option>
                      <option value="year">一年 · year</option>
                    </select>
                  </div>
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
                  <dd className="font-mono text-xs text-slate-900">POST /api/dev/web-search</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Action</dt>
                  <dd className="font-mono text-xs text-slate-900">{action}</dd>
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
                  ['结果数', searchResult ? searchResult.resultNumbers : crawlResult?.results.length],
                  ['Provider 耗时', searchResult ? `${formatNumber(searchResult.costTime)} ms` : undefined],
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
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
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
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {view === 'json' ? (
                <pre className="h-full overflow-auto rounded-lg bg-slate-950 p-4 font-mono text-xs leading-5 text-slate-100">
                  {rawJson || '// Response JSON will appear here'}
                </pre>
              ) : searchResult ? (
                <div className="grid gap-3">
                  {searchResult.errorDetail ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      {searchResult.errorDetail}
                    </div>
                  ) : null}

                  {searchResult.results.length > 0 ? (
                    searchResult.results.map((item, index) => (
                      <article key={`${item.url}-${index}`} className="rounded-lg border border-slate-200 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-base font-semibold text-slate-950 hover:text-cyan-700"
                            >
                              {item.title || item.url}
                            </a>
                            <div className="mt-1 truncate font-mono text-xs text-cyan-700">{item.url}</div>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-1.5">
                            {item.category ? (
                              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                                {item.category}
                              </span>
                            ) : null}
                            <span className="rounded-md bg-cyan-50 px-2 py-1 text-xs font-medium text-cyan-700">
                              score {formatNumber(item.score)}
                            </span>
                          </div>
                        </div>
                        <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{item.content}</p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {item.engines.map(engine => (
                            <span
                              key={engine}
                              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-500"
                            >
                              {engine}
                            </span>
                          ))}
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="grid min-h-80 place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                      <div>
                        <Search className="mx-auto size-8 text-slate-400" />
                        <div className="mt-3 text-sm font-semibold text-slate-950">没有搜索结果</div>
                        <div className="mt-1 text-sm text-slate-500">尝试调整 provider、engine 或关键词。</div>
                      </div>
                    </div>
                  )}
                </div>
              ) : crawlResult ? (
                <div className="grid gap-3">
                  {crawlResult.results.map((item, index) => {
                    const errorType = 'errorType' in item.data ? item.data.errorType : undefined;
                    const errorMessage =
                      'errorMessage' in item.data ? item.data.errorMessage : undefined;
                    const isError = Boolean(errorType || errorMessage);
                    const title = 'title' in item.data ? item.data.title : undefined;
                    const contentType =
                      'contentType' in item.data ? item.data.contentType : undefined;

                    return (
                      <article key={`${item.originalUrl}-${index}`} className="rounded-lg border border-slate-200 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <a
                              href={item.originalUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-base font-semibold text-slate-950 hover:text-cyan-700"
                            >
                              {title || item.originalUrl}
                            </a>
                            <div className="mt-1 truncate font-mono text-xs text-cyan-700">{item.originalUrl}</div>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-1.5">
                            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                              {item.crawler}
                            </span>
                            <span
                              className={`rounded-md px-2 py-1 text-xs font-medium ${
                                isError ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              {isError ? errorType || 'error' : contentType || 'ok'}
                            </span>
                          </div>
                        </div>
                        <p className="mt-3 line-clamp-5 text-sm leading-6 text-slate-600">
                          {errorMessage || item.data.content || 'No content returned'}
                        </p>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="grid min-h-96 place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <div>
                    <Globe2 className="mx-auto size-10 text-slate-400" />
                    <div className="mt-3 text-sm font-semibold text-slate-950">还没有响应</div>
                    <div className="mt-1 text-sm text-slate-500">发送请求后会展示标准化结果。</div>
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
