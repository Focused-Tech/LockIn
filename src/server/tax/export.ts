import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { isCurrentUserAdmin } from "@/lib/firebase/session";
import { COLLECTIONS } from "@/lib/firebase/types";
import type { TaxRollup } from "@/lib/ledger/winnings";

export interface AnnualTaxRow extends TaxRollup {
  userId: string;
  year: number;
}

/**
 * Per-user annual tax data for the operator/accountant. ADMIN-ONLY — throws for
 * anyone else (never silently returns data). Read-only aggregation over the
 * calendar-year rollups; generates no forms.
 *
 * NOTE: the collection-group query on `taxYears` needs a single-field index at
 * collection-group scope (add to firestore.indexes.json before production use).
 */
export async function exportAnnualTaxData(year: number): Promise<AnnualTaxRow[]> {
  if (!(await isCurrentUserAdmin())) {
    console.error("[exportAnnualTaxData] blocked non-admin tax-data export");
    throw new Error("Admin access required for tax export");
  }

  const snap = await adminDb()
    .collectionGroup(COLLECTIONS.taxYears)
    .where("year", "==", year)
    .get();

  return snap.docs.map((d) => {
    const data = d.data() as TaxRollup & { year: number };
    // users/{uid}/taxYears/{year} → the grandparent doc id is the uid.
    const userId = d.ref.parent.parent?.id ?? "";
    return {
      userId,
      year: data.year,
      grossWinningsCents: data.grossWinningsCents ?? 0,
      entryFeesCents: data.entryFeesCents ?? 0,
      netProfitCents: data.netProfitCents ?? 0,
      winCount: data.winCount ?? 0,
      taxReportingRequired: data.taxReportingRequired ?? false,
    };
  });
}
