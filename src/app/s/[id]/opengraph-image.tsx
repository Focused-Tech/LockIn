import { ImageResponse } from "next/og";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS, type UserDoc } from "@/lib/firebase/types";
import { fetchSlate } from "@/server/data/slates";
import { buildEmbedView } from "@/lib/embed";
import { formatCents, formatMultiple } from "@/lib/utils";

export const runtime = "nodejs"; // firebase-admin can't run on Edge
export const alt = "LockIn contest";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Brand palette (src/app design system).
const BG = "#0A0D12";
const TEXT = "#E8ECF2";
const MUTED = "#6B7A8E";
const CAYENNE = "#FF3B00";
const WIN = "#22C55E";
const AMBER = "#F5A623";
const RUSH = "#9B5DE5";

function clamp(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function countdown(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  if (totalMin <= 0) return "Locking now";
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `Locks in ${d}d ${h}h`;
  if (h > 0) return `Locks in ${h}h ${m}m`;
  return `Locks in ${m}m`;
}

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const slate = await fetchSlate(adminDb(), id);

  // Fallback to a branded card if the slate is missing.
  if (!slate) {
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: BG,
            color: CAYENNE,
            fontSize: 84,
            fontWeight: 800,
          }}
        >
          LockIn
        </div>
      ),
      size,
    );
  }

  const view = buildEmbedView(slate);

  // Creator handle (platform-curated slates have no creator).
  let creatorLabel = "Hosted on LockIn";
  if (slate.creatorId) {
    const snap = await adminDb()
      .collection(COLLECTIONS.users)
      .doc(slate.creatorId)
      .get();
    const u = snap.data() as UserDoc | undefined;
    if (u?.username) creatorLabel = `@${u.username}`;
  }

  const badge =
    view.state === "live"
      ? { label: "LIVE", color: AMBER, bg: "rgba(245,166,35,0.15)" }
      : view.state === "settled"
        ? { label: "SETTLED", color: WIN, bg: "rgba(34,197,94,0.15)" }
        : { label: "LOCKED", color: MUTED, bg: "rgba(107,122,142,0.15)" };

  const status =
    view.state === "live"
      ? countdown(slate.lockTimeMs - Date.now())
      : view.state === "settled"
        ? "Final results"
        : "Results pending";

  const top = slate.predictions[0];

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          padding: 64,
          backgroundColor: BG,
          color: TEXT,
          justifyContent: "space-between",
          fontFamily: "sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ display: "flex", fontSize: 40, fontWeight: 800, color: CAYENNE }}>
              LockIn
            </div>
            <div style={{ display: "flex", fontSize: 26, color: MUTED }}>
              {slate.category}
            </div>
            {slate.isCardRush && (
              <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: RUSH }}>
                ⚡ {slate.rushMultiplier}× Card Rush
              </div>
            )}
          </div>
          <div
            style={{
              display: "flex",
              padding: "10px 24px",
              borderRadius: 999,
              backgroundColor: badge.bg,
              color: badge.color,
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            {badge.label}
          </div>
        </div>

        {/* Title + top prediction */}
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", fontSize: 66, fontWeight: 800, lineHeight: 1.08 }}>
            {clamp(slate.title, 90)}
          </div>
          {top && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", fontSize: 30, color: TEXT }}>
                {clamp(top.question, 70)}
              </div>
              <div style={{ display: "flex", gap: 24, fontSize: 26, color: MUTED }}>
                <div style={{ display: "flex" }}>
                  {clamp(top.optionA, 22)} · {top.probA}%
                </div>
                <div style={{ display: "flex" }}>
                  {clamp(top.optionB, 22)} · {top.probB}%
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer stats */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", fontSize: 24, color: MUTED }}>
              Prize pool
            </div>
            <div style={{ display: "flex", fontSize: 52, fontWeight: 800, color: WIN }}>
              {formatCents(view.prizePoolCents)}
              <span style={{ marginLeft: 14, fontSize: 28, color: MUTED, fontWeight: 600 }}>
                1st {formatMultiple(view.firstPlaceMultiple)}
              </span>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 6,
            }}
          >
            <div style={{ display: "flex", fontSize: 26, color: TEXT }}>
              {view.entryCount} entries · {status}
            </div>
            <div style={{ display: "flex", fontSize: 26, color: MUTED }}>
              {creatorLabel}
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
