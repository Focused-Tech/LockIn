import { redirect } from "next/navigation";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { fetchDepositUsage } from "@/server/data/responsiblePlay";
import { DEPOSIT_LIMITS, PERMANENT_EXCLUSION_MS } from "@/lib/constants";
import { ResponsiblePlayView } from "./ResponsiblePlayView";

export default async function ResponsiblePlayPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  const usage = await fetchDepositUsage(adminDb(), profile.id);
  const untilMs = profile.selfExclusionUntil?.toMillis?.() ?? 0;
  const excluded = untilMs > Date.now();

  return (
    <div className="flex flex-col gap-5 p-6">
      <div>
        <h1 className="text-xl font-semibold">Responsible play</h1>
        <p className="text-sm text-muted">
          Set deposit limits or take a break. Limits can only be tightened.
        </p>
      </div>

      <ResponsiblePlayView
        limits={{
          dailyCents: profile.depositLimitDailyCents ?? DEPOSIT_LIMITS.dailyCents,
          weeklyCents:
            profile.depositLimitWeeklyCents ?? DEPOSIT_LIMITS.weeklyCents,
          monthlyCents:
            profile.depositLimitMonthlyCents ?? DEPOSIT_LIMITS.monthlyCents,
        }}
        usage={usage}
        exclusionUntilMs={excluded ? untilMs : 0}
        permanent={untilMs >= PERMANENT_EXCLUSION_MS}
      />
    </div>
  );
}
