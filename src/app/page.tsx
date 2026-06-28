import { Logo } from "@/components/Logo";
import { SkillGameDisclaimer } from "@/components/SkillGameDisclaimer";
import { ButtonLink } from "@/components/ui";

// Static marketing splash (kept off the critical path). Signed-in users are
// bounced to /app/choose by middleware (cookie-presence) before this renders.
export default function Landing() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-6">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <Logo size="lg" />
        <p className="mt-4 text-lg text-foreground">Your call. Your cash.</p>
        <p className="mt-2 max-w-sm text-sm text-muted">
          Creators host prediction contests. You pick the outcomes. Winners
          split the prize pool.
        </p>

        <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
          <ButtonLink href="/signup" variant="accent" size="lg" className="w-full">
            Create account
          </ButtonLink>
          <ButtonLink href="/login" variant="neutral" size="lg" className="w-full">
            Sign in
          </ButtonLink>
        </div>
      </div>

      <SkillGameDisclaimer className="max-w-md pb-2" />
    </main>
  );
}
