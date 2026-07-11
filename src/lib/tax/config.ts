// LEGAL/TAX: confirm current threshold + treatment with tax advisor.
//
// These values drive 1099 reporting and AML review. They are set by counsel /
// the tax advisor — do not change without sign-off. All amounts are in CENTS.
//
// ASSUMPTIONS FLAGGED FOR THE TAX ADVISOR:
//  - "Reportable amount" for the 1099 threshold is currently GROSS winnings for
//    the calendar year. Confirm whether net (winnings − wagers) applies here.
//  - netProfit is computed as (winnings − entry fees on the WINNING entries),
//    NOT all annual entry fees. Confirm the correct loss/wager treatment.
//  - AML review threshold mirrors the CTR $10,000 convention; confirm.

/** 1099 reporting threshold (cents). Default $600. */
export const TAX_1099_THRESHOLD_CENTS = 600_00;

/** Withdrawals at/above this (cents) are flagged for manual AML review. $10,000. */
export const AML_REVIEW_THRESHOLD_CENTS = 10_000_00;

export interface TaxThresholds {
  tax1099ThresholdCents: number;
  amlReviewThresholdCents: number;
}

export const TAX_THRESHOLDS: TaxThresholds = {
  tax1099ThresholdCents: TAX_1099_THRESHOLD_CENTS,
  amlReviewThresholdCents: AML_REVIEW_THRESHOLD_CENTS,
};
