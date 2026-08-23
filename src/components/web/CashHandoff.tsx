import Link from "next/link";
import { isWeb } from "@/lib/surface";

/**
 * THE CONVERSION MOMENT.
 *
 * The Beginner lane is not a separate game — it MIRRORS live slates. `fetchBeginnerFeed`
 * (src/server/data/beginner.ts:29) builds the beginner feed out of the very same
 * `fetchFeedSlates` source the cash feed uses, and every mirrored pick carries the live
 * `slateId` (src/lib/beginner/types.ts:8). No second mirroring implementation was written and none
 * is needed — the link between practice and cash already exists in the data.
 *
 * So the hand-off is simply: at the end of a practice card, offer the CASH version of the SAME live
 * slate, carrying its id.
 *
 * WEB-ONLY BY CONSTRUCTION. Returns null on the mobile surface, so the shipped binary renders
 * nothing extra and no mobile screen changes. The app hand-off below is therefore a link OUT to the
 * app from the web, which is the direction that converts.
 */
export function CashHandoff({
  slateId,
  creatorName,
}: {
  /** The LIVE slate this practice card mirrored. Null when the card had no live source. */
  slateId: string | null;
  creatorName: string;
}) {
  if (!isWeb()) return null;
  if (!slateId) return null;

  return (
    <div
      style={{
        marginTop: 14,
        padding: 16,
        borderRadius: 16,
        border: "1px solid #1E2A38",
        borderLeft: "4px solid #FF5A1F",
        background: "#0D1118",
      }}
    >
      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fff" }}>
        That was the practice run.
      </p>
      <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.55, color: "#6B7A8E" }}>
        The same contest from {creatorName} is live right now for real. Same questions, same close
        time — this time it pays.
      </p>

      <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
        <Link
          href={`/app/slate/${slateId}`}
          style={{
            padding: "11px 18px",
            borderRadius: 11,
            background: "#FF3B00",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Play it for real
        </Link>
        <Link
          href={`/app/slate/${slateId}?from=practice`}
          style={{
            padding: "11px 18px",
            borderRadius: 11,
            border: "1px solid #1E2A38",
            color: "#c9d3e0",
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Open in the app
        </Link>
      </div>
    </div>
  );
}
