"use client";

/**
 * Creator Engine slice 4 — the slate builder + Lockpick + the pot.
 * Built to design/lockin_creator_mode_mockup.html, wiring the real engine:
 *   · Lockpick  = validateSlate/validateLeg (one-player-per-game, context, dead-slot) → per-leg flags
 *   · reach     = eligibility (states that can play for cash)
 *   · the pot   = potModel (pool-size rake, sliding creator cut, division projection) — PREVIEW only
 * Publish is gated until every leg passes Lockpick and at least one stake is allowed.
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  validateSlate,
  archetypePool,
  type Archetype,
  type Leg,
  type LegContext,
} from "@/lib/contest/questionEngine";
import type { FormatTier } from "@/lib/eligibility";
import { enginePlayersFor, QUESTION_TEMPLATES, type CreatorGame } from "@/lib/contest/games";
import {
  rakeForPool,
  creatorCut,
  creatorKeep,
  project,
  DIVISIONS,
  CREATOR_CUT_CAP_DOLLARS,
} from "@/lib/contest/potModel";
import { BASE_STAKES, BIG_POT_STAKES, HOST_FEE_TIERS, type Division } from "@/lib/contest/architectSet";
import { publishProSlate, fetchLegContext, type ProSlateInput } from "./actions";
import type { PlayerContext } from "@/server/feeds/creatorGames";

const ALL_STAKES = [...BASE_STAKES, ...BIG_POT_STAKES]; // 5,10,15,25,50
const EARN_MARKS = [5000, 15000, 30000, 75000, 150000];
const C = {
  orange: "#FC3E01", gold: "#F0C463", panel: "#12161d", panel2: "#171b23", edge: "#232a35",
  grey: "#E7E7EB", dim: "#8B93A1", ok: "#5DCAA5", bad: "#E0432C", warn: "#EF9F27", ink: "#0A0D12",
};
const EMPTY_CONTEXT: LegContext = { seasonAverage: "", last3Form: "", matchupNote: "" };

interface LegForm {
  id: string;
  question: string;
  archetype: Archetype;
  playerNames: string[];
  context: LegContext;
}

let legSeq = 0;
const newLeg = (n: number): LegForm => ({
  id: `leg_${legSeq++}`,
  question: QUESTION_TEMPLATES[n % QUESTION_TEMPLATES.length]!,
  archetype: "cross_game_h2h",
  playerNames: [],
  context: { ...EMPTY_CONTEXT },
});

export function CreatorMode({
  games, feedError, formatTier, cashReach, totalStates, canHostCash, cashBlockReason,
}: {
  games: CreatorGame[];
  /** §1.C — a live-feed failure / empty board. When set, the builder shows it and can't publish. */
  feedError: string | null;
  formatTier: FormatTier;
  cashReach: number;
  totalStates: number;
  canHostCash: boolean;
  cashBlockReason: string | null;
}) {
  const router = useRouter();
  const pool = archetypePool(formatTier);
  const [selectedGameIds, setSelectedGameIds] = useState<string[]>(games.slice(0, 2).map((g) => g.id));
  const [legs, setLegs] = useState<LegForm[]>(() => [newLeg(0)]);
  const [stakes, setStakes] = useState<number[]>([5, 10, 15]);
  const [division, setDivision] = useState<Division>("wolf");
  const [targetPot, setTargetPot] = useState(150000);
  const [hostFee, setHostFee] = useState(2);
  const [entries, setEntries] = useState(30000);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");

  // the player pool from the SELECTED games (name → EnginePlayer) for Lockpick.
  const players = useMemo(() => enginePlayersFor(games, selectedGameIds), [games, selectedGameIds]);
  const playerByName = useMemo(() => new Map(players.map((p) => [p.name, p])), [players]);

  // Lockpick: resolve each leg to an engine Leg and validate the whole slate.
  const engineLegs: Leg[] = legs.map((l) => ({
    archetype: l.archetype,
    players: l.playerNames.map((n) => playerByName.get(n)).filter((p): p is NonNullable<typeof p> => !!p),
    context: l.context.seasonAverage && l.context.last3Form && l.context.matchupNote ? l.context : null,
  }));
  const { legVerdicts, canPublish } = validateSlate(engineLegs, selectedGameIds);

  const toggleGame = (id: string) => {
    setSelectedGameIds((prev) => {
      const next = prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id];
      // prune players that no longer belong to a selected game (mockup behaviour)
      const stillIn = new Set(enginePlayersFor(games, next).map((p) => p.name));
      setLegs((ls) => ls.map((l) => ({ ...l, playerNames: l.playerNames.filter((n) => stillIn.has(n)) })));
      return next;
    });
  };
  // §1.2 — name↔id + name→game maps (from the LIVE games), and per-leg feed context (season avg +
  // last-out), fetched from the feed when players are chosen (a batch), NOT typed.
  const idByName = useMemo(() => new Map(games.flatMap((g) => g.players).map((p) => [p.name, p.playerId ?? ""])), [games]);
  const nameById = useMemo(() => new Map(games.flatMap((g) => g.players).map((p) => [p.playerId ?? "", p.name])), [games]);
  const gameByName = useMemo(() => new Map(games.flatMap((g) => g.players.map((p) => [p.name, g] as const))), [games]);
  const [legContext, setLegContext] = useState<Record<string, (PlayerContext & { name: string })[]>>({});

  const refreshContext = async (legId: string, names: string[]) => {
    const ids = names.map((n) => idByName.get(n)).filter((x): x is string => !!x);
    const matchup = [...new Set(names.map((n) => gameByName.get(n)).filter(Boolean).map((g) => `${g!.away} @ ${g!.home}`))].join(" · ");
    if (ids.length === 0) {
      setLegContext((c) => ({ ...c, [legId]: [] }));
      setLegs((ls) => ls.map((l) => (l.id === legId ? { ...l, context: { ...EMPTY_CONTEXT } } : l)));
      return;
    }
    const rows = (await fetchLegContext(ids)).map((c) => ({ ...c, name: nameById.get(c.playerId) ?? "" }));
    setLegContext((c) => ({ ...c, [legId]: rows }));
    const first = rows[0];
    // the single engine context (feed-derived, satisfies validateLeg's mandatory-context rule).
    setLegs((ls) => ls.map((l) => (l.id === legId ? { ...l, context: { seasonAverage: first?.seasonAverage ?? "-", last3Form: first?.last3Form ?? "-", matchupNote: matchup || "-" } } : l)));
  };

  const togglePlayer = (legId: string, name: string) => {
    const leg = legs.find((l) => l.id === legId);
    const nextNames = leg
      ? (leg.playerNames.includes(name) ? leg.playerNames.filter((n) => n !== name) : [...leg.playerNames, name])
      : [name];
    setLegs((ls) => ls.map((l) => (l.id === legId ? { ...l, playerNames: nextNames } : l)));
    void refreshContext(legId, nextNames);
  };
  const setLeg = (legId: string, patch: Partial<LegForm>) =>
    setLegs((ls) => ls.map((l) => (l.id === legId ? { ...l, ...patch } : l)));
  const toggleStake = (v: number) =>
    setStakes((prev) => (prev.includes(v) ? prev.filter((s) => s !== v) : [...prev, v]).sort((a, b) => a - b));

  // ---- the pot (preview model) ----
  const avg = stakes.length ? stakes.reduce((a, b) => a + b, 0) / stakes.length : 0;
  const poolNow = Math.round(entries * avg);
  const rakeNow = rakeForPool(poolNow);
  const netNow = Math.round(poolNow * (1 - rakeNow));
  const pct = targetPot > 0 ? (netNow / targetPot) * 100 : 0;
  const pj = project(division, avg);
  const feeGross = entries * hostFee;
  const feeKeep = creatorKeep(entries, hostFee, poolNow);

  const earnRows = useMemo(() => {
    const marks = EARN_MARKS.includes(entries) || entries <= 0 ? [...EARN_MARKS] : [...EARN_MARKS, entries].sort((a, b) => a - b);
    return marks.map((n) => {
      const gross = n * hostFee;
      const mpool = Math.round(n * avg);
      const cut = creatorCut(mpool);
      const keep = Math.min(CREATOR_CUT_CAP_DOLLARS, Math.round(gross * cut));
      return { n, gross, cut, keep, now: n === entries };
    });
  }, [entries, hostFee, avg]);

  const canSubmit = canPublish && stakes.length > 0 && !publishing;

  const onPublish = async () => {
    if (!canSubmit) return;
    setPublishing(true);
    setError(null);
    const input: ProSlateInput = {
      title: title.trim() || "Tonight's slate",
      gameIds: selectedGameIds,
      legs: legs.map((l) => ({ question: l.question, archetype: l.archetype, playerNames: l.playerNames, context: l.context })),
      stakes,
      division,
      targetPotCents: targetPot * 100,
      hostFeeCents: hostFee * 100,
    };
    const res = await publishProSlate(input);
    setPublishing(false);
    if (!res.ok) { setError(res.error ?? "Couldn't publish. Try again."); return; }
    router.push(`/app/slate/${res.slateId}`);
  };

  const card: React.CSSProperties = { background: C.panel, border: `1px solid ${C.edge}`, borderRadius: 12, padding: 12 };
  const h2: React.CSSProperties = { font: "600 12px Georgia, serif", letterSpacing: ".14em", textTransform: "uppercase", color: C.gold, margin: "0 0 9px" };
  const chip = (on: boolean): React.CSSProperties => ({
    border: `1px solid ${on ? C.gold : C.edge}`, borderRadius: 7, padding: "5px 9px", fontSize: 12,
    cursor: "pointer", background: C.panel, color: on ? C.gold : C.grey,
  });

  // §1.C — no live games (feed failure / empty board): show the error, no builder, no seed.
  if (feedError) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10, color: C.grey }}>
        <div data-feed-error style={{ fontSize: 13, lineHeight: 1.5, color: "#ffb3a5", background: "rgba(224,67,44,.13)", borderLeft: `3px solid ${C.bad}`, borderRadius: 8, padding: "12px 14px" }}>
          {feedError}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, color: C.grey }}>
      {/* slate title */}
      <div style={card}>
        <h2 style={h2}>Slate title</h2>
        <input
          value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tonight's slate"
          style={{ width: "100%", background: C.ink, color: C.grey, border: `1px solid ${C.edge}`, borderRadius: 7, padding: "8px 10px", fontSize: 14 }}
        />
      </div>

      {/* 1 · Tonight's games */}
      <div style={card}>
        <h2 style={h2}>1 · Tonight&apos;s games</h2>
        {games.map((g) => {
          const on = selectedGameIds.includes(g.id);
          return (
            <button
              key={g.id} onClick={() => toggleGame(g.id)}
              style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 9px", width: "100%", textAlign: "left",
                border: `1px solid ${on ? C.orange : C.edge}`, boxShadow: on ? `0 0 0 1px ${C.orange} inset` : "none",
                borderRadius: 9, marginBottom: 6, cursor: "pointer", background: C.panel2, color: C.grey }}
            >
              <span style={{ width: 16, height: 16, borderRadius: 4, border: `1px solid ${on ? C.orange : C.dim}`,
                background: on ? C.orange : "transparent", color: "#fff", display: "grid", placeItems: "center", fontSize: 10, flex: "none" }}>
                {on ? "✓" : ""}
              </span>
              <span style={{ flex: 1, fontSize: 13.5 }}>{g.away} at {g.home}</span>
              <span style={{ fontSize: 10.5, color: C.dim }}>{g.tipoff}</span>
            </button>
          );
        })}
        <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.5, marginTop: 4 }}>
          Pulled from the live feed. Pick the games you want; the player pool fills from those rosters.
        </div>
      </div>

      {/* 2 · Your questions */}
      <div style={card}>
        <h2 style={h2}>2 · Your questions</h2>
        {legs.length === 0 && <div style={{ fontSize: 11, color: C.dim }}>No questions yet.</div>}
        {legs.map((l, i) => {
          const v = legVerdicts[i];
          const ok = v?.ok ?? false;
          return (
            <div key={l.id} style={{ border: `1px solid ${ok ? "#2b6b52" : C.bad}`, borderRadius: 10, padding: 10, marginBottom: 8, background: C.panel2 }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 7 }}>
                <input
                  value={l.question} onChange={(e) => setLeg(l.id, { question: e.target.value })}
                  style={{ flex: 1, background: C.ink, color: C.grey, border: `1px solid ${C.edge}`, borderRadius: 7, padding: "6px 8px", fontSize: 13.5 }}
                />
                {legs.length > 1 && (
                  <button onClick={() => setLegs((ls) => ls.filter((x) => x.id !== l.id))}
                    style={{ border: `1px solid ${C.edge}`, background: "none", color: C.dim, borderRadius: 7, padding: "0 9px", cursor: "pointer" }}>✕</button>
                )}
              </div>
              {/* archetype — the pool is narrowed by the creator's state (restricted sees fewer) */}
              <select value={l.archetype} onChange={(e) => setLeg(l.id, { archetype: e.target.value as Archetype })}
                style={{ width: "100%", background: C.ink, color: C.grey, border: `1px solid ${C.edge}`, borderRadius: 7, padding: "6px 8px", fontSize: 12, marginBottom: 7 }}>
                {pool.map((a) => <option key={a} value={a}>{a.replace(/_/g, " ")}</option>)}
              </select>
              {/* player picks from the selected games */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {players.length === 0 && <span style={{ fontSize: 11, color: C.dim }}>Pick a game above to load players.</span>}
                {players.map((p) => {
                  const sel = l.playerNames.includes(p.name);
                  return (
                    <button key={p.name} onClick={() => togglePlayer(l.id, p.name)} style={chip(sel)}>
                      {p.name} <span style={{ color: C.dim, fontSize: 10 }}>{p.team}</span>
                    </button>
                  );
                })}
              </div>
              {/* §1.2 — mandatory display CONTEXT, from the live feed (game line + season avg + last-out),
                  not typed. Populates when players are picked. */}
              <div data-leg-context style={{ marginTop: 7, display: "flex", flexDirection: "column", gap: 3 }}>
                {(legContext[l.id] ?? []).length === 0 && (
                  <span style={{ fontSize: 11, color: C.dim }}>Pick players to load the feed context (season avg · last-out).</span>
                )}
                {l.context.matchupNote && l.context.matchupNote !== "-" && (legContext[l.id] ?? []).length > 0 && (
                  <span style={{ fontSize: 10.5, color: C.gold, fontWeight: 700 }}>{l.context.matchupNote}</span>
                )}
                {(legContext[l.id] ?? []).map((pc) => (
                  <span key={pc.playerId} data-ctx-row style={{ fontSize: 11, color: C.dim }}>
                    <b style={{ color: C.grey }}>{pc.name}</b> — {pc.seasonAverage} · {pc.last3Form}
                  </span>
                ))}
              </div>
              {/* Lockpick flag */}
              <div style={{ marginTop: 8, fontSize: 11.5, padding: "7px 9px", borderRadius: 7, lineHeight: 1.45,
                background: ok ? "rgba(93,202,165,.10)" : "rgba(224,67,44,.13)", color: ok ? C.ok : "#ffb3a5",
                borderLeft: `3px solid ${ok ? C.ok : C.bad}` }}>
                {v?.message}
              </div>
            </div>
          );
        })}
        <button onClick={() => setLegs((ls) => [...ls, newLeg(ls.length)])}
          style={{ background: "none", border: `1px solid ${C.edge}`, color: C.dim, borderRadius: 7, padding: "5px 9px", fontSize: 11.5, cursor: "pointer" }}>
          + Add a question
        </button>
      </div>

      {/* reach */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.panel2, border: `1px solid ${C.edge}`, borderRadius: 10, padding: "10px 12px" }}>
        <span style={{ font: "600 22px Georgia, serif", color: C.gold, lineHeight: 1 }}>{canPublish ? cashReach : 0}</span>
        <span style={{ flex: 1, fontSize: 11.5, color: C.dim, lineHeight: 1.4 }}>
          {canPublish
            ? `states can play this slate for cash (coins reach all ${totalStates}). Restricted states use the tighter question set automatically.`
            : "Every question must span two different games before this slate can reach any state."}
        </span>
      </div>

      {/* 3 · The pot */}
      <div style={card}>
        <h2 style={h2}>3 · The pot</h2>
        <PotRow label="Stakes you allow">
          <span style={{ display: "flex", gap: 5, flexWrap: "wrap", flex: 1 }}>
            {ALL_STAKES.map((v) => (
              <button key={v} onClick={() => toggleStake(v)} style={chip(stakes.includes(v))}>${v}</button>
            ))}
          </span>
        </PotRow>
        <PotRow label="Your division">
          <select value={division} onChange={(e) => setDivision(e.target.value as Division)} style={selStyle}>
            {DIVISIONS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
        </PotRow>
        <PotRow label="Target pot">
          <input type="number" value={targetPot} min={0} step={5000} onChange={(e) => setTargetPot(Math.max(0, +e.target.value || 0))} style={selStyle} />
        </PotRow>
        <PotRow label="Your host fee">
          <select value={hostFee} onChange={(e) => setHostFee(+e.target.value)} style={selStyle}>
            {HOST_FEE_TIERS.map((t) => <option key={t} value={t}>${t}</option>)}
          </select>
        </PotRow>
        <PotRow label="Entries so far">
          <input type="range" min={0} max={120000} step={500} value={entries} onChange={(e) => setEntries(+e.target.value)} style={{ flex: 1, accentColor: C.orange }} />
        </PotRow>

        <div style={{ background: C.panel2, border: `1px solid ${C.gold}80`, borderRadius: 10, padding: 12, textAlign: "center", margin: "6px 0 8px" }}>
          <div style={{ font: "600 30px Georgia, serif", color: C.gold, lineHeight: 1 }}>${netNow.toLocaleString()}</div>
          <div style={{ fontSize: 10.5, letterSpacing: ".16em", textTransform: "uppercase", color: C.dim, margin: "5px 0 9px" }}>in the pot · grows with every entry</div>
          <div style={{ height: 7, background: "#0b0f14", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, transition: "width .25s",
              background: netNow >= targetPot && targetPot > 0 ? `linear-gradient(90deg,${C.gold},#fff2c9)` : `linear-gradient(90deg,${C.orange},${C.gold})` }} />
          </div>
          <div style={{ fontSize: 11.5, color: C.dim, marginTop: 8, lineHeight: 1.5 }}>
            {targetPot > 0
              ? `${entries.toLocaleString()} entries · ${Math.round(pct)}% of your $${targetPot.toLocaleString()} target`
              : `${entries.toLocaleString()} entries · no target set`}
          </div>
          <div style={{ fontSize: 11.5, lineHeight: 1.5, marginTop: 9, paddingTop: 9, borderTop: "1px solid #24303c", color: C.dim }}>
            At <b style={{ color: C.grey }}>{pj.name}</b> ({pj.followers >= 1e6 ? `${pj.followers / 1e6}M` : `${pj.followers / 1000}K`} followers) slates like this usually draw{" "}
            <b style={{ color: C.grey }}>{pj.entriesLo.toLocaleString()}–{pj.entriesHi.toLocaleString()}</b> entries, landing a pot of{" "}
            <b style={{ color: C.grey }}>${pj.potLo.toLocaleString()}–${pj.potHi.toLocaleString()}</b>.
            <span style={{ display: "block", marginTop: 4, fontSize: 11, color: potVerdict(targetPot, pj).color }}>{potVerdict(targetPot, pj).text}</span>
          </div>
        </div>

        <Sect>What you earn</Sect>
        <table style={tableStyle}>
          <thead><tr><Th>Entries</Th><Th r>Host fees</Th><Th r>Your cut</Th><Th r>You keep</Th></tr></thead>
          <tbody>
            {earnRows.map((row) => (
              <tr key={row.n} style={row.now ? { background: "rgba(252,62,1,.10)" } : undefined}>
                <Td first={row.now}>{row.n.toLocaleString()}</Td>
                <Td r>${row.gross.toLocaleString()}</Td>
                <Td r>{(row.cut * 100).toFixed(0)}%</Td>
                <Td r color={C.ok}>${row.keep.toLocaleString()}</Td>
              </tr>
            ))}
          </tbody>
        </table>

        <Sect>How wagers pay</Sect>
        <table style={tableStyle}>
          <thead><tr><Th>Wager</Th><Th r>Weight in the pot</Th></tr></thead>
          <tbody>
            {stakes.length === 0 && <tr><Td>—</Td><Td r color={C.dim}>Allow at least one stake.</Td></tr>}
            {stakes.map((w) => (
              <tr key={w}><Td>${w}</Td><Td r>{(avg ? w / avg : 0).toFixed(2)}× the average entry</Td></tr>
            ))}
          </tbody>
        </table>

        <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.5, marginTop: 8 }}>
          One pot per slate. Players wager what they want; <b style={{ color: C.warn }}>payout scales with what you put up</b> and whether you were right.
          The pot converts on the house economy — you can&apos;t change it, only post it. The one number that&apos;s yours is the <b style={{ color: C.warn }}>host fee</b>.
          Your cut of it slides as the pot grows, capped at ${CREATOR_CUT_CAP_DOLLARS.toLocaleString()} a slate. Cut-slide points and host-fee tiers are <b style={{ color: C.warn }}>architect-set</b> placeholders.
        </div>
        <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.5, marginTop: 8 }}>
          Right now: {entries.toLocaleString()} entries × ${hostFee} host fee = ${feeGross.toLocaleString()} in fees, and you keep <b style={{ color: C.ok }}>${feeKeep.toLocaleString()}</b>.
        </div>
      </div>

      {!canHostCash && (
        <div style={{ fontSize: 11.5, color: C.warn, lineHeight: 1.5, padding: "8px 10px", border: `1px solid ${C.warn}66`, borderRadius: 8 }}>
          {cashBlockReason ?? "Cash hosting isn't available in your state."} You can still post this slate for coin play.
        </div>
      )}
      {error && <div style={{ fontSize: 12, color: "#ffb3a5", background: "rgba(224,67,44,.13)", borderLeft: `3px solid ${C.bad}`, padding: "8px 10px", borderRadius: 7 }}>{error}</div>}

      <button onClick={onPublish} disabled={!canSubmit}
        style={{ width: "100%", padding: 13, borderRadius: 10, border: `1px solid ${C.gold}`, font: "600 15px Georgia, serif", letterSpacing: ".04em",
          cursor: canSubmit ? "pointer" : "not-allowed", background: canSubmit ? C.orange : "#2a2f38", color: canSubmit ? "#fff" : C.dim,
          borderColor: canSubmit ? C.gold : C.edge }}>
        {publishing ? "Publishing…" : "Publish slate"}
      </button>
      <div style={{ fontSize: 11, color: C.dim, textAlign: "center" }}>
        {canPublish ? (stakes.length ? "Every leg spans two games. Ready." : "Allow at least one stake to publish.") : "Fix the flagged questions to publish."}
      </div>
    </div>
  );
}

