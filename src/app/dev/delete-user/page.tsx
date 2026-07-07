'use client';

import { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Code2,
  Loader2,
  RefreshCcw,
  Search,
  Trash2,
  UserX,
} from 'lucide-react';

import type { UserDeletionPreviewUser, UserRelatedCounts } from '@/database/models/user';

type LookupResult =
  | {
      found: false;
    }
  | {
      found: true;
      relatedCounts: UserRelatedCounts;
      user: UserDeletionPreviewUser;
    };

type DeleteResult =
  | {
      found: false;
    }
  | {
      deleted: {
        relatedCounts: UserRelatedCounts;
        user: UserDeletionPreviewUser;
      };
      found: true;
    };

type ApiSuccess =
  | {
      action: 'lookup';
      result: LookupResult;
      success: true;
    }
  | {
      action: 'delete';
      result: DeleteResult;
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

const relatedTableLabels: Array<{ key: keyof UserRelatedCounts; label: string }> = [
  { key: 'authSessions', label: 'auth_sessions' },
  { key: 'accounts', label: 'accounts' },
  { key: 'twoFactor', label: 'two_factor' },
  { key: 'passkeys', label: 'passkey' },
  { key: 'verifications', label: 'verifications' },
];

const formatDate = (value: Date | string) => {
  return new Date(value).toLocaleString();
};

const isLookupResult = (value: LookupResult | DeleteResult): value is LookupResult => {
  return 'relatedCounts' in value || ('found' in value && value.found === false);
};

export default function DeleteUserDevPage() {
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [preview, setPreview] = useState<LookupResult | null>(null);
  const [lastResult, setLastResult] = useState<ApiSuccess | null>(null);
  const [view, setView] = useState<'summary' | 'json'>('summary');
  const [isLoading, setIsLoading] = useState(false);
  const [runState, setRunState] = useState<RunState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canLookup = email.trim().includes('@');
  const canDelete =
    preview?.found === true && confirmEmail.trim() === email.trim() && confirmEmail.trim().includes('@');

  const rawJson = useMemo(() => {
    if (!lastResult) {
      return '';
    }

    return JSON.stringify(lastResult, null, 2);
  }, [lastResult]);

  const callApi = async (action: 'lookup' | 'delete') => {
    setIsLoading(true);
    setError(null);

    const startedAt = performance.now();
    const submittedAt = new Date().toLocaleString();

    try {
      const response = await fetch('/api/dev/delete-user', {
        body: JSON.stringify({
          action,
          confirmEmail: action === 'delete' ? confirmEmail.trim() : undefined,
          email: email.trim(),
        }),
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

      setLastResult(data);
      setView('summary');

      if (data.action === 'lookup') {
        setPreview(data.result);
        setConfirmEmail('');
        return;
      }

      setPreview(null);
      setEmail('');
      setConfirmEmail('');
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
    setEmail('');
    setConfirmEmail('');
    setPreview(null);
    setLastResult(null);
    setError(null);
    setRunState(null);
  };

  const previewCounts = preview?.found ? preview.relatedCounts : null;
  const previewUser = preview?.found ? preview.user : null;
  const deleteSummary =
    lastResult?.action === 'delete' && lastResult.result.found
      ? lastResult.result.deleted
      : null;

  return (
    <main className="h-screen overflow-y-auto bg-[#f5f7fb] text-slate-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-red-100 text-red-700">
              <UserX className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">删除用户</h1>
              <p className="text-sm text-slate-600">
                按邮箱查询用户并删除关联数据（仅开发环境，操作不可恢复）
              </p>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-700">用户邮箱</span>
              <input
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-red-200 focus:ring-2"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="user@example.com"
                type="email"
                value={email}
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canLookup || isLoading}
                onClick={() => callApi('lookup')}
                type="button"
              >
                {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                查询用户
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
                disabled={isLoading}
                onClick={reset}
                type="button"
              >
                <RefreshCcw className="size-4" />
                重置
              </button>
            </div>
          </div>
        </section>

        {preview && !preview.found ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 size-5 shrink-0" />
              <div>
                <p className="font-medium">未找到用户</p>
                <p className="mt-1 text-sm">邮箱 {email.trim()} 在数据库中不存在。</p>
              </div>
            </div>
          </section>
        ) : null}

        {previewUser && previewCounts ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">用户预览</h2>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Auth ID</dt>
                <dd className="font-mono text-xs">{previewUser.id}</dd>
              </div>
              <div>
                <dt className="text-slate-500">User ID</dt>
                <dd className="font-mono text-xs">{previewUser.userId}</dd>
              </div>
              <div>
                <dt className="text-slate-500">邮箱</dt>
                <dd>{previewUser.email ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">用户名</dt>
                <dd>{previewUser.username ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">角色</dt>
                <dd>{previewUser.role ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">邮箱已验证</dt>
                <dd>{previewUser.emailVerified ? '是' : '否'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">创建时间</dt>
                <dd>{formatDate(previewUser.createdAt)}</dd>
              </div>
            </dl>

            <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">关联表</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-600">行数</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {relatedTableLabels.map(({ key, label }) => (
                    <tr key={key}>
                      <td className="px-4 py-3 font-mono text-xs">{label}</td>
                      <td className="px-4 py-3 text-right">{previewCounts[key]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {previewUser ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-700" />
              <div className="flex w-full flex-col gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-red-900">危险操作</h2>
                  <p className="mt-1 text-sm text-red-800">
                    将删除用户及其关联数据。auth_sessions / accounts / two_factor / passkey 由数据库级联删除，
                    verifications 将手动清理。
                  </p>
                </div>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-red-900">再次输入邮箱以确认删除</span>
                  <input
                    className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm outline-none ring-red-300 focus:ring-2"
                    onChange={(event) => setConfirmEmail(event.target.value)}
                    placeholder={previewUser.email ?? 'user@example.com'}
                    type="email"
                    value={confirmEmail}
                  />
                </label>

                <button
                  className="inline-flex w-fit items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canDelete || isLoading}
                  onClick={() => callApi('delete')}
                  type="button"
                >
                  {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  删除用户及关联数据
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {deleteSummary ? (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
              <div>
                <p className="font-medium">删除成功</p>
                <p className="mt-1 text-sm">
                  已删除用户 {deleteSummary.user.email ?? deleteSummary.user.id}，关联数据已清理。
                </p>
              </div>
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-2">
              <Code2 className="size-4 text-slate-500" />
              <h2 className="font-semibold">响应</h2>
            </div>
            <div className="flex rounded-lg border border-slate-200 p-1 text-xs">
              <button
                className={`rounded-md px-3 py-1.5 ${view === 'summary' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
                onClick={() => setView('summary')}
                type="button"
              >
                摘要
              </button>
              <button
                className={`rounded-md px-3 py-1.5 ${view === 'json' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
                onClick={() => setView('json')}
                type="button"
              >
                JSON
              </button>
            </div>
          </div>

          <div className="p-5">
            {error ? (
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
                <AlertCircle className="mt-0.5 size-5 shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            ) : null}

            {!error && !lastResult ? (
              <p className="text-sm text-slate-500">执行查询或删除后，响应将显示在这里。</p>
            ) : null}

            {!error && lastResult && view === 'json' ? (
              <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{rawJson}</pre>
            ) : null}

            {!error && lastResult && view === 'summary' ? (
              <div className="space-y-3 text-sm">
                <p>
                  <span className="text-slate-500">Action:</span> {lastResult.action}
                </p>
                {runState ? (
                  <p>
                    <span className="text-slate-500">Status:</span> {runState.status} · {runState.durationMs}ms ·{' '}
                    {runState.submittedAt}
                  </p>
                ) : null}
                {lastResult.action === 'lookup' && isLookupResult(lastResult.result) && lastResult.result.found ? (
                  <p>
                    找到用户 {lastResult.result.user.email ?? lastResult.result.user.id}，关联记录共{' '}
                    {Object.values(lastResult.result.relatedCounts).reduce((sum, count) => sum + count, 0)} 条。
                  </p>
                ) : null}
                {lastResult.action === 'lookup' && isLookupResult(lastResult.result) && !lastResult.result.found ? (
                  <p>未找到匹配用户。</p>
                ) : null}
                {lastResult.action === 'delete' && lastResult.result.found ? (
                  <p>已删除用户 {lastResult.result.deleted.user.email ?? lastResult.result.deleted.user.id}。</p>
                ) : null}
                {lastResult.action === 'delete' && !lastResult.result.found ? <p>删除时未找到用户。</p> : null}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
