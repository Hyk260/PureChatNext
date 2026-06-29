import Image from "next/image";
import LoginForm from "@/components/login/LoginForm";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-svh w-full flex-col bg-background">
      {/* Logo */}
      <header className="absolute left-6 top-6 md:left-10 md:top-8">
        <Image
          src="/logo.png"
          alt="PureChat"
          width={44}
          height={44}
          className="rounded-xl"
          priority
        />
      </header>

      {/* Centered form */}
      <div className="flex flex-1 items-center justify-center px-6 py-24">
        <LoginForm />
      </div>

      {/* Footer */}
      <footer className="flex items-center justify-end px-6 py-6 md:px-10">
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <a href="#" className="transition-colors hover:text-foreground">
            服务条款
          </a>
          <span aria-hidden="true">·</span>
          <a href="#" className="transition-colors hover:text-foreground">
            隐私政策
          </a>
        </nav>
      </footer>
    </main>
  );
}
