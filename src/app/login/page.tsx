import Link from "next/link";
import { Logo } from "@/components/Logo";
import { SkillGameDisclaimer } from "@/components/SkillGameDisclaimer";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 p-6">
      <Link href="/" className="self-center">
        <Logo />
      </Link>

      <div className="text-center">
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="mt-1 text-sm text-muted">Sign in to lock in your picks.</p>
      </div>

      <LoginForm />

      <p className="text-center text-sm text-muted">
        New to LockIn?{" "}
        <Link href="/signup" className="text-accent">
          Create an account
        </Link>
      </p>

      <SkillGameDisclaimer className="pt-2" />
    </main>
  );
}
