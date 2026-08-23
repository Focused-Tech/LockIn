import { Logo } from "@/components/Logo";
import { SkillGameDisclaimer } from "@/components/SkillGameDisclaimer";
import { ButtonLink } from "@/components/ui";
import { isWeb } from "@/lib/surface";
import StartPage from "./start/page";
import StartLayout from "./start/layout";

/**
 * THE ROOT.
 *
 * On the WEB surface this IS the front door — the same page as /start, rendered with the web
 * chrome. A website's home page cannot be the app's marketing splash inside a 430px phone column,
 * which is what this route used to serve at every viewport.
 *
 * On the MOBILE surface it stays exactly what it was: the static splash, off the critical path.
 * The binary is unchanged.
 */
export default async function Root() {
  if (isWeb()) {
    return (
      <StartLayout>
        <StartPage />
      </StartLayout>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-6">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <Logo size="lg" />
        <p className="mt-4 text-lg text-foreground">Your call. Your cash.</p>
        <p className="mt-2 max-w-sm text-sm text-muted">
          Creators host contests. You call the outcomes. Winners split the prize pool.
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
