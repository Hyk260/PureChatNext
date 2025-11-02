'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/utils/api-client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();

  const handleLogin = async () => {
    setLoading(true);
    setMessage('');
    try {
      const data = await login(email, password);
      setMessage(`登录成功！用户: ${data.user}`);
      // 登录成功后可以重定向到首页或其他页面
      setTimeout(() => {
        router.push('/');
      }, 1000);
    } catch (error) {
      // setMessage(`登录失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-8 dark:bg-black">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg dark:bg-zinc-900">
        <h1 className="mb-6 text-2xl font-bold text-black dark:text-zinc-50">
          登录
        </h1>

        {message && (
          <div
            className={`mb-4 rounded-lg p-3 ${
              message.includes('失败') || message.includes('错误')
                ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200'
                : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
            }`}
          >
            {message}
          </div>
        )}

        <div className="mb-4">
          <label
            htmlFor="email"
            className="mb-2 block text-sm font-medium text-black dark:text-zinc-50"
          >
            邮箱
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleLogin();
              }
            }}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-black focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            placeholder="user@example.com"
          />
        </div>

        <div className="mb-6">
          <label
            htmlFor="password"
            className="mb-2 block text-sm font-medium text-black dark:text-zinc-50"
          >
            密码
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleLogin();
              }
            }}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-black focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            placeholder="password"
          />
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-zinc-400"
        >
          {loading ? '登录中...' : '登录'}
        </button>
      </div>
    </div>
  );
}

