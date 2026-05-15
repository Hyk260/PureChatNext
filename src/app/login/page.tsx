"use client";

import type React from "react";

import { createClient } from "@/libs/supabase/client";
import { Button, Input, Card } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError("请输入邮箱和密码");
      return;
    }

    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Redirect after successful login
      router.push("/protected");
      router.refresh();
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "登录失败，请检查您的凭据");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card title={<div className="text-2xl">登录</div>}>
          <div className="text-sm text-muted-foreground mb-4">
            在下方输入您的邮箱以登录您的账户
          </div>
          <div className="flex flex-col gap-6">
            <div className="grid gap-2">
              <label htmlFor="email">邮件</label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="password">密码</label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button
              type="primary"
              onClick={handleLogin}
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "登录中..." : "登录"}
            </Button>
          </div>
          <div className="mt-4 text-center text-sm">
            没有账户?{" "}
            <Link href="/register" className="underline underline-offset-4">
              注册
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
