'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clipboard,
  Cloud,
  Code2,
  Download,
  File as FileIcon,
  FileJson,
  HardDrive,
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

// —— Types ——

type FileInfo = {
  Key: string;
  LastModified: string;
  Size: number;
};

type ApiOk<T = unknown> = {
  data: T;
  success: true;
};

type ApiErr = {
  error: string;
  success: false;
};

type ApiResult<T = unknown> = ApiOk<T> | ApiErr;

type ActionMode = 'upload' | 'list' | 'download' | 'delete' | 'rename';

type RunState = {
  durationMs: number;
  status: number;
  submittedAt: string;
};

type Toast = {
  id: number;
  message: string;
  type: 'success' | 'error';
};

// —— Helpers ——

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
};

const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr);
  return d.toLocaleString();
};

const actionOptions: Array<{
  description: string;
  icon: typeof Upload;
  label: string;
  value: ActionMode;
}> = [
  {
    description: '上传文件或文本内容到 S3 存储桶',
    icon: Upload,
    label: 'Upload',
    value: 'upload',
  },
  {
    description: '列出存储桶中的文件，支持按前缀过滤',
    icon: HardDrive,
    label: 'List',
    value: 'list',
  },
  {
    description: '生成预签名下载链接并预览文件',
    icon: Download,
    label: 'Download',
    value: 'download',
  },
  {
    description: '删除单个文件或批量删除',
    icon: Trash2,
    label: 'Delete',
    value: 'delete',
  },
  {
    description: '复制文件到新路径实现重命名',
    icon: Pencil,
    label: 'Rename',
    value: 'rename',
  },
];

// —— Component ——

