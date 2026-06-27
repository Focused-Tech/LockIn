import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { SkillGameDisclaimer } from "@/components/SkillGameDisclaimer";
import { getCurrentUser } from "@/lib/firebase/session";
import { SocialAuthButtons } from "@/components/auth/SocialAuthButtons";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  // Verified bounce for already-signed-in users (real check, not cookie
  // presence — avoids the /login<->/app loop on a present-but-invalid cookie).
  // Land in the journey hub (front door), not straight into Explore.
  if (await getCurrentUser()) redirect("/app/choose");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 p-6">
      <Link href="/" className="self-center">
        <Logo />
      </Link>

      <div className="text-center">
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="mt-1 text-sm text-muted">Sign in to lock in your picks.</p>
      </div>

      <SocialAuthButtons />

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
