import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS, type UserDoc } from "@/lib/firebase/types";
import { fetchSlate } from "@/server/data/slates";
import { buildEmbedView } from "@/lib/embed";
import { formatCents, formatMultiple } from "@/lib/utils";

export const runtime = "nodejs"; // firebase-admin can't run on Edge

/**
 * Branded share-card PNG, server-rendered via next/og (Satori). Three sizes for
 * the prototype's promo set:
 *   ?size=story     1080×1920 (TikTok/IG story)
 *   ?size=square    1080×1080 (IG feed)
 *   ?size=landscape 1200×630  (X/OG)
 * Each carries the creator handle + the LockIn mark and bakes in the deep link
 * lockin://slate/<id> so a tap from the post opens the app to this slate.
 *
 * NOTE: Puppeteer was specced, but it isn't viable on the Vercel serverless
 * target (needs a bundled headless Chromium). next/og is the supported
 * server-side PNG renderer already used by this app's OG route, so it renders
 * the same branded artifact reliably. Public (reads the slate via the Admin SDK).
 */

const SIZES = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
  landscape: { width: 1200, height: 630 },
} as const;
type SizeKey = keyof typeof SIZES;

// Brand palette (design system) — purple→ink gradient + cayenne mark.
const TEXT = "#E8ECF2";
const MUTED = "#8A97A8";
const CAYENNE = "#FF3B00";
const WIN = "#22C55E";
const AMBER = "#F5A623";
const RUSH = "#9B5DE5";

function clamp(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sizeParam = req.nextUrl.searchParams.get("size") as SizeKey | null;
  const size = SIZES[sizeParam ?? "story"] ?? SIZES.story;
  const tall = size.height > size.width;
  const deepLink = `lockin://slate/${id}`;

  const slate = await fetchSlate(adminDb(), id);
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
            backgroundColor: "#0D1118",
            color: CAYENNE,
            fontSize: 96,
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
      ? { label: "LIVE", color: AMBER }
      : view.state === "settled"
        ? { label: "RESULTS IN", color: WIN }
        : { label: "LOCKED", color: MUTED };

  const top = slate.predictions[0];
  const pad = tall ? 80 : 64;
  const titleSize = tall ? 84 : 60;
  const poolSize = tall ? 84 : 60;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          padding: pad,
          backgroundImage: "linear-gradient(135deg, #1a1020, #0d1118)",
          color: TEXT,
          justifyContent: "space-between",
          fontFamily: "sans-serif",
          border: `${tall ? 10 : 6}px solid ${CAYENNE}`,
        }}
      >
        {/* Header: LockIn mark + creator handle + state badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ display: "flex", fontSize: tall ? 52 : 40, fontWeight: 800, color: CAYENNE }}>
              LockIn
            </div>
            {slate.isCardRush && (
              <div style={{ display: "flex", fontSize: tall ? 34 : 26, fontWeight: 700, color: RUSH }}>
                ⚡ {slate.rushMultiplier}×
              </div>
            )}
          </div>
          <div
            style={{
              display: "flex",
              padding: tall ? "12px 28px" : "10px 22px",
              borderRadius: 999,
              border: `2px solid ${badge.color}`,
              color: badge.color,
              fontSize: tall ? 30 : 24,
              fontWeight: 700,
            }}
          >
            {badge.label}
          </div>
        </div>

        {/* Body: title + top prediction */}
        <div style={{ display: "flex", flexDirection: "column", gap: tall ? 34 : 20 }}>
          <div style={{ display: "flex", fontSize: tall ? 30 : 24, color: AMBER, fontWeight: 700 }}>
            {creatorLabel}
          </div>
          <div style={{ display: "flex", fontSize: titleSize, fontWeight: 800, lineHeight: 1.06 }}>
            {clamp(slate.title, tall ? 80 : 70)}
          </div>
          {top && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", fontSize: tall ? 36 : 28, color: TEXT }}>
                {clamp(top.question, tall ? 70 : 60)}
              </div>
              <div style={{ display: "flex", gap: 28, fontSize: tall ? 32 : 24, color: MUTED }}>
                <div style={{ display: "flex" }}>
                  {clamp(top.optionA, 20)} · {top.probA}%
                </div>
                <div style={{ display: "flex" }}>
                  {clamp(top.optionB, 20)} · {top.probB}%
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer: prize pool + deep link */}
        <div style={{ display: "flex", flexDirection: "column", gap: tall ? 18 : 10 }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", fontSize: tall ? 28 : 22, color: MUTED }}>
                Prize pool
              </div>
              <div style={{ display: "flex", fontSize: poolSize, fontWeight: 800, color: WIN }}>
                {formatCents(view.prizePoolCents)}
              </div>
            </div>
            <div style={{ display: "flex", fontSize: tall ? 30 : 24, color: MUTED }}>
              1st {formatMultiple(view.firstPlaceMultiple)} · {view.entryCount} in
            </div>
          </div>
          <div style={{ display: "flex", fontSize: tall ? 26 : 20, color: CAYENNE }}>
            ▸ {deepLink}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
