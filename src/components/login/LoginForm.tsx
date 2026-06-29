"use client";

import type React from "react";

import { createClient } from "@/libs/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Github, Loader2, Lock, Mail } from "lucide-react";

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.42 2.21-1.16 3.02-.78.86-2.06 1.53-3.13 1.45-.13-1.1.43-2.27 1.13-3.01.79-.85 2.16-1.49 3.16-1.46zM20.5 17.2c-.55 1.27-.82 1.84-1.53 2.96-.99 1.56-2.39 3.51-4.12 3.52-1.54.02-1.94-1-4.03-.99-2.09.01-2.53 1.01-4.07.99-1.73-.02-3.05-1.78-4.04-3.34C-.5 16.95-.7 11.7 1.5 8.93c1.04-1.32 2.69-2.16 4.24-2.16 1.58 0 2.57 1 3.88 1 1.27 0 2.04-1 3.86-1 1.38 0 2.84.75 3.88 2.05-3.41 1.87-2.85 6.74.04 8.38z" />
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

type Provider = "apple" | "google" | "github";

const oauthButtons: {
  provider: Provider;
  label: string;
  icon: React.ReactNode;
  lastUsed?: boolean;
}[] = [
  { provider: "apple", label: "使用 Apple 登录", icon: <AppleIcon className="h-5 w-5 text-foreground" /> },
  { provider: "google", label: "使用 Google 登录", icon: <GoogleIcon className="h-5 w-5" />, lastUsed: true },
  { provider: "github", label: "使用 GitHub 登录", icon: <Github className="h-5 w-5 text-foreground" /> },
];

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"email" | "password">("email");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<Provider | "email" | null>(null);

  const handleOAuth = async (provider: Provider) => {
    setError(null);
    setLoading(provider);
    try {
      if (provider === "github") {
        const res = await fetch("/api/auth/github?client=web");
        const data = await res.json();
        if (!res.ok || !data.url) throw new Error(data.error || "无法获取 GitHub 授权地址");
        window.location.href = data.url;
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider === "apple" ? "apple" : "google",
        options: { redirectTo: `${window.location.origin}/protected` },
      });
      if (error) throw error;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "登录失败，请稍后重试");
      setLoading(null);
    }
  };

  const handleEmailContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (step === "email") {
      if (!email) {
        setError("请输入邮箱");
        return;
      }
      setStep("password");
      return;
    }

    if (!password) {
      setError("请输入密码");
      return;
    }

    setLoading("email");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push("/protected");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "登录失败，请检查您的凭据");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="w-full max-w-md">
      <h1 className="mb-8 text-pretty text-3xl font-bold tracking-tight text-foreground md:text-4xl">
        登录或注册你的 PureChat 账号
      </h1>

      <div className="flex flex-col gap-3">
        {oauthButtons.map((btn) => (
          <div key={btn.provider} className="relative">
            <button
              type="button"
              onClick={() => handleOAuth(btn.provider)}
              disabled={loading !== null}
              className="flex h-14 w-full items-center justify-center gap-3 rounded-xl border border-border bg-card px-4 text-base font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading === btn.provider ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                btn.icon
              )}
              <span>{btn.label}</span>
            </button>
            {btn.lastUsed && (
              <span className="absolute -right-2 -top-2 rounded-md bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground shadow-sm">
                上次使用
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="my-6 flex items-center gap-4">
        <span className="h-px flex-1 bg-border" />
        <span className="text-sm text-muted-foreground">或继续使用</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleEmailContinue} className="flex flex-col gap-3">
        <div className="flex h-14 items-center gap-3 rounded-xl border border-border bg-card pl-4 pr-2 transition-colors focus-within:border-foreground/40">
          <Mail className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="请输入邮箱或用户名"
            autoComplete="email"
            disabled={step === "password"}
            className="h-full flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-70"
          />
          {step === "email" && (
            <button
              type="submit"
              aria-label="继续"
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-foreground transition-colors hover:bg-foreground hover:text-background"
            >
              <ArrowRight className="h-5 w-5" />
            </button>
          )}
        </div>

        {step === "password" && (
          <>
            <div className="flex h-14 items-center gap-3 rounded-xl border border-border bg-card px-4 transition-colors focus-within:border-foreground/40">
              <Lock className="h-5 w-5 shrink-0 text-muted-foreground" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                autoComplete="current-password"
                autoFocus
                className="h-full flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            <button
              type="submit"
              disabled={loading === "email"}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-base font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {loading === "email" && <Loader2 className="h-5 w-5 animate-spin" />}
              {loading === "email" ? "登录中..." : "登录"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setPassword("");
                setError(null);
              }}
              className="text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              使用其他邮箱
            </button>
          </>
        )}
      </form>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
        继续即表示你已阅读并同意
        <a href="#" className="underline underline-offset-2 hover:text-foreground">
          服务条款
        </a>
        与
        <a href="#" className="underline underline-offset-2 hover:text-foreground">
          隐私政策
        </a>
      </p>
    </div>
  );
}
