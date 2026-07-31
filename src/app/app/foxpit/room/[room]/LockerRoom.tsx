"use client";

/**
 * FOX PIT — LOCKER ROOM (Part A). The Dojo's staging screen, shown BEFORE the game: keys chased,
 * the locker (trophies + receipts), rules, the category picker (parent → specific subcategory),
 * the human avatar picker, and "enter the dojo". Single vertical gesture-scroll, no visible
 * scrollbar. The room art is a HERO STRIP at the top, never stretched to fill.
 *
 * Category selection lives HERE now (A5) — the game no longer floats its own chips. The chosen
 * subcategories + boss stake plan flow into FoxPitGame.
 */
import { useMemo, useState } from "react";
import { CATEGORIES } from "@/lib/categories";
import { KEY_ASSET, getCleared, isUnlocked, winnersUnlocked, FOXPIT_ROOMS, type FoxPitRoomKey } from "@/lib/foxpit";
import { CARD_DISTRIBUTION, unlockedTierCount, ROOM_RULES } from "@/lib/foxpit/rules";
import { SnackBarPhone } from "../../SnackBarPhone";

// ── named colors (design tokens; no bare hex inline) ──
const GOLD = "#C8A24B";
const GOLD_DIM = "rgba(200,162,75,.35)";
const INK = "#0A0D12";
const KEY_TIER_COLOR: Record<string, string> = { Bronze: "#c9873f", Silver: "#b7c0cc", Gold: "#C8A24B", Platinum: "#d9dee8" };

/** The locker art strip. Baked open, so the door-swing (A3) is a cross-fade reveal until the
 *  three-piece art (body + door front + door inner) lands — never skew the baked image. */
const LOCKER_ART = "/foxpit/dojo_locker_room.png";

/** Locker-room life: a slow Ken-Burns drift on the room art + a "you're here" badge that slides in
 *  then breathes a soft gold glow, so entering the locker room reads as a place, not a static screen. */
const LOCKER_ANIM_CSS = `
@keyframes foxpitLockerKB { 0% { transform: scale(1.06) translate(0,0); } 50% { transform: scale(1.14) translate(-1.6%,-1.2%); } 100% { transform: scale(1.06) translate(0,0); } }
.foxpit-locker-kb { animation: foxpitLockerKB 20s ease-in-out infinite; transform-origin: center 40%; }
@keyframes foxpitLockerBadgeIn { 0% { opacity: 0; transform: translateX(-14px); } 100% { opacity: 1; transform: translateX(0); } }
@keyframes foxpitLockerBadgeGlow { 0%,100% { box-shadow: 0 0 0 rgba(200,162,75,0); } 50% { box-shadow: 0 0 16px rgba(200,162,75,.55); } }
.foxpit-locker-badge { animation: foxpitLockerBadgeIn .5s ease-out both, foxpitLockerBadgeGlow 2.8s ease-in-out 1s infinite; }
`;
/** The one OPEN bay in the baked art — the lit reveal (hanging gi + shelves) with its door
 *  swung right. Measured off the art so the glow sits OVER the open door/bay, not beside it
 *  (percent survives scaling). */
const OPEN_BAY = { xPct: 42, yPct: 15, wPct: 15, hPct: 40 };

// ── PARENT → SUBCATEGORY taxonomy (A5). Groups the ONE shared granular set (CATEGORIES /
// users/{uid}.categories[]) under broad parents. No parallel list. Only parents with subs show. ──
const PARENT_OF: Record<string, string> = {
  NASCAR: "Sports", UFC: "Sports", Boxing: "Sports", Tennis: "Sports", Golf: "Sports",
  Soccer: "Sports", NFL: "Sports", NBA: "Sports", MLB: "Sports", NHL: "Sports",
  Esports: "Gaming",
  Entertainment: "Film & TV", "TV Shows": "Film & TV",
  Music: "Music",
  Crypto: "Finance", Economics: "Finance",
  Politics: "Politics", Geopolitics: "Politics",
  Weather: "Weather",
  Viral: "Culture",
};
const PARENT_ORDER = ["Sports", "Gaming", "Film & TV", "Music", "Finance", "Politics", "Weather", "Culture"];

export interface LockerChoice {
  categories: string[]; // the chosen granular subcategories (1–5)
  avatar: "male" | "female";
}

