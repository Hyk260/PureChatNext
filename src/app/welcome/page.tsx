import Link from "next/link";

export default function WelcomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 lg:px-8">
      <div className="w-full max-w-2xl text-center">
        <div className="mb-16 lg:mb-20">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-semibold tracking-[-0.04em] leading-[0.92] mb-6">
            欢迎来到<br className="sm:hidden" /> PureChat
          </h1>
          <p className="text-base sm:text-lg lg:text-xl max-w-lg mx-auto leading-relaxed text-muted-foreground">
            轻量、私密、可拓展的聊天体验。<br className="hidden sm:block" />从这里开始使用你的新对话空间。
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-20">
          <Link
            href="/login"
            className="inline-flex items-center justify-center h-14 px-7 rounded-full bg-primary text-primary-foreground font-semibold text-base shadow-sm hover:brightness-95 transition-[filter] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring min-w-40"
          >
            登录
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center justify-center h-12 px-6 rounded-full bg-secondary text-secondary-foreground font-semibold text-sm shadow-sm hover:brightness-95 transition-[filter] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring min-w-40"
          >
            注册
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center h-12 px-1 rounded-full font-semibold text-sm shadow-none hover:text-primary transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring min-w-40"
          >
            返回首页
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl mx-auto">
          <div className="flex flex-col items-center gap-2 px-4 py-5 rounded-2xl border border-border bg-card shadow-xs">
            <span className="text-2xl font-semibold tracking-[-0.02em] text-primary">快</span>
            <span className="text-xs text-muted-foreground">即时响应</span>
          </div>
          <div className="flex flex-col items-center gap-2 px-4 py-5 rounded-2xl border border-border bg-card shadow-xs">
            <span className="text-2xl font-semibold tracking-[-0.02em] text-primary">稳</span>
            <span className="text-xs text-muted-foreground">稳定可靠</span>
          </div>
          <div className="flex flex-col items-center gap-2 px-4 py-5 rounded-2xl border border-border bg-card shadow-xs">
            <span className="text-2xl font-semibold tracking-[-0.02em] text-primary">简</span>
            <span className="text-xs text-muted-foreground">极简设计</span>
          </div>
        </div>

        <p className="mt-16 text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} PureChat. All rights reserved.
        </p>
      </div>
    </main>
  );
}


