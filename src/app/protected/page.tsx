"use client";

import { useEffect, useState } from "react";
import { me, logout } from "@/libs/utils/api-client";
import { useRouter } from "next/navigation";

interface UserData {
  id: string;
  username: string | null;
  userId: string;
  email: string | null;
  avatar: string | null;
  phone: string | null;
  role: string | null;
  accessedAt: string;
  createdAt: string;
  updatedAt: string;
}

interface MeResponse {
  message: string;
  code: number;
  data: UserData;
}

export default function ProtectedPage() {
  const [data, setData] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    me()
      .then((res) => {
        if (!res) {
          router.replace("/login");
          return;
        }
        setData(res as unknown as MeResponse);
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-400" />
          <p className="text-sm text-zinc-500">加载中...</p>
        </div>
      </div>
    );
  }

  const user = data?.data;
  if (!user) return null;

  const initials = user.username?.[0]?.toUpperCase() || user.userId[0]?.toUpperCase() || "?";
  const infoItems = [
    { label: "用户名", value: user.username || "-" },
    { label: "User ID", value: user.userId },
    { label: "邮箱", value: user.email || "-" },
    { label: "手机", value: user.phone || "-" },
    { label: "角色", value: user.role || "普通用户" },
  ];

  const formatDate = (d: string) =>
    new Date(d).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 p-6">
      {/* 背景氛围 */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="absolute -bottom-40 -left-40 h-[400px] w-[400px] rounded-full bg-indigo-500/8 blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(circle,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-size-[24px_24px]" />
      </div>

      {/* 主卡片 */}
      <div className="relative w-full max-w-lg animate-[fadeUp_0.6s_ease-out]">
        {/* 装饰顶栏 */}
        <div className="absolute top-0 left-8 right-8 h-1 rounded-b-sm bg-linear-to-r from-emerald-400 via-emerald-300 to-indigo-400" />

        <div className="rounded-2xl border border-white/8 bg-white/3 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl">
          {/* 头像区 */}
          <div className="mb-8 flex flex-col items-center gap-4">
            <div className="group relative">
              <div className="absolute inset-0 animate-[pulse_4s_ease-in-out_infinite] rounded-full bg-emerald-400/20 blur-md" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/5 text-2xl font-light tracking-wider text-emerald-300 ring-1 ring-white/5 transition-transform duration-500 group-hover:scale-105">
                {initials}
              </div>
            </div>
            <div className="text-center">
              <p className="text-lg font-medium tracking-wide text-white">
                {user.username || user.userId}
              </p>
              <p className="mt-1 text-sm text-zinc-500">{user.email || "未绑定邮箱"}</p>
            </div>
          </div>

          {/* 信息列表 */}
          <div className="space-y-px rounded-xl border border-white/5 bg-white/2">
            {infoItems.map((item, i) => (
              <div
                key={item.label}
                className="flex items-center justify-between px-5 py-3.5"
                style={{ animationDelay: `${0.2 + i * 0.06}s` }}
              >
                <span className="text-xs font-medium uppercase tracking-widest text-zinc-500">
                  {item.label}
                </span>
                <span className="text-sm text-zinc-200">{item.value}</span>
              </div>
            ))}
          </div>

          {/* 时间信息 */}
          <div className="mt-5 space-y-1.5 rounded-xl border border-white/5 bg-white/1 px-5 py-3">
            <p className="text-[11px]">
              <span className="text-zinc-500">注册时间</span>
              <span className="float-right text-zinc-500">{formatDate(user.createdAt)}</span>
            </p>
            <p className="text-[11px]">
              <span className="text-zinc-500">最近访问</span>
              <span className="float-right text-zinc-500">{formatDate(user.accessedAt)}</span>
            </p>
          </div>

          {/* 操作按钮 */}
          <div className="mt-6 flex gap-3">
            <button
              onClick={handleLogout}
              className="flex-1 rounded-xl border border-white/8 bg-white/3 px-4 py-2.5 text-sm text-zinc-400 transition-all duration-300 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
            >
              退出登录
            </button>
            <button
              onClick={() => router.push("/chat")}
              className="flex-1 rounded-xl bg-white/6 px-4 py-2.5 text-sm text-zinc-300 transition-all duration-300 hover:bg-white/10 hover:text-white"
            >
              开始聊天
            </button>
          </div>
        </div>
      </div>

      {/* keyframes */}
      <style>{`
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(24px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