export function LockerRoom({
  roomKey,
  playerCategories,
  coinBalance,
  onEnter,
  onBack,
}: {
  roomKey: FoxPitRoomKey;
  /** The player's own interests (users/{uid}.categories[]) — the pool they pick 1–5 from. */
  playerCategories: string[];
  /** Current coin balance — the Snack Bar phone's gate reads this (coin-recovery faucet). */
  coinBalance: number;
  onEnter: (choice: LockerChoice) => void;
  onBack: () => void;
}) {
  const rules = ROOM_RULES[roomKey];
  const cleared = getCleared();
  // Snack Bar gate inputs: the rooms this player can afford a seat in, and whether Boss Fox is down.
  const unlockedRooms = FOXPIT_ROOMS.filter((r) => isUnlocked(r, cleared)).map((r) => r.key);
  const bossFoxBeaten = winnersUnlocked(cleared);

  // Parents that actually have subcategories the player owns (fallback to the full set if empty).
  const pool = playerCategories.length ? CATEGORIES.filter((c) => playerCategories.map((p) => p.toLowerCase()).includes(c.name.toLowerCase())) : CATEGORIES;
  const parents = useMemo(() => {
    const byParent = new Map<string, typeof CATEGORIES[number][]>();
    for (const c of pool) {
      const p = PARENT_OF[c.name] ?? "Other";
      if (!byParent.has(p)) byParent.set(p, []);
      byParent.get(p)!.push(c);
    }
    return PARENT_ORDER.filter((p) => byParent.has(p)).map((p) => ({ parent: p, subs: byParent.get(p)! }));
  }, [pool]);

  const [openParent, setOpenParent] = useState<string | null>(parents[0]?.parent ?? null);
  const [chosen, setChosen] = useState<string[]>(() => (pool[0] ? [pool[0].name] : []));
  const [avatar, setAvatar] = useState<"male" | "female">("male");
  const [lockerOpen, setLockerOpen] = useState(false);
  const [rulesFull, setRulesFull] = useState(false);

  const n = Math.max(1, Math.min(chosen.length, 5));
  const split = CARD_DISTRIBUTION[n] ?? [5];
  const openTiers = unlockedTierCount(n, rules.stakes.length);
  const topStake = rules.stakes[openTiers - 1] ?? rules.stakes[0]!;

  const toggleSub = (name: string) =>
    setChosen((prev) => (prev.includes(name) ? prev.filter((x) => x !== name) : prev.length >= 5 ? prev : [...prev, name]));

  const noBar: React.CSSProperties = { scrollbarWidth: "none" };

  return (
    <div className="fixed inset-0 z-[67] flex flex-col overflow-y-auto bg-background text-foreground" style={noBar}>
      {/* 1 — header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3">
        <button onClick={onBack} className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-muted">‹ Dojo</button>
        <div className="flex-1 text-center font-serif text-lg" style={{ color: GOLD }}>The Locker Room</div>
        <div className="w-14" />
      </div>

      <div className="flex flex-col gap-5 p-4 pb-28">
        {/* 2 — KEYS (the progression being chased, at the top) */}
        <section>
          <SectionLabel>KEYS · {FOXPIT_ROOMS.filter((r) => cleared.has(r.key)).length} of {FOXPIT_ROOMS.length}</SectionLabel>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {FOXPIT_ROOMS.map((r) => {
              const asset = KEY_ASSET[r.bossArt];
              const earned = cleared.has(r.key);
              const color = KEY_TIER_COLOR[asset.tier] ?? GOLD;
              return (
                <div key={r.key} className="flex flex-col items-center gap-1 rounded-xl p-2" style={{ border: earned ? `1.5px solid ${color}` : `1.5px dashed ${GOLD_DIM}`, background: earned ? `${color}18` : "transparent" }}>
                  {earned ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={asset.src} alt={`${asset.tier} key`} className="h-9 w-auto" style={{ filter: "drop-shadow(0 2px 5px rgba(0,0,0,.6))" }} />
                  ) : (
                    <div className="flex h-9 items-center justify-center text-lg" style={{ color: GOLD_DIM }}>🔒</div>
                  )}
                  <div className="text-[9px] font-extrabold uppercase tracking-wide" style={{ color: earned ? color : "#6b7a8e" }}>{asset.tier}</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 3 — room art HERO STRIP + open locker */}
        <section>
          <style>{LOCKER_ANIM_CSS}</style>
          <div className="relative w-full overflow-hidden rounded-xl border border-border" style={{ aspectRatio: "1536 / 1024", maxHeight: "27vh" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOCKER_ART} alt="The Dojo locker room" className="foxpit-locker-kb h-full w-full object-cover" />
            {/* "you're in the locker room" cue — slides in on entry, then breathes a gentle glow */}
            <div className="foxpit-locker-badge pointer-events-none absolute left-2 top-2 flex items-center gap-1.5 rounded-full px-3 py-1"
              style={{ background: "rgba(3,4,7,.72)", border: `1.5px solid ${GOLD}`, color: GOLD, backdropFilter: "blur(2px)" }}>
              <span style={{ fontSize: 12 }}>🗝️</span>
              <span className="text-[11px] font-extrabold uppercase tracking-[.14em]">You&rsquo;re in the Locker Room</span>
            </div>
            {/* A3 door-swing scaffold: cross-fade bloom over the open bay when toggled (until the
                three-piece door art lands, this is a reveal — not a skewed fake swing). */}
            <div
              aria-hidden
              className="pointer-events-none absolute"
              style={{
                left: `${OPEN_BAY.xPct}%`, top: `${OPEN_BAY.yPct}%`, width: `${OPEN_BAY.wPct}%`, height: `${OPEN_BAY.hPct}%`,
                boxShadow: lockerOpen ? `0 0 26px 8px ${GOLD}` : "none",
                background: lockerOpen ? "radial-gradient(circle, rgba(200,162,75,.35), transparent 70%)" : "transparent",
                opacity: lockerOpen ? 1 : 0, transition: "opacity .45s ease, box-shadow .45s ease",
              }}
            />
            <button
              onClick={() => setLockerOpen((v) => !v)}
              className="absolute bottom-2 right-2 rounded-lg border px-3 py-1.5 text-xs font-extrabold"
              style={{ borderColor: GOLD, background: "rgba(3,4,7,.7)", color: GOLD }}
            >
              {lockerOpen ? "Close locker" : "Open locker"}
            </button>
            {/* SNACK BAR PHONE — a room-service phone prop on the locker shelf (bottom-left). Always
                visible: dark when the coin gate is closed, lit when it opens. Percent-positioned so
                it rides the art at any scale; nudge left/up here to sit deeper on the shelf once the
                three-piece locker art lands. */}
            <div className="absolute" style={{ left: "3%", bottom: "6%", width: "46%", maxWidth: 176 }}>
              <SnackBarPhone coins={coinBalance} unlockedRooms={unlockedRooms} bossFoxBeaten={bossFoxBeaten} />
            </div>
          </div>
        </section>

        {/* 4 — locker interior (opens/closes): trophies + receipts */}
        {lockerOpen && (
          <section className="rounded-xl border border-border p-3" style={{ animation: "foxpitFadeUp .4s ease both" }}>
            <SectionLabel>TROPHIES</SectionLabel>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {FOXPIT_ROOMS.map((r) => {
                const earned = cleared.has(r.key);
                const asset = KEY_ASSET[r.bossArt];
                return (
                  <div key={r.key} className="flex flex-col items-center gap-1">
                    <div className="flex h-16 w-full items-end justify-center rounded-lg" style={{ background: "rgba(10,13,18,.6)", border: `1px solid ${earned ? KEY_TIER_COLOR[asset.tier] : "var(--border)"}` }}>
                      {earned ? <span className="pb-1 text-2xl">🏆</span> : <span className="pb-1 text-lg opacity-30">▱</span>}
                    </div>
                    <div className="text-[9px] text-muted">{r.boss}</div>
                  </div>
                );
              })}
            </div>
            <SectionLabel className="mt-4">RECEIPTS</SectionLabel>
            {/* Read-only from the practice track record (written at settlement). Empty until rounds
                are played — never invented. */}
            <div className="mt-2 rounded-lg border border-border p-4 text-center text-sm text-muted">
              No rounds on record yet — play the Dojo to start your receipts.
            </div>
          </section>
        )}

        {/* 5 — rules */}
        <section className="rounded-xl border border-border p-3">
          <SectionLabel>HOW THE DOJO PLAYS</SectionLabel>
          <p className="mt-2 text-sm text-muted">
            Pick 1–5 categories, get dealt five cards across them, keep what you like (one redeal),
            stake and answer as many as you want, then face the boss.
          </p>
          {rulesFull && (
            <p className="mt-2 text-sm text-muted">
              Breadth unlocks stakes: more categories opens higher tiers. Score = the coins you staked
              on the cards you got right. The boss plays exactly as many cards as you do.
            </p>
          )}
          <div className="mt-2 flex items-center justify-between">
            <button onClick={() => setRulesFull((v) => !v)} className="text-xs font-bold" style={{ color: GOLD }}>
              {rulesFull ? "Show less" : "Read full rules"}
            </button>
            <label className="flex items-center gap-1.5 text-xs text-muted">
              <input type="checkbox" /> Don&apos;t show again
            </label>
          </div>
        </section>

        {/* 6 — CATEGORY PICKER (parent → specific subcategory) */}
        <section>
          <SectionLabel>YOUR GROUND · pick 1–5</SectionLabel>
          {/* swipeable parent row (no scrollbar) */}
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1" style={noBar}>
            {parents.map(({ parent }) => {
              const on = openParent === parent;
              return (
                <button
                  key={parent}
                  onClick={() => setOpenParent(parent)}
                  className="flex-none rounded-full border px-4 py-2 text-sm font-bold"
                  style={{ borderColor: on ? GOLD : "var(--border)", background: on ? `${GOLD}22` : "transparent", color: on ? GOLD : "var(--muted)" }}
                >
                  {parent}
                </button>
              );
            })}
          </div>
          {/* subcategories of the open parent */}
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(parents.find((p) => p.parent === openParent)?.subs ?? []).map((c) => {
              const on = chosen.includes(c.name);
              return (
                <button
                  key={c.name}
                  onClick={() => toggleSub(c.name)}
                  className="flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm font-bold"
                  style={{ borderColor: on ? GOLD : "var(--border)", background: on ? `${GOLD}1f` : "transparent", color: on ? GOLD : "var(--foreground)" }}
                >
                  <span>{c.icon}</span> {c.name}
                </button>
              );
            })}
          </div>
          {/* live split + stake line — ONE sentence */}
          <div className="mt-2 text-[13px] text-muted">
            <span className="font-extrabold" style={{ color: GOLD }}>{n}</span> categor{n === 1 ? "y" : "ies"} → <span className="font-bold text-foreground">{split.join(" / ")}</span> cards · unlocks up to <span className="font-extrabold" style={{ color: GOLD }}>{topStake} ⛃</span>
            {chosen.length > 0 && <span className="ml-1">({chosen.join(", ")})</span>}
          </div>
        </section>

        {/* 7 — AVATAR PICKER (human only) */}
        <section>
          <SectionLabel>YOUR PLAYER</SectionLabel>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(["male", "female"] as const).map((a) => {
              const on = avatar === a;
              return (
                <button
                  key={a}
                  onClick={() => setAvatar(a)}
                  className="flex flex-col items-center gap-1 rounded-xl border p-3"
                  style={{ borderColor: on ? GOLD : "var(--border)", background: on ? `${GOLD}18` : "transparent" }}
                >
                  <div className="flex h-16 w-full items-center justify-center text-3xl">{a === "male" ? "🕴️" : "💃"}</div>
                  <div className="text-sm font-bold capitalize" style={{ color: on ? GOLD : "var(--foreground)" }}>{a}</div>
                </button>
              );
            })}
          </div>
          <div className="mt-1 text-[11px] text-muted">Human players only — the animals are the bosses. Walk art drops into the sprite frames.</div>
        </section>

        {/* 8 — leaderboard: deferred to its own pass */}
      </div>

      {/* 9 — enter the dojo (fixed footer) */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 p-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)" }}>
        <button
          onClick={() => onEnter({ categories: chosen, avatar })}
          disabled={chosen.length < 1}
          className="w-full rounded-xl py-4 text-lg font-extrabold text-white disabled:opacity-40"
          style={{ background: GOLD, color: INK }}
        >
          Enter the Dojo ›
        </button>
      </div>
    </div>
  );
}

function SectionLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`text-xs font-extrabold tracking-widest ${className}`} style={{ color: GOLD }}>{children}</div>;
}
