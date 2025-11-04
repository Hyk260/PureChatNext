"use client";

import type React from "react";

import { createClient } from "@/libs/supabase/client";
import { Button, Card, Input } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    if (password !== repeatPassword) {
      setError("密码不匹配");
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("密码必须至少包含6个字符");
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("User")
        .insert([{ email: email, password: password }])
        .select();
      console.log(data, error);
      if (error) throw error;
      router.push("/register-success");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card title={<div className="text-2xl">注册</div>}>
          <div className="text-sm text-muted-foreground mb-4">
            创建一个新账户
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
              <label htmlFor="displayName">昵称（可选）</label>
              <Input
                id="displayName"
                type="text"
                placeholder="John Doe"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
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
            <div className="grid gap-2">
              <label htmlFor="repeat-password">重复密码</label>
              <Input
                id="repeat-password"
                type="password"
                required
                value={repeatPassword}
                onChange={(e) => setRepeatPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button
              onClick={handleSignUp}
              type="primary"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "创建账户中..." : "注册"}
            </Button>
          </div>
          <div className="mt-4 text-center text-sm">
            <span>已经有账户了? </span>
            <Link href="/login" className="underline underline-offset-4">
              {" "}
              登录{" "}
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