export default function S3TestPage() {
  const [action, setAction] = useState<ActionMode>('list');
  const [view, setView] = useState<'results' | 'json'>('results');
  const [isLoading, setIsLoading] = useState(false);
  const [runState, setRunState] = useState<RunState | null>(null);
  const [payload, setPayload] = useState<ApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  // Upload form state
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadKey, setUploadKey] = useState('');
  const [textKey, setTextKey] = useState('');
  const [textContent, setTextContent] = useState('');
  const [contentType, setContentType] = useState('');

  // List form state
  const [listPrefix, setListPrefix] = useState('');

  // Download form state
  const [downloadKey, setDownloadKey] = useState('');
  const [expiresIn, setExpiresIn] = useState('7200');

  // Delete form state
  const [deleteKey, setDeleteKey] = useState('');

  // Rename form state
  const [renameOldKey, setRenameOldKey] = useState('');
  const [renameNewKey, setRenameNewKey] = useState('');

  // File list for display
  const [fileList, setFileList] = useState<FileInfo[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const toastIdRef = useRef(0);

  const addToast = (message: string, type: 'success' | 'error') => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  };

  const rawJson = payload ? JSON.stringify(payload, null, 2) : '';

  // Request body
  const requestBody = useMemo(() => {
    if (action === 'upload') {
      return {
        action: uploadFiles.length > 0 ? 'uploadFile' : 'uploadText',
        key: uploadFiles.length > 0 ? (uploadKey || uploadFiles[0]?.name || '') : textKey,
        ...(uploadFiles.length > 0 ? { files: uploadFiles.map((f) => f.name) } : { content: textContent?.substring(0, 100) }),
      };
    }
    if (action === 'list') return { action: 'list', prefix: listPrefix || undefined };
    if (action === 'download') return { action: 'downloadUrl', key: downloadKey, expiresIn: parseInt(expiresIn, 10) };
    if (action === 'delete') return { action: 'deleteOne', key: deleteKey };
    if (action === 'rename') return { action: 'rename', oldKey: renameOldKey, newKey: renameNewKey };
    return {};
  }, [action, uploadFiles, uploadKey, textKey, textContent, listPrefix, downloadKey, expiresIn, deleteKey, renameOldKey, renameNewKey]);

  const requestJson = JSON.stringify(requestBody, null, 2);

  const canSubmit = useMemo(() => {
    if (action === 'upload') return uploadFiles.length > 0 || (textKey.trim().length > 0 && textContent.length > 0);
    if (action === 'download') return downloadKey.trim().length > 0;
    if (action === 'delete') return deleteKey.trim().length > 0;
    if (action === 'rename') return renameOldKey.trim().length > 0 && renameNewKey.trim().length > 0;
    return true;
  }, [action, uploadFiles, textKey, textContent, downloadKey, deleteKey, renameOldKey, renameNewKey]);

  // Auto refresh list on mount
  useEffect(() => {
    const doFetch = async () => {
      try {
        const url = new URL('/api/s3-test', window.location.origin);
        url.searchParams.set('action', 'list');
        const res = await fetch(url.toString());
        const json = await res.json() as ApiResult<FileInfo[]>;
        if (json.success) setFileList(json.data);
      } catch { /* silent */ }
    };
    doFetch();
  }, []);

  const fetchList = async () => {
    try {
      const url = new URL('/api/s3-test', window.location.origin);
      url.searchParams.set('action', 'list');
      if (listPrefix) url.searchParams.set('prefix', listPrefix);

      const res = await fetch(url.toString());
      const json = await res.json() as ApiResult<FileInfo[]>;

      if (json.success) {
        setFileList(json.data);
      }
    } catch {
      // silent
    }
  };

  const selectAction = (nextAction: ActionMode) => {
    setAction(nextAction);
    setError(null);
    setPayload(null);
    setRunState(null);
  };

  const submit = async () => {
    if (!canSubmit) return;

    setIsLoading(true);
    setError(null);
    setPayload(null);

    const startedAt = performance.now();
    const submittedAt = new Date().toLocaleString();

    try {
      let response: Response;

      if (action === 'upload' && uploadFiles.length > 0) {
        // Multipart file upload
        const formData = new FormData();
        formData.append('file', uploadFiles[0]);
        if (uploadKey) formData.append('key', uploadKey);

        const url = new URL('/api/s3-test', window.location.origin);
        url.searchParams.set('action', 'uploadFile');

        response = await fetch(url.toString(), { method: 'POST', body: formData });
      } else {
        // JSON requests
        let method = 'GET';
        let body: BodyInit | undefined;
        const url = new URL('/api/s3-test', window.location.origin);

        if (action === 'upload') {
          method = 'POST';
          url.searchParams.set('action', textContent ? 'uploadText' : 'uploadBuffer');
          body = JSON.stringify({
            key: textKey,
            content: textContent,
            ...(contentType ? { contentType } : {}),
          });
        } else if (action === 'list') {
          url.searchParams.set('action', 'list');
          if (listPrefix) url.searchParams.set('prefix', listPrefix);
        } else if (action === 'download') {
          url.searchParams.set('action', 'downloadUrl');
          url.searchParams.set('key', downloadKey);
          url.searchParams.set('expiresIn', expiresIn);
        } else if (action === 'delete') {
          method = 'DELETE';
          url.searchParams.set('action', 'deleteOne');
          url.searchParams.set('key', deleteKey);
        } else if (action === 'rename') {
          method = 'PUT';
          url.searchParams.set('action', 'rename');
          body = JSON.stringify({ oldKey: renameOldKey, newKey: renameNewKey });
        }

        response = await fetch(url.toString(), {
          method,
          headers: body ? { 'Content-Type': 'application/json' } : undefined,
          body,
        });
      }

      const data = await response.json() as ApiResult;

      setRunState({
        durationMs: Math.round(performance.now() - startedAt),
        status: response.status,
        submittedAt,
      });

      if (!response.ok || !data.success) {
        setError('error' in data ? data.error : `Request failed with ${response.status}`);
        addToast('error' in data ? data.error : 'Request failed', 'error');
        return;
      }

      setPayload(data);
      setView('results');
      addToast('Request succeeded', 'success');

      // Auto refresh file list
      if (action === 'upload' || action === 'delete' || action === 'rename') {
        await fetchList();
        // Reset form
        if (action === 'upload') {
          setUploadFiles([]);
          setUploadKey('');
          setTextKey('');
          setTextContent('');
          setContentType('');
        }
        if (action === 'delete') setDeleteKey('');
        if (action === 'rename') {
          setRenameOldKey('');
          setRenameNewKey('');
        }
      }
      if (action === 'list') {
        const ok = data as ApiOk<FileInfo[]>;
        if (ok.data) setFileList(ok.data);
      }
    } catch (requestError) {
      setRunState({
        durationMs: Math.round(performance.now() - startedAt),
        status: 0,
        submittedAt,
      });
      const msg = requestError instanceof Error ? requestError.message : 'Request failed';
      setError(msg);
      addToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setAction('list');
    setUploadFiles([]);
    setUploadKey('');
    setTextKey('');
    setTextContent('');
    setContentType('');
    setListPrefix('');
    setDownloadKey('');
    setExpiresIn('7200');
    setDeleteKey('');
    setRenameOldKey('');
    setRenameNewKey('');
    setPayload(null);
    setError(null);
    setRunState(null);
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setUploadFiles(files);
    if (files.length > 0 && !uploadKey) {
      setUploadKey(files[0].name);
    }
  };

  const removeFile = (index: number) => {
    setUploadFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const deleteSingleFile = async (key: string) => {
    const url = new URL('/api/s3-test', window.location.origin);
    url.searchParams.set('action', 'deleteOne');
    url.searchParams.set('key', key);

    try {
      const res = await fetch(url.toString(), { method: 'DELETE' });
      const json = await res.json() as ApiResult;
      if (json.success) {
        addToast(`Deleted: ${key}`, 'success');
        await fetchList();
      } else {
        addToast('error' in json ? json.error : 'Delete failed', 'error');
      }
    } catch {
      addToast('Delete failed', 'error');
    }
  };

  const downloadFile = async (key: string) => {
    const url = new URL('/api/s3-test', window.location.origin);
    url.searchParams.set('action', 'downloadUrl');
    url.searchParams.set('key', key);

    try {
      const res = await fetch(url.toString());
      const json = await res.json() as ApiResult<{ downloadUrl: string }>;
      if (json.success) {
        window.open(json.data.downloadUrl, '_blank');
      } else {
        addToast('error' in json ? json.error : 'Download failed', 'error');
      }
    } catch {
      addToast('Download failed', 'error');
    }
  };

  // —— Render ——

  return (
    <main className="h-screen overflow-y-auto bg-[#f5f7fb] text-slate-950">
      {/* Toast container */}
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg animate-in slide-in-from-right ${
              toast.type === 'success'
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border border-red-200 bg-red-50 text-red-800'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="size-4 shrink-0" />
            ) : (
              <AlertCircle className="size-4 shrink-0" />
            )}
            {toast.message}
          </div>
        ))}
      </div>

      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-sm font-medium text-violet-700 ring-1 ring-violet-200">
              <Cloud className="size-4" />
              S3 FileS3 API Tester
            </div>
            <h1 className="text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
              FileS3 功能测试台
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              验证 FileS3 的上传、下载、列表、删除和重命名功能，查看请求体、状态与原始 JSON 响应。
            </p>
          </div>

          <div className="grid grid-cols-5 gap-1 rounded-lg bg-white p-1 shadow-sm ring-1 ring-slate-200">
            {actionOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => selectAction(option.value)}
                  title={option.description}
                  className={`inline-flex min-w-0 items-center justify-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium transition ${
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

        {/* Main grid */}
        <div className="grid flex-1 gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
          {/* Left: Form */}
          <section className="flex flex-col gap-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3 rounded-lg border border-violet-200 bg-violet-50 p-3 text-violet-900">
                {(() => {
                  const opt = actionOptions.find((o) => o.value === action);
                  const Icon = opt?.icon ?? Cloud;
                  return <Icon className="mt-0.5 size-5 shrink-0" />;
                })()}
                <div>
                  <div className="text-sm font-semibold">
                    {actionOptions.find((o) => o.value === action)?.label}
                  </div>
                  <div className="mt-1 text-sm leading-5">
                    {actionOptions.find((o) => o.value === action)?.description}
                  </div>
                </div>
              </div>

              {/* Upload form */}
              {action === 'upload' && (
                <div className="mt-4 grid gap-4">
                  {/* File picker */}
                  <div>
                    <label className="text-sm font-medium text-slate-800">选择文件</label>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const files = Array.from(e.dataTransfer.files);
                        setUploadFiles((prev) => [...prev, ...files]);
                        if (files.length > 0 && !uploadKey) setUploadKey(files[0].name);
                      }}
                      className="mt-2 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-6 transition hover:border-violet-400 hover:bg-violet-50/50"
                    >
                      <Upload className="size-8 text-slate-400" />
                      <span className="text-sm text-slate-500">拖放文件到此处或点击选择</span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                    </div>
                    {uploadFiles.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {uploadFiles.map((f, i) => (
                          <li key={i} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-1.5 text-sm">
                            <span className="truncate text-slate-700">{f.name}</span>
                            <span className="ml-2 shrink-0 text-xs text-slate-400">{formatSize(f.size)}</span>
                            <button
                              type="button"
                              onClick={() => removeFile(i)}
                              className="ml-2 text-slate-400 hover:text-red-500"
                            >
                              <X className="size-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-800" htmlFor="upload-key">
                      上传路径 (Key)
                    </label>
                    <input
                      id="upload-key"
                      value={uploadKey}
                      onChange={(e) => setUploadKey(e.target.value)}
                      placeholder="folder/file.txt"
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-3 focus:ring-violet-100"
                    />
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <span className="text-xs font-medium text-slate-500">或上传文本内容</span>
                    <div className="mt-2">
                      <input
                        value={textKey}
                        onChange={(e) => setTextKey(e.target.value)}
                        placeholder="文本文件 Key（如 data.json）"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-3 focus:ring-violet-100"
                      />
                    </div>
                    <div className="mt-2">
                      <textarea
                        value={textContent}
                        onChange={(e) => setTextContent(e.target.value)}
                        rows={4}
                        placeholder="输入文本内容..."
                        className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-3 focus:ring-violet-100"
                      />
                    </div>
                    <div className="mt-2">
                      <input
                        value={contentType}
                        onChange={(e) => setContentType(e.target.value)}
                        placeholder="Content-Type（可选，如 application/json）"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-3 focus:ring-violet-100"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* List form */}
              {action === 'list' && (
                <div className="mt-4">
                  <label className="text-sm font-medium text-slate-800" htmlFor="list-prefix">
                    前缀过滤 (Prefix)
                  </label>
                  <input
                    id="list-prefix"
                    value={listPrefix}
                    onChange={(e) => setListPrefix(e.target.value)}
                    placeholder="folder/ 或留空列出全部"
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-3 focus:ring-violet-100"
                  />
                </div>
              )}

              {/* Download form */}
              {action === 'download' && (
                <div className="mt-4 grid gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-800" htmlFor="download-key">
                      文件 Key
                    </label>
                    <input
                      id="download-key"
                      value={downloadKey}
                      onChange={(e) => setDownloadKey(e.target.value)}
                      placeholder="folder/file.txt"
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-3 focus:ring-violet-100"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-800" htmlFor="expires-in">
                      链接有效期 (秒)
                    </label>
                    <input
                      id="expires-in"
                      value={expiresIn}
                      onChange={(e) => setExpiresIn(e.target.value)}
                      placeholder="7200"
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-3 focus:ring-violet-100"
                    />
                  </div>
                </div>
              )}

              {/* Delete form */}
              {action === 'delete' && (
                <div className="mt-4 grid gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-800" htmlFor="delete-key">
                      文件 Key
                    </label>
                    <input
                      id="delete-key"
                      value={deleteKey}
                      onChange={(e) => setDeleteKey(e.target.value)}
                      placeholder="folder/file.txt"
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-3 focus:ring-violet-100"
                    />
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <div className="flex items-start gap-2 text-amber-800">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      <span className="text-sm">删除操作不可逆，请谨慎操作。</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Rename form */}
              {action === 'rename' && (
                <div className="mt-4 grid gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-800" htmlFor="rename-old">
                      原 Key
                    </label>
                    <input
                      id="rename-old"
                      value={renameOldKey}
                      onChange={(e) => setRenameOldKey(e.target.value)}
                      placeholder="old/path/file.txt"
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-3 focus:ring-violet-100"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-800" htmlFor="rename-new">
                      新 Key
                    </label>
                    <input
                      id="rename-new"
                      value={renameNewKey}
                      onChange={(e) => setRenameNewKey(e.target.value)}
                      placeholder="new/path/file.txt"
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-3 focus:ring-violet-100"
                    />
                  </div>
                </div>
              )}

              {/* Submit & Reset */}
              <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                <button
                  type="button"
                  disabled={!canSubmit || isLoading}
                  onClick={submit}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  发送请求
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="grid size-10 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-950"
                  aria-label="重置"
                  title="重置"
                >
                  <RefreshCcw className="size-4" />
                </button>
              </div>
            </div>

            {/* Request Info */}
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-950">请求详情</h2>
              <dl className="mt-3 grid gap-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Endpoint</dt>
                  <dd className="font-mono text-xs text-slate-900">/api/s3-test</dd>
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

            {/* Request Body */}
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

          {/* Right: Results + File List */}
          <section className="flex min-w-0 flex-col gap-6">
            {/* Response Panel */}
            <div className="flex min-w-0 flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
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
                      <div className="mt-1 text-sm leading-5">{action} 操作成功。</div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-600">
                    <FileJson className="mt-0.5 size-5 shrink-0" />
                    <div>
                      <div className="text-sm font-semibold text-slate-900">等待请求</div>
                      <div className="mt-1 text-sm leading-5">选择操作并填写参数后发送请求，响应会显示在这里。</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                  {(['results', 'json'] as const).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setView(key)}
                      className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                        view === key
                          ? 'bg-white text-slate-950 shadow-sm'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      {key === 'json' ? <Code2 className="size-4" /> : <FileJson className="size-4" />}
                      {key === 'json' ? 'JSON' : '结果'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {view === 'json' ? (
                  <pre className="h-full overflow-auto rounded-lg bg-slate-950 p-4 font-mono text-xs leading-5 text-slate-100">
                    {rawJson || '// Response JSON will appear here'}
                  </pre>
                ) : payload ? (
                  <ResponseView action={action} payload={payload} />
                ) : (
                  <div className="grid min-h-80 place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                    <div>
                      <Cloud className="mx-auto size-8 text-slate-400" />
                      <div className="mt-3 text-sm font-semibold text-slate-950">暂无响应数据</div>
                      <div className="mt-1 text-sm text-slate-500">发送请求后响应内容将显示在这里。</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* File List Panel */}
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 p-4">
                <h2 className="text-sm font-semibold text-slate-950">
                  存储桶文件列表
                  {fileList.length > 0 && (
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                      {fileList.length}
                    </span>
                  )}
                </h2>
                <button
                  type="button"
                  onClick={fetchList}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
                >
                  <RefreshCcw className="size-3.5" />
                  刷新
                </button>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {fileList.length === 0 ? (
                  <div className="grid place-items-center p-12 text-center">
                    <div>
                      <HardDrive className="mx-auto size-8 text-slate-400" />
                      <div className="mt-3 text-sm font-semibold text-slate-950">暂无文件</div>
                      <div className="mt-1 text-sm text-slate-500">上传文件后列表将显示在这里。</div>
                    </div>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-100 bg-slate-50">
                      <tr>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Key</th>
                        <th className="hidden px-4 py-2.5 text-left text-xs font-semibold text-slate-500 sm:table-cell">大小</th>
                        <th className="hidden px-4 py-2.5 text-left text-xs font-semibold text-slate-500 lg:table-cell">修改时间</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {fileList.map((file) => (
                        <tr key={file.Key} className="transition hover:bg-slate-50">
                          <td className="max-w-[200px] truncate px-4 py-2.5 font-mono text-xs text-slate-900">
                            {file.Key}
                          </td>
                          <td className="hidden whitespace-nowrap px-4 py-2.5 text-xs text-slate-500 sm:table-cell">
                            {formatSize(file.Size)}
                          </td>
                          <td className="hidden whitespace-nowrap px-4 py-2.5 text-xs text-slate-500 lg:table-cell">
                            {formatDate(file.LastModified)}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => downloadFile(file.Key)}
                                title="下载"
                                className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-violet-600"
                              >
                                <Download className="size-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(file.Key);
                                  addToast('Key 已复制', 'success');
                                }}
                                title="复制 Key"
                                className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                              >
                                <Clipboard className="size-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setAction('rename');
                                  setRenameOldKey(file.Key);
                                }}
                                title="重命名"
                                className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-amber-600"
                              >
                                <Pencil className="size-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteSingleFile(file.Key)}
                                title="删除"
                                className="rounded p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

// —— Response View Components ——

function ResponseView({ action, payload }: { action: ActionMode; payload: ApiResult }) {
  if (!payload.success) return null;

  switch (action) {
    case 'upload':
      return <UploadResult data={payload.data as UploadResultData} />;
    case 'list':
      return <ListResult data={payload.data as FileInfo[]} />;
    case 'download':
      return <DownloadResult data={payload.data as DownloadResultData} />;
    case 'delete':
      return <DeleteResult data={payload.data as DeleteResultData} />;
    case 'rename':
      return <RenameResult data={payload.data as RenameResultData} />;
    default:
      return null;
  }
}

type UploadResultData = { key: string; size: number; contentType?: string };
type DownloadResultData = { key: string; downloadUrl: string; expiresIn: number };
type DeleteResultData = { key: string; deleted: boolean } | { keys: string[]; deleted: boolean };
type RenameResultData = { oldKey: string; newKey: string; renamed: boolean };

function UploadResult({ data }: { data: UploadResultData }) {
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <CheckCircle2 className="size-5 text-emerald-600" />
        <div>
          <div className="text-sm font-semibold text-emerald-900">上传成功</div>
          <div className="mt-1 font-mono text-xs text-emerald-700">{data.key}</div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-medium text-slate-500">Key</div>
          <div className="mt-1 truncate font-mono text-sm text-slate-950">{data.key}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-medium text-slate-500">Size</div>
          <div className="mt-1 text-sm font-semibold text-slate-950">{formatSize(data.size)}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-medium text-slate-500">Content-Type</div>
          <div className="mt-1 truncate text-sm text-slate-950">{data.contentType || 'N/A'}</div>
        </div>
      </div>
    </div>
  );
}

function ListResult({ data }: { data: FileInfo[] }) {
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <FileIcon className="size-4" />
        共 {data.length} 个文件
      </div>
      {data.length === 0 ? (
        <div className="grid min-h-40 place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <div>
            <HardDrive className="mx-auto size-8 text-slate-400" />
            <div className="mt-3 text-sm font-semibold text-slate-950">没有匹配的文件</div>
          </div>
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Key</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Size</th>
                <th className="hidden px-3 py-2 text-left text-xs font-semibold text-slate-500 sm:table-cell">Last Modified</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((file) => (
                <tr key={file.Key}>
                  <td className="max-w-[300px] truncate px-3 py-2 font-mono text-xs text-slate-900">{file.Key}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">{formatSize(file.Size)}</td>
                  <td className="hidden whitespace-nowrap px-3 py-2 text-xs text-slate-500 sm:table-cell">
                    {formatDate(file.LastModified)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DownloadResult({ data }: { data: DownloadResultData }) {
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <CheckCircle2 className="size-5 text-emerald-600" />
        <div>
          <div className="text-sm font-semibold text-emerald-900">预签名链接已生成</div>
          <div className="mt-1 text-xs text-emerald-700">有效期 {data.expiresIn} 秒</div>
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="text-xs font-medium text-slate-500 mb-2">下载链接</div>
        <div className="break-all font-mono text-xs text-slate-700">{data.downloadUrl}</div>
        <a
          href={data.downloadUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-slate-950 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800"
        >
          <Download className="size-3.5" />
          在新标签页打开
        </a>
      </div>
    </div>
  );
}

function DeleteResult({ data }: { data: DeleteResultData }) {
  if ('keys' in data) {
    return (
      <div className="grid gap-3">
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <CheckCircle2 className="size-5 text-emerald-600" />
          <div>
            <div className="text-sm font-semibold text-emerald-900">批量删除成功</div>
            <div className="mt-1 text-xs text-emerald-700">{data.keys.length} 个文件已删除</div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
      <CheckCircle2 className="size-5 text-emerald-600" />
      <div>
        <div className="text-sm font-semibold text-emerald-900">删除成功</div>
        <div className="mt-1 font-mono text-xs text-emerald-700">{data.key}</div>
      </div>
    </div>
  );
}

function RenameResult({ data }: { data: RenameResultData }) {
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <CheckCircle2 className="size-5 text-emerald-600" />
        <div>
          <div className="text-sm font-semibold text-emerald-900">重命名成功</div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-medium text-slate-500">原 Key</div>
          <div className="mt-1 truncate font-mono text-sm text-slate-950">{data.oldKey}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-medium text-slate-500">新 Key</div>
          <div className="mt-1 truncate font-mono text-sm text-slate-950">{data.newKey}</div>
        </div>
      </div>
    </div>
  );
}