const selStyle: React.CSSProperties = { background: "#0A0D12", color: "#E7E7EB", border: "1px solid #232a35", borderRadius: 7, padding: "7px 9px", fontSize: 13, flex: 1, minWidth: 0 };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 8 };

function PotRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 7 }}>
      <label style={{ fontSize: 12, color: "#8B93A1", width: 96, flex: "none" }}>{label}</label>
      {children}
    </div>
  );
}
function Sect({ children }: { children: React.ReactNode }) {
  return <div style={{ font: "600 10.5px Georgia, serif", letterSpacing: ".14em", textTransform: "uppercase", color: "#F0C463", margin: "12px 0 2px" }}>{children}</div>;
}
function Th({ children, r }: { children: React.ReactNode; r?: boolean }) {
  return <th style={{ textAlign: r ? "right" : "left", fontWeight: 400, color: "#8B93A1", fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase", padding: "0 0 5px", borderBottom: "1px solid #232a35" }}>{children}</th>;
}
function Td({ children, r, first, color }: { children: React.ReactNode; r?: boolean; first?: boolean; color?: string }) {
  return <td style={{ padding: "6px 0", borderBottom: "1px solid #1b212a", fontVariantNumeric: "tabular-nums", textAlign: r ? "right" : "left", color, boxShadow: first ? "inset 3px 0 0 #FC3E01" : undefined }}>{children}</td>;
}
function potVerdict(target: number, pj: { potLo: number; potHi: number }): { text: string; color: string } {
  if (!target) return { text: "Set a target and I'll tell you if it's realistic.", color: "#8B93A1" };
  if (target > pj.potHi) return { text: `That's a stretch at your following — expect the meter to stall around $${pj.potHi.toLocaleString()}.`, color: "#EF9F27" };
  if (target < pj.potLo) return { text: `You're aiming low — slates like this usually clear $${pj.potLo.toLocaleString()} on their own.`, color: "#5DCAA5" };
  return { text: "Right in range for your following.", color: "#F0C463" };
}
