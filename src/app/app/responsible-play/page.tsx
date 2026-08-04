import { redirect } from "next/navigation";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { fetchDepositUsage } from "@/server/data/responsiblePlay";
import { DEPOSIT_LIMITS, PERMANENT_EXCLUSION_MS } from "@/lib/constants";
import { ResponsiblePlayView } from "./ResponsiblePlayView";
import "../lk-panels.css";

export default async function ResponsiblePlayPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  const advanced = (profile.journeyLane ?? "advanced") !== "beginner";
  const usage = await fetchDepositUsage(adminDb(), profile.id);
  const untilMs = profile.selfExclusionUntil?.toMillis?.() ?? 0;
  const excluded = untilMs > Date.now();

  return (
    <ResponsiblePlayView
      advanced={advanced}
      limits={{
        dailyCents: profile.depositLimitDailyCents ?? DEPOSIT_LIMITS.dailyCents,
        weeklyCents: profile.depositLimitWeeklyCents ?? DEPOSIT_LIMITS.weeklyCents,
        monthlyCents: profile.depositLimitMonthlyCents ?? DEPOSIT_LIMITS.monthlyCents,
      }}
      usage={usage}
      exclusionUntilMs={excluded ? untilMs : 0}
      permanent={untilMs >= PERMANENT_EXCLUSION_MS}
    />
  );
}
