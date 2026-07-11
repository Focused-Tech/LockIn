import { isOverrideAccount } from "@/lib/eligibility";
import type { TaxThresholds } from "./config";

export type WithdrawalDecision =
  | { allowed: true; amlReview: boolean }
  | { allowed: false; code: "w9_required"; message: string };

/**
 * PURE withdrawal gate for tax/AML. FAIL CLOSED for strangers, EXEMPT for
 * architect/admin (PART A override).
 *  - Above the 1099 threshold (or already tax-reportable this year) a W-9 must be
 *    on file, else the withdrawal is blocked with a "complete tax info" prompt.
 *  - Large withdrawals are FLAGGED for manual AML review (never auto-blocked).
 * Destination-identity (no third-party payout) is enforced structurally by the
 * action — withdrawals only ever pay the authenticated, KYC-verified user.
 */
export function evaluateWithdrawal(
  input: {
    user: { isArchitect?: boolean; isAdmin?: boolean };
    amountCents: number;
    w9OnFile: boolean;
    taxReportingRequired: boolean;
  },
  cfg: TaxThresholds,
): WithdrawalDecision {
  // Architect/admin bypass tax/AML gating entirely.
  if (isOverrideAccount(input.user)) return { allowed: true, amlReview: false };

  const needsW9 =
    input.taxReportingRequired || input.amountCents >= cfg.tax1099ThresholdCents;
  if (needsW9 && !input.w9OnFile) {
    return {
      allowed: false,
      code: "w9_required",
      message:
        "Add your tax info (W-9) before withdrawing. You can complete it in your wallet settings.",
    };
  }

  return {
    allowed: true,
    amlReview: input.amountCents >= cfg.amlReviewThresholdCents,
  };
}
