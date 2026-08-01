import "server-only";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/types";
import { detectBannedArchetype } from "@/lib/contest/questionEngine";
import { buildCrossGameSlate, type FeedGame, type CrossGameSlate } from "./crossGame";

/**
 * REAL data-feed sync (server/cron side). Mirrors scripts/sync-feed.mjs. ESPN's public scoreboard is
 * the DATA source only — we do NOT serve its betting markets (moneyline / spread / total are banned
 * archetypes). Instead each league's games are transformed into ONE compliant CROSS-GAME HEAD-TO-HEAD
 * slate: standout players (from ESPN stat `leaders`) paired across DIFFERENT games. Settlement grades
 * each leg from the players' real box-score stats (see crossGame.ts + settle.ts).
 */
const DAY = 24 * 60 * 60 * 1000;
const PER_LEAGUE = 8;
const HORIZON_MS = 10 * DAY;
const tiers = [
  { tier: 5, hostingFeeCents: 100 },
  { tier: 10, hostingFeeCents: 200 },
  { tier: 25, hostingFeeCents: 300 },
];

const LEAGUES = [
  { sport: "baseball", league: "mlb", category: "MLB" },
  { sport: "basketball", league: "wnba", category: "WNBA" },
  { sport: "soccer", league: "usa.1", category: "Soccer" },
  { sport: "soccer", league: "eng.1", category: "Soccer" },
  { sport: "football", league: "nfl", category: "NFL" },
  { sport: "football", league: "college-football", category: "CFB" },
  { sport: "basketball", league: "nba", category: "NBA" },
  { sport: "hockey", league: "nhl", category: "NHL" },
] as const;

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Fetch a league's UPCOMING games as normalized FeedGame[] (carry raw competitors for `leaders`). */
async function fetchGames(l: (typeof LEAGUES)[number], now: number): Promise<FeedGame[]> {
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${l.sport}/${l.league}/scoreboard`, { cache: "no-store" });
  if (!res.ok) {
    console.error(`[feed] ESPN ${l.league}: HTTP ${res.status}`);
    return [];
  }
  const data = await res.json();
  const out: FeedGame[] = [];
  for (const ev of data.events ?? []) {
    const comp = ev.competitions?.[0];
    if (!comp) continue;
    const start = new Date(ev.date).getTime();
    if (start <= now || start > now + HORIZON_MS) continue;
    const home = comp.competitors?.find((c: any) => c.homeAway === "home");
    const away = comp.competitors?.find((c: any) => c.homeAway === "away");
    if (!home?.team || !away?.team) continue;
    out.push({
      eventId: String(ev.id),
      startMs: start,
      homeName: home.team.displayName,
      awayName: away.team.displayName,
      competitors: comp.competitors ?? [],
    });
  }
  return out;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Upsert a cross-game head-to-head slate + its legs. A leg is guarded by the banned-archetype
 *  detector (defence in depth). If no compliant legs remain, the slate is removed. Returns legs written. */
async function writeCrossGameSlate(s: CrossGameSlate, now: number): Promise<number> {
  const legs = s.legs.filter((leg) => detectBannedArchetype(leg.question, [leg.optionA, leg.optionB]) == null);
  const ref = adminDb().collection(COLLECTIONS.slates).doc(s.slateId);
  if (legs.length === 0) {
    const prior = await ref.collection(COLLECTIONS.predictions).get();
    for (const d of prior.docs) await d.ref.delete();
    await ref.delete().catch(() => {});
    return 0;
  }
  await ref.set(
    {
      creatorId: null,
      title: s.title,
      description: null,
      category: s.category,
      status: "live",
      entryTiers: tiers,
      entryCount: 0,
      isCardRush: false,
      rushMultiplier: 1,
      maxEntries: null,
      lockTime: Timestamp.fromMillis(s.lockMs),
      promotionOpensAt: Timestamp.fromMillis(now - DAY),
      settledAt: null,
      cancelledAt: null,
      creatorBonusCents: 0,
      source: "espn",
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  let i = 0;
  for (const leg of legs) {
    await ref.collection(COLLECTIONS.predictions).doc(`h${i}`).set(
      {
        question: leg.question,
        optionA: leg.optionA,
        optionB: leg.optionB,
        optionAProbability: leg.probA,
        optionBProbability: leg.probB,
        optionAMultiplier: Math.round((100 / Math.max(1, leg.probA)) * 100) / 100,
        optionBMultiplier: Math.round((100 / Math.max(1, leg.probB)) * 100) / 100,
        predictionType: "binary",
        overUnderLine: null,
        result: null,
        verificationSources: null,
        verificationConfidence: null,
        sortOrder: i,
        h2h: leg.h2h, // settlement metadata: stat + box label + both players (id/name/team/eventId)
      },
      { merge: true },
    );
    i++;
  }
  const existing = await ref.collection(COLLECTIONS.predictions).get();
  const keep = new Set(legs.map((_, k) => `h${k}`));
  for (const d of existing.docs) if (!keep.has(d.id)) await d.ref.delete();
  return legs.length;
}

/** Pull upcoming games across the leagues and upsert one compliant cross-game head-to-head slate each. */
export async function syncFeed(now: number = Date.now()): Promise<{ synced: number; markets: number; byLeague: Record<string, number>; oddsApi: boolean }> {
  const byLeague: Record<string, number> = {};
  let synced = 0, markets = 0;
  for (const l of LEAGUES) {
    try {
      const games = (await fetchGames(l, now)).slice(0, PER_LEAGUE);
      const slate = buildCrossGameSlate({ league: l.league, category: l.category, games });
      if (!slate) continue;
      const n = await writeCrossGameSlate(slate, now);
      if (n > 0) {
        byLeague[l.category] = (byLeague[l.category] ?? 0) + 1;
        synced += 1;
        markets += n;
      }
    } catch (err) {
      console.error(`[feed] ${l.league} failed`, err);
    }
  }
  return { synced, markets, byLeague, oddsApi: !!process.env.THE_ODDS_API_KEY };
}
