'use client';

import { useState } from 'react';
import { login, register, logout, getCurrentUser } from '@/lib/utils/api-client';

export default function TestAuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [user, setUser] = useState(null);

  const handleLogin = async () => {
    setLoading(true);
    setMessage('');
    try {
      const data = await login(email, password);
      // setMessage(`登录成功！用户: ${data.user.email}`);
      // setUser(data.user);
    } catch (error) {
      // setMessage(`登录失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setLoading(true);
    setMessage('');
    try {
      const data = await register(email, password);
      // setMessage(`注册成功！用户: ${data.user.email}`);
      // setUser(data.user);
    } catch (error) {
      // setMessage(`注册失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    setMessage('');
    try {
      await logout();
      setMessage('登出成功！');
      setUser(null);
    } catch (error) {
      // setMessage(`登出失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGetUser = async () => {
    setLoading(true);
    setMessage('');
    try {
      const data = await getCurrentUser();
      setMessage(`获取用户信息成功！`);
      setUser(data.user);
    } catch (error) {
      setMessage(`获取用户信息失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-8 dark:bg-black">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg dark:bg-zinc-900">
        <h1 className="mb-6 text-2xl font-bold text-black dark:text-zinc-50">
          认证测试页面
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

        {user && (
          <div className="mb-4 rounded-lg bg-blue-50 p-3 dark:bg-blue-900">
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
              当前用户:
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              ID: {user.id}
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              邮箱: {user.email}
            </p>
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
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-black focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            placeholder="password"
          />
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-zinc-400"
          >
            {loading ? '处理中...' : '登录'}
          </button>

          <button
            onClick={handleRegister}
            disabled={loading}
            className="w-full rounded-lg bg-green-600 px-4 py-2 font-medium text-white transition-colors hover:bg-green-700 disabled:bg-zinc-400"
          >
            {loading ? '处理中...' : '注册'}
          </button>

          <button
            onClick={handleGetUser}
            disabled={loading}
            className="w-full rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-700 disabled:bg-zinc-400"
          >
            {loading ? '处理中...' : '获取当前用户'}
          </button>

          <button
            onClick={handleLogout}
            disabled={loading}
            className="w-full rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition-colors hover:bg-red-700 disabled:bg-zinc-400"
          >
            {loading ? '处理中...' : '登出'}
          </button>
        </div>

        <div className="mt-6 rounded-lg bg-zinc-100 p-4 dark:bg-zinc-800">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            💡 提示：首次使用前请确保：
          </p>
          <ul className="mt-2 list-disc pl-5 text-xs text-zinc-600 dark:text-zinc-400">
            <li>已创建 .env.local 文件</li>
            <li>已配置 Supabase 项目信息</li>
            <li>已在 Supabase 中启用 Email 认证</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

