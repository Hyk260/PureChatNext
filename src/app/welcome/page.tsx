import Link from "next/link";

export default function WelcomePage() {
  return (
    <main className="min-h-screen grid place-items-center bg-linear-to-b from-slate-900 to-slate-800 text-white">
      <div className="px-6 py-12 w-full max-w-xl">
        <div className="rounded-2xl bg-white/5 backdrop-blur-md ring-1 ring-white/10 shadow-xl p-10">
          <h1 className="text-4xl font-extrabold tracking-tight text-white">欢迎来到 PureChat</h1>
          <p className="mt-4 text-slate-300 leading-relaxed">
            轻量、私密、可拓展的聊天体验。从这里开始使用你的新对话空间。
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 active:bg-indigo-700 transition-colors"
            >
              登录
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600 active:bg-slate-700 transition-colors"
            >
              注册
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
            >
              返回首页
            </Link>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3 text-center">
            <div className="rounded-xl bg-black/20 ring-1 ring-white/10 p-4">
              <div className="text-2xl font-semibold text-white">快</div>
              <div className="text-xs text-slate-300 mt-1">即时响应</div>
            </div>
            <div className="rounded-xl bg-black/20 ring-1 ring-white/10 p-4">
              <div className="text-2xl font-semibold text-white">稳</div>
              <div className="text-xs text-slate-300 mt-1">稳定可靠</div>
            </div>
            <div className="rounded-xl bg-black/20 ring-1 ring-white/10 p-4">
              <div className="text-2xl font-semibold text-white">简</div>
              <div className="text-xs text-slate-300 mt-1">极简设计</div>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} PureChat. All rights reserved.
        </p>
      </div>
    </main>
  );
}


