import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { SkillGameDisclaimer } from "@/components/SkillGameDisclaimer";
import { getCurrentUser } from "@/lib/firebase/session";
import { SignupForm } from "./SignupForm";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  // Verified bounce for already-signed-in users (real check, not cookie
  // presence — avoids the /login<->/app loop on a present-but-invalid cookie).
  if (await getCurrentUser()) redirect("/app");

  const { ref } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 p-6">
      <Link href="/" className="self-center">
        <Logo />
      </Link>

      <div className="text-center">
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="mt-1 text-sm text-muted">
          Start with 500 free coins. Your call. Your cash.
        </p>
      </div>

      {ref && (
        <p className="rounded border border-[rgba(34,197,94,0.25)] bg-[rgba(34,197,94,0.10)] px-3 py-2 text-center text-sm text-win">
          Invited by @{ref} — you&apos;ll get bonus coins when you join.
        </p>
      )}

      <SignupForm referralCode={ref} />

      <SkillGameDisclaimer variant="block" />

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-accent">
          Sign in
        </Link>
      </p>
    </main>
  );
}
