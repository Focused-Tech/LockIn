"use client";

/**
 * CREATOR HUB + 4-STEP BUILDER — ported to the v2 spec
 * public/design/Creator Builder/creator_builder_v2.html
 * (sha256 82128b3e1fb88fa3febbea7344a6a04089c4154cb7f740eb8fdb9e69796c5270). The FILE is canon: same
 * tags, class names, ids, nesting, order, copy. CASH creator mode only — no coin balance, no coin
 * price, no free toggle, and the string "rake" never renders. Practice is a LINK OUT to its own
 * surface; it never mounts a builder here. Styles: ./creator-builder.css (ported verbatim).
 *
 * The hub is the entry; the builder is ONE of six views. Chrome (progress bar, step labels, footer,
 * Save & exit) shows ONLY inside the builder. The Locksmith FAB hides inside the Lockpick view.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import "./creator-builder.css";

// Addendum C/D — the existing creator DASHBOARD is RE-PARENTED under the hub as a seventh view. Its
// markup is passed in verbatim (frozen); the hub's identity strip (#who) is its tap target.
type View = "hub" | "rules" | "how" | "lockpick" | "practice" | "profile" | "dashboard" | "builder";
const SUB: Record<Exclude<View, "builder">, string> = { hub: "p0", rules: "pRules", how: "pHow", lockpick: "pPick", practice: "pPrac", profile: "pProf", dashboard: "pDash" };

/** Real creator stats for the identity strip + creator profile (from fetchCreatorDashboard). */
export interface CreatorMeta {
  name: string;
  handle: string;
  verified: boolean;
  memberSince: string | null;
  /** null when there is no verified-reach source yet (honest empty). */
  reach: number | null;
  division: string | null;
  earnedCents: number;
  contests: number;
  entries: number;
  bestContestCents: number;
  payoutsConnected: boolean;
}

/** Compact notation: full under 1,000, then k with one decimal dropped when it is noise
 *  (124k not 124.0k), then M. Matches creator_builder_v2.html compact(). */
function compact(v: number): string {
  const a = Math.abs(v);
  if (a < 1000) return String(v);
  if (a < 1e6) {
    const s = v / 1000;
    return (s >= 100 ? Math.round(s) : Math.round(s * 10) / 10) + "k";
  }
  const s = v / 1e6;
  return (s >= 100 ? Math.round(s) : Math.round(s * 10) / 10) + "M";
}
const MAX = 5;
const LABEL: Record<number, string> = { 1: "Next: pick the night", 2: "Next: write the questions", 3: "Next: set the prize", 4: "Review the slate", 5: "Publish slate" };
const EVENTS = ["Lakers at Celtics", "Denver vs Phoenix", "Milwaukee at Miami", "Golden State vs Sacramento", "New York at Indiana"];
const EV_TIME = ["7:10 pm", "8:00 pm", "8:30 pm", "10:00 pm", "10:30 pm"];
const ARCH_OPTS = ["Cross-game head-to-head", "Field leader", "Split-squad duos", "Milestone count", "First to N", "Biggest night"];
// Lockpick canned answers — each NAMES THE FIX (never just "invalid"). Verbatim from the spec.
const ANSWERS: Record<string, { q: string; a: string }> = {
  same: { q: "Why can't two names share a game?", a: "Because then you are asking who wins that game with extra steps. Two names has to mean <b>two different games</b>. If you want Tatum, pair him with someone from another game — Giannis in Milwaukee at Miami." },
  ctx: { q: "What context do I have to show?", a: "Every option carries the game line, the season average and last-out form. What it <b>cannot</b> carry is the thing you are asking about — context sets the argument up, it never gives the answer away." },
  fee: { q: "How does my host fee work?", a: "It is charged on top of the entry, per player, and your division sets the tier you can pick from. It is the only number on the slate you control — the pot itself is the players'." },
};

interface Msg { role: "them" | "me"; html: string }

export function CreatorBuilder({ dashboard, creator }: { dashboard?: ReactNode; creator?: CreatorMeta } = {}) {
  const c: CreatorMeta = creator ?? {
    name: "Creator", handle: "", verified: false, memberSince: null, reach: null,
    division: null, earnedCents: 0, contests: 0, entries: 0, bestContestCents: 0, payoutsConnected: false,
  };
  const initial = (c.name || "C").charAt(0).toUpperCase();
  const avgEntries = c.contests > 0 ? Math.round(c.entries / c.contests) : 0;
  const router = useRouter();
  const [view, setView] = useState<View>("hub");
  const [step, setStep] = useState(1);
  const [evOn, setEvOn] = useState<boolean[]>([true, true, true, false, false]);
  const [leg2Fixed, setLeg2Fixed] = useState(false);
  const [thread, setThread] = useState<Msg[]>([
    { role: "them", html: "Ask me anything about building a slate — or paste a question and I'll tell you whether it passes." },
    { role: "me", html: "Who wins Lakers at Celtics?" },
    { role: "them", html: "<b>That one can't run.</b> Game outcomes are out — no winners, scores, margins or spreads. Ask who <b>shows out</b> instead: Luka against a name from a different game, like Jokić in Denver vs Phoenix." },
  ]);
  const [askUsed, setAskUsed] = useState<Record<string, boolean>>({});
  const [cat, setCat] = useState("NBA");
  const [stakes, setStakes] = useState<Record<string, boolean>>({ "$5": true, "$10": true, "$25": true, "$50": false });
  const [fee, setFee] = useState("$2");
  const [pracNote, setPracNote] = useState(false);
  const [pracDisabled, setPracDisabled] = useState(false);
  const [query, setQuery] = useState("");

  const inB = view === "builder";
  const evCount = evOn.filter(Boolean).length;
  const bad = step === 3 && !leg2Fixed ? 1 : 0;
  const nextDisabled = (step === 3 && bad > 0) || (step === 2 && evCount < 2);
  const nextLabel = step === 3 && bad > 0 ? `Fix ${bad} leg${bad > 1 ? "s" : ""} to continue` : LABEL[step];

  // test handle (reads only) — the gate drives via REAL clicks and reads state from here + the DOM.
  const viewRef = useRef(view), stepRef = useRef(step);
  viewRef.current = view; stepRef.current = step;
  useEffect(() => {
    (window as unknown as { __cb: unknown }).__cb = {
      get step() { return stepRef.current; },
      get view() { return viewRef.current; },
      MAX,
      fixLeg2: () => setLeg2Fixed(true),
    };
  }, []);

  const go = (v: Exclude<View, "builder">) => setView(v);
  const enterBuilder = () => { setStep(1); setView("builder"); };
  const paneOn = (id: string) => (inB ? id === `p${step}` : id === SUB[view as Exclude<View, "builder">]);

  const onNext = () => { if (nextDisabled) return; if (step < MAX) setStep(step + 1); };
  const onBack = () => { if (step > 1) setStep(step - 1); else go("hub"); };

  const ask = (k: string) => {
    const A = ANSWERS[k]; if (!A || askUsed[k]) return;
    setAskUsed((u) => ({ ...u, [k]: true }));
    const idx = thread.length + 1; // index of the pending "them" bubble
    setThread((t) => [...t, { role: "me", html: A.q }, { role: "them", html: "…" }]);
    setTimeout(() => setThread((t) => t.map((m, i) => (i === idx ? { role: "them", html: A.a } : m))), 420);
  };

  return (
    <div className="cb-root" data-mode="cash">
      {/* ── header + progress ── */}
      <div id="hd">
        <div className="t"><b id="hdTitle">{inB ? "Build a slate" : "Creator"}</b>
          <button className="x" id="exit" style={{ display: inB ? "" : "none" }} onClick={() => go("hub")}>Save &amp; exit</button></div>
        <div id="bar" style={{ display: inB ? "flex" : "none" }}>
          {[1, 2, 3, 4].map((k) => (
            <div key={k} className={`seg${inB && k < Math.min(step, 5) ? " done" : ""}${inB && k === step ? " now" : ""}`} data-s={k} />
          ))}
        </div>
        <div id="steps" style={{ display: inB ? "flex" : "none" }}>
          {[[1, "1 · Profile"], [2, "2 · Event"], [3, "3 · Questions"], [4, "4 · Prize"]].map(([k, t]) => (
            <span key={k as number} className={inB && (k as number) === Math.min(step, 4) ? "on" : undefined} data-s={k as number}>{t}</span>
          ))}
        </div>
      </div>

      <div id="body">

        {/* ══ HUB ══ */}
        <div className={`pane${paneOn("p0") ? " on" : ""}`} id="p0">
          <div id="hero">
            {/* the "Creator" eyebrow was a DUPLICATE of the header title (#hdTitle) — removed; the top
                header is the single creator identifier (architect ruling). */}
            <h1>Run your own slate</h1>
            <p>Real followers, real pot, real payout. Write the questions your people argue about, set the prize, and put your name on the card.</p>
            {/* Addendum D — the identity strip is the tap target for the dashboard; a chevron (matching
                the tiles) makes it read as tappable. Same panel styling — NOT restyled into a tile. */}
            <div id="who" role="button" tabIndex={0} style={{ cursor: "pointer" }} onClick={() => go("profile")}>
              <div className="av">{initial}</div>
              <div className="n"><b>{c.name}</b><span>
                {c.reach != null ? `${compact(c.reach)} reach` : "reach not set"}
                {" · "}<i style={{ fontStyle: "normal", color: "var(--cash)" }}>${compact(Math.round(c.earnedCents / 100))}</i> earned
              </span></div>
              {c.division && <div className="dv">{c.division}</div>}
              <div id="cashtag">Cash</div>
              <div className="cv">›</div>
            </div>
          </div>
          <button className="gobig" id="goBuild" onClick={enterBuilder}>Build a slate</button>
          <div className="tiles">
            <button className="tile" id="goRules" onClick={() => go("rules")}><div className="ic">§</div>
              <div className="n"><b>Read the rules</b><span>What a question can ask, and what is never allowed</span></div><div className="cv">›</div></button>
            <button className="tile" id="goHow" onClick={() => go("how")}><div className="ic">◷</div>
              <div className="n"><b>How to become a creator</b><span>Five steps from connecting an account to publishing</span></div><div className="cv">›</div></button>
            <button className="tile creatorish" id="goPick" onClick={() => go("lockpick")}><div className="ic">⚿</div>
              <div className="n"><b>Talk to the Locksmith</b><span>Ask her anything — her lockpicks name the fix before you write it</span></div><div className="cv">›</div></button>
            <button className="tile creatorish" id="goPrac" onClick={() => go("practice")}><div className="ic">◇</div>
              <div className="n"><b>Practice mode</b><span>The Lone Fox journey — the coin version of this, on its own screens</span></div><div className="cv">›</div></button>
          </div>
        </div>

        {/* ══ RULES ══ */}
        <div className={`pane${paneOn("pRules") ? " on" : ""}`} id="pRules">
          <div className="crumb"><button className="home" onClick={() => go("hub")}>‹ Creator</button></div>
          <h2>The rules</h2>
          <p className="hint">Every slate runs the same validator — the currency does not change what you are allowed to ask.</p>
          <div className="blk">
            <div className="lb">What a question can ask <i></i></div>
            <div className="rule"><span className="m yes">✓</span><span><b>Cross-game head-to-head.</b> Two names, two different games. Who has the bigger night.</span></div>
            <div className="rule"><span className="m yes">✓</span><span><b>Field leader.</b> Who tops a field drawn from several games.</span></div>
            <div className="rule"><span className="m yes">✓</span><span><b>Split-squad duos.</b> Two pairs, pulled from different games.</span></div>
            <div className="rule"><span className="m yes">✓</span><span><b>Milestone count.</b> How many players clear a milestone tonight — bucketed, never a number on one player.</span></div>
            <div className="rule"><span className="m yes">✓</span><span><b>First to N.</b> Who gets there first across the night.</span></div>
            <div className="rule"><span className="m yes">✓</span><span><b>Biggest night.</b> The standout performance of the slate.</span></div>
          </div>
          <div className="blk">
            <div className="lb">Never allowed <i></i></div>
            <div className="rule"><span className="m no">✕</span><span>Who wins a game, final scores, margins, spreads, team totals, over/under on anything.</span></div>
            <div className="rule"><span className="m no">✕</span><span>Any number threshold on one player, and any question that lives inside a single game.</span></div>
            <div className="rule"><span className="m no">✕</span><span>Halftime or period outcomes. Fight and race winners.</span></div>
            <div className="rule"><span className="m no">✕</span><span><b>Two names from the same game.</b> Two names means two different games — every time.</span></div>
          </div>
          <div className="blk">
            <div className="lb">On every leg <i></i></div>
            <div className="rule"><span className="m yes">✓</span><span>Each option carries the game line, the season average and last-out form. <b>Context is never the thing being predicted.</b></span></div>
            <div className="rule"><span className="m yes">✓</span><span>A slate draws across archetypes. <b>No question shape repeats on one slate.</b></span></div>
            <div className="rule"><span className="m yes">✓</span><span>Write the argument real fans have. Who shows out — not who wins.</span></div>
          </div>
          <div className="blk">
            <div className="lb">The pot <i></i></div>
            <div className="rule"><span className="m yes">✓</span><span><b>One pot per slate.</b> Players wager what they want; what they collect follows their stake and how much they got right.</span></div>
            <div className="rule"><span className="m yes">✓</span><span>Payouts are projected while the slate is open and <b>become fixed the moment it closes</b> — which happens before the event starts.</span></div>
          </div>
          <button className="gobig home2" onClick={enterBuilder}>Got it — build a slate</button>
        </div>

        {/* ══ HOW ══ */}
        <div className={`pane${paneOn("pHow") ? " on" : ""}`} id="pHow">
          <div className="crumb"><button className="home" onClick={() => go("hub")}>‹ Creator</button></div>
          <h2>How to become a creator</h2>
          <p className="hint">Five steps. The first one is the only one you do once.</p>
          <div className="blk">
            <div className="num"><div className="k">1</div><div className="n"><b>Connect the accounts you post from</b><span>We read your public follower count and nothing else. No personal information, no messages, no contacts.</span></div></div>
            <div className="num"><div className="k">2</div><div className="n"><b>Your reach sets your division</b><span>The division sets your host fee tier, and it moves as your reach grows.</span></div></div>
            <div className="num"><div className="k">3</div><div className="n"><b>Pick the night</b><span>Choose a category and a date. The events load from the live board — you never leave the app to find a schedule.</span></div></div>
            <div className="num"><div className="k">4</div><div className="n"><b>Write the questions</b><span>The Locksmith drafts them from the games you picked. Edit any of them; Lockpick flags anything that would not pass <b>and names the fix</b>.</span></div></div>
            <div className="num"><div className="k">5</div><div className="n"><b>Set the prize and publish</b><span>Your host fee is the only number you control. Review the card exactly as a player sees it, then publish.</span></div></div>
          </div>
          <div className="blk creator">
            <div className="lb">Before your first one <i></i></div>
            <p className="hint">Never run a slate before? Build one end to end in practice first. Nothing publishes and no money moves.</p>
            <div className="chips" style={{ marginTop: 10 }}>
              <button className="chip" id="howToPrac" onClick={() => go("practice")}>Practice mode ›</button>
              <button className="chip" id="howToRules" onClick={() => go("rules")}>Read the rules ›</button>
            </div>
          </div>
          <button className="gobig home2" onClick={enterBuilder}>Start building</button>
        </div>

        {/* ══ LOCKPICK ══ */}
        <div className={`pane${paneOn("pPick") ? " on" : ""}`} id="pPick">
          <div className="crumb"><button className="home" onClick={() => go("hub")}>‹ Creator</button></div>
          <h2>The Locksmith</h2>
          <p className="hint">She reads your slate while you write it and never says &quot;invalid&quot; — every tip she hands you is a <b style={{ color: "#fff" }}>lockpick</b>: the fix, named.</p>
          <div className="blk creator" id="lsHero">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img id="lsImg" src="/foxpit/locksmith/locksmith_desk.png" alt="The Locksmith at her desk" />
          </div>
          <div className="blk creator">
            <div id="thread">
              {thread.map((m, i) => <div key={i} className={`msg ${m.role}`} dangerouslySetInnerHTML={{ __html: m.html }} />)}
            </div>
            <div className="chips" style={{ marginTop: 12 }} id="askChips">
              <button className="chip" data-a="same" disabled={askUsed.same} style={askUsed.same ? { opacity: 0.45 } : undefined} onClick={() => ask("same")}>Why can&apos;t two names share a game?</button>
              <button className="chip" data-a="ctx" disabled={askUsed.ctx} style={askUsed.ctx ? { opacity: 0.45 } : undefined} onClick={() => ask("ctx")}>What context do I have to show?</button>
              <button className="chip" data-a="fee" disabled={askUsed.fee} style={askUsed.fee ? { opacity: 0.45 } : undefined} onClick={() => ask("fee")}>How does my host fee work?</button>
            </div>
          </div>
          <button className="gobig home2" onClick={enterBuilder}>Take me to the builder</button>
        </div>

        {/* ══ PRACTICE ══ (link OUT — never mounts a builder here) */}
        <div className={`pane${paneOn("pPrac") ? " on" : ""}`} id="pPrac">
          <div className="crumb"><button className="home" onClick={() => go("hub")}>‹ Creator</button></div>
          <h2>Practice mode</h2>
          <p className="hint">The Lone Fox journey. The same four steps, the same validator, the same review card — <b style={{ color: "#fff" }}>run on coins</b>.</p>
          <div className="sep"><b>It is its own build, not this one.</b> This screen is cash creator mode: real reach, a real pot, a real payout. Practice runs on the coin economy and lives on its own screens.</div>
          <div className="blk creator">
            <div className="rule"><span className="m yes">✓</span><span>Same four steps, same questions, same review card.</span></div>
            <div className="rule"><span className="m yes">✓</span><span>The Locksmith flags your legs exactly the way she does here.</span></div>
            <div className="rule"><span className="m yes">✓</span><span>Coins throughout — every number a coin number.</span></div>
            <div className="rule"><span className="m no">✕</span><span>Nothing publishes. No player sees it, and no cash moves.</span></div>
          </div>
          {/* §1d — a practice-creator route exists (/app/practice/create): the CTA navigates there. */}
          <button className="outlink" id="startPrac" disabled={pracDisabled} style={pracDisabled ? { opacity: 0.5 } : undefined}
            onClick={() => { setPracNote(true); setPracDisabled(true); router.push("/app/practice/create"); }}>Open practice mode ›</button>
          <p className="hint" id="pracNote" style={{ display: pracNote ? "" : "none" }}>Practice mode is a separate surface — its own screens.</p>
          <button className="gobig home2" onClick={enterBuilder}>Back to cash creator mode</button>
        </div>

        {/* ══ CREATOR PROFILE ══ — the identity strip's destination (NOT the player profile). */}
        <div className={`pane${paneOn("pProf") ? " on" : ""}`} id="pProf">
          <div className="crumb"><button className="home" onClick={() => go("hub")}>‹ Creator</button></div>
          <div className="blk">
            <div id="phd">
              <div className="av">{initial}</div>
              <div className="n"><b>{c.name}</b>
                <span>{c.handle ? `@${c.handle} · ` : ""}{c.verified ? "Verified creator" : "Creator"}</span>
                {c.memberSince && <span>Creator since {c.memberSince}</span>}</div>
            </div>
            {c.division && <div style={{ margin: "12px 0 0" }}><span className="badge div">{c.division}</span></div>}
          </div>

          <div className="blk">
            <div className="lb">Creator stats <i></i></div>
            <div className="grid">
              <div className="stat"><div className="k">Contests hosted</div><div className="v">{compact(c.contests)}</div></div>
              <div className="stat"><div className="k">Total entries</div><div className="v">{compact(c.entries)}</div></div>
              <div className="stat"><div className="k">Verified reach</div><div className="v">{c.reach != null ? compact(c.reach) : "—"}</div></div>
              <div className="stat"><div className="k">Avg entries</div><div className="v">{avgEntries ? compact(avgEntries) : "—"}</div></div>
              <div className="stat"><div className="k">Lifetime earned</div><div className="v cash">${compact(Math.round(c.earnedCents / 100))}</div></div>
              <div className="stat"><div className="k">Best contest</div><div className="v cash">{c.bestContestCents > 0 ? `$${compact(Math.round(c.bestContestCents / 100))}` : "—"}</div></div>
            </div>
          </div>

          <div className="blk money">
            <div className="lb">Payouts <i></i></div>
            <button className="row" style={{ paddingTop: 4 }} onClick={() => go("dashboard")}>
              <div className="n"><b>{c.payoutsConnected ? "Connected" : "Set up payouts"}</b>
                <span>{c.payoutsConnected ? "Earnings land in your account automatically" : "Connect an account to receive earnings"}</span></div>
              <div className="cv">›</div></button>
          </div>

          <div className="blk">
            <div className="lb">Creator tools <i></i></div>
            <button className="row" id="toDash" onClick={() => go("dashboard")}>
              <div className="n"><b>Creator dashboard</b><span>Your contests &amp; earnings</span></div><div className="cv">›</div></button>
            <button className="row" onClick={enterBuilder}>
              <div className="n"><b>New contest</b><span>Build a slate from step one</span></div><div className="cv">›</div></button>
            <button className="row" onClick={() => go("rules")}>
              <div className="n"><b>The rules</b><span>What a question can ask</span></div><div className="cv">›</div></button>
          </div>

          <div className="blk">
            <div className="lb">Account <i></i></div>
            <a className="row" href="/app/wallet"><div className="n"><b>Wallet</b><span>Balance, deposits &amp; withdrawals</span></div><div className="cv">›</div></a>
            <a className="row" href="/app/refer"><div className="n"><b>Refer</b><span>Invite friends, earn rewards</span></div><div className="cv">›</div></a>
            <a className="row" href="/app/responsible-play"><div className="n"><b>Responsible play</b><span>Deposit limits &amp; self-exclusion</span></div><div className="cv">›</div></a>
          </div>

          <a id="signout" href="/app/profile" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>Player profile ›</a>
        </div>

        {/* ══ DASHBOARD (re-parented, FROZEN markup passed in as a prop) ══
            Late addendum: the dashboard's "+ New contest" (an <a href="/app/creator"> in the frozen
            markup) mounts the BUILDER ON STEP 1 DIRECTLY — it does NOT pass through the hub. Intercept
            those clicks here call enterBuilder(); the dashboard markup itself is untouched. */}
        <div
          className={`pane${paneOn("pDash") ? " on" : ""}`}
          id="pDash"
          onClickCapture={(e) => {
            const a = (e.target as HTMLElement).closest?.('a[href="/app/creator"]');
            if (a) { e.preventDefault(); enterBuilder(); }
          }}
        >
          <div className="crumb"><button className="home" onClick={() => go("hub")}>‹ Creator</button></div>
          {dashboard}
        </div>

        {/* ══ STEP 1 ══ */}
        <div className={`pane${paneOn("p1") ? " on" : ""}`} id="p1">
          <h2>Confirm your reach</h2>
          <p className="hint">Connect the accounts you post from. We read your public follower count and nothing else — no personal information, no messages, no contacts.</p>
          <div className="blk creator">
            <div className="lb">Accounts <i></i></div>
            <div className="soc" data-net="x"><div className="ic">𝕏</div><div className="n"><b>X</b><span className="v">Connected · 128,400 followers</span></div><button className="done">Connected</button></div>
            <div className="soc" data-net="ig"><div className="ic">◎</div><div className="n"><b>Instagram</b><span className="v">Connected · 96,200 followers</span></div><button className="done">Connected</button></div>
            <div className="soc" data-net="tt"><div className="ic">♪</div><div className="n"><b>TikTok</b><span>Not connected</span></div><button>Connect</button></div>
            <div className="soc" data-net="yt"><div className="ic">▶</div><div className="n"><b>YouTube</b><span>Not connected</span></div><button>Connect</button></div>
            <div className="reach"><span className="hint">Verified reach</span><span className="big" id="reachN">224,600</span><span className="dv" id="divN">Wolf</span></div>
          </div>
          <div className="blk">
            <div className="lb">Display name <i></i></div>
            <input type="text" id="handle" defaultValue="Quill" placeholder="How players see you" />
            <p className="hint" style={{ marginTop: 9 }}>Your division sets your host fee tier. It moves as your verified reach grows.</p>
          </div>
          <button id="prac" onClick={() => go("practice")}>Never run one before? Practice in the Lone Fox journey first ›</button>
        </div>

        {/* ══ STEP 2 ══ */}
        <div className={`pane${paneOn("p2") ? " on" : ""}`} id="p2">
          <h2>Pick the night</h2>
          <p className="hint">Choose a category and a date. The events load from the live board — you never leave the app to find a schedule.</p>
          <div className="blk">
            <div className="lb">Category <i></i></div>
            <div className="chips" id="cats">
              {["NBA", "NFL", "MLB", "WNBA", "Soccer", "Reality TV", "Music"].map((c) => (
                <button key={c} className={`chip${cat === c ? " on" : ""}`} onClick={() => setCat(c)}>{c}</button>
              ))}
            </div>
          </div>
          <div className="blk">
            <div className="lb">Date <i></i></div>
            <input type="date" id="dt" defaultValue="2026-08-04" />
          </div>
          <div className="blk" id="evBlk">
            <div className="lb">Events that night <i></i><span id="evCount" style={{ color: "var(--creator)" }}>{evCount} picked</span></div>
            {EVENTS.map((e, i) => (
              <div key={e} className={`ev${evOn[i] ? " on" : ""}`} onClick={() => setEvOn((a) => a.map((v, j) => (j === i ? !v : v)))}>
                <div className="bx">✓</div><div className="n"><b>{e}</b><span>{EV_TIME[i]}</span></div>
              </div>
            ))}
          </div>
          <p className="hint">Slate closes at the earliest tip — <b style={{ color: "#fff" }}>7:10 pm</b>.</p>
        </div>

        {/* ══ STEP 3 ══ */}
        <div className={`pane${paneOn("p3") ? " on" : ""}`} id="p3">
          <h2>Write the questions</h2>
          <p className="hint">The Locksmith drafts them from the games you picked. Edit any of them — she flags anything that would not pass.</p>
          <div className="blk">
            <div className="lb">Player pool <i></i></div>
            <input type="text" id="search" placeholder="Search a name, show, or character…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <div className="pool" id="pool" style={{ marginTop: 10 }}>
              {[["★", "Luka", "Lakers · 32 a night"], ["★", "Jokić", "Denver · 26·12·9"], ["★", "Giannis", "Milwaukee · 31 a night"], ["", "Tatum", "Celtics · 27 a night"], ["", "Booker", "Phoenix · 27 a night"], ["", "Adebayo", "Miami · 19 a night"]].map(([s, n, m]) => (
                <button key={n} className="ath" style={{ display: (n + " " + m).toLowerCase().includes(query.toLowerCase()) ? "" : "none" }}>
                  <b>{s ? <span className="star">★</span> : null}{s ? " " : ""}{n}</b><span>{m}</span></button>
              ))}
            </div>
            <p className="hint" style={{ marginTop: 8 }}>Stars and starters first. Type to find anyone else.</p>
          </div>

          <div className="leg good" id="leg1">
            <div className="arch"><span className="lb" style={{ margin: 0 }}>Leg 1</span>
              <select defaultValue="Cross-game head-to-head">{ARCH_OPTS.map((o) => <option key={o}>{o}</option>)}</select></div>
            <input className="stem" defaultValue="Who has the bigger night?" />
            <div className="opts">
              <div className="opt"><div className="nm">Luka</div><div className="cx">Lakers at Celtics<br />32 a night · 41 last out</div></div>
              <div className="opt"><div className="nm">Jokić</div><div className="cx">Denver vs Phoenix<br />26 · 12 · 9 on the season</div></div>
            </div>
            <div className="flag good">✓ <span>Two names, two different games. Clean.</span></div>
          </div>

          <div className={`leg ${leg2Fixed ? "good" : "bad"}`} id="leg2">
            <div className="arch"><span className="lb" style={{ margin: 0 }}>Leg 2</span>
              <select defaultValue="Cross-game head-to-head">{ARCH_OPTS.map((o) => <option key={o}>{o}</option>)}</select></div>
            <input className="stem" defaultValue="Who leads the floor tonight?" />
            <div className="opts">
              <div className="opt"><div className="nm">Luka</div><div className="cx">Lakers at Celtics<br />32 a night</div></div>
              {leg2Fixed
                ? <div className="opt"><div className="nm">Giannis</div><div className="cx">Milwaukee at Miami<br />31 a night</div></div>
                : <div className="opt"><div className="nm">Tatum</div><div className="cx">Lakers at Celtics<br />27 a night</div></div>}
            </div>
            {leg2Fixed
              ? <div className="flag good">✓ <span>Two names, two different games. Clean.</span></div>
              : <div className="flag bad" onClick={() => setLeg2Fixed(true)}>✕ <span><b>Luka and Tatum are both in Lakers at Celtics.</b> Drop one, or swap Tatum for Giannis — Milwaukee at Miami.</span></div>}
          </div>

          <div className="blk creator">
            <div className="lb">Locksmith <i></i></div>
            <p className="hint">She can draft three more from the games you picked, or rewrite any leg you are not happy with.</p>
            <div className="chips" style={{ marginTop: 10 }}>
              <button className="chip" id="suggest">Suggest 3 more</button>
              <button className="chip">Rewrite leg 2</button>
              <button className="chip">Make it harder</button>
            </div>
          </div>

          <div className="blk">
            <div className="meter">
              <div className="row"><span>This slate reaches</span><span id="reachStates">{leg2Fixed ? "44 states" : "42 states"}</span></div>
              <div className="mbar"><i style={{ width: leg2Fixed ? "100%" : "84%" }} /></div>
              <p className="hint" style={{ marginTop: 8 }}>Fix leg 2 and it reaches <b style={{ color: "#fff" }}>44 states</b>.</p>
            </div>
          </div>
        </div>

        {/* ══ STEP 4 ══ */}
        <div className={`pane${paneOn("p4") ? " on" : ""}`} id="p4">
          <h2>Set the prize</h2>
          <p className="hint">Players wager what they want into one pot. Your host fee is the only number you control.</p>
          <div className="blk">
            <div className="lb">Target pot <i></i></div>
            <input type="text" id="target" defaultValue="$25,000" />
            <p className="hint" style={{ marginTop: 8 }}>A goal, not a guarantee. The meter keeps climbing past it.</p>
          </div>
          <div className="blk">
            <div className="lb">Entry stakes you allow <i></i></div>
            <div className="chips" id="stakes">
              {["$5", "$10", "$25", "$50"].map((s) => (
                <button key={s} className={`chip orange${stakes[s] ? " on" : ""}`} onClick={() => setStakes((p) => ({ ...p, [s]: !p[s] }))}>{s}</button>
              ))}
            </div>
          </div>
          <div className="blk creator">
            <div className="lb">Your host fee <i></i></div>
            <div className="chips" id="fee">
              {["$1", "$2", "$3"].map((f) => <button key={f} className={`chip${fee === f ? " on" : ""}`} onClick={() => setFee(f)}>{f}</button>)}
            </div>
            <div className="kv" style={{ marginTop: 12 }}><span>Charged on top of the entry</span><b>{fee}</b></div>
            <div className="kv"><span>Your cut at this pool size</span><b>38%</b></div>
          </div>
          <div className="blk">
            <div className="lb">If your reach converts <i></i></div>
            <table className="earn"><tbody>
              <tr><th>Entries</th><th>Host fees</th><th>You keep</th></tr>
              <tr><td>5,000</td><td>$10,000</td><td><b>$4,400</b></td></tr>
              <tr className="now"><td>12,500</td><td>$25,000</td><td><b>$9,500</b></td></tr>
              <tr><td>30,000</td><td>$60,000</td><td><b>$19,800</b></td></tr>
            </tbody></table>
            <p className="hint" style={{ marginTop: 9 }}>Wolf division · 10–25% of 224,600 followers. Your $25,000 target sits <b style={{ color: "#fff" }}>right in range</b>.</p>
          </div>
          <div className="blk">
            <div className="lb">What winners collect <i></i></div>
            <div className="kv"><span>Top 5 perfect cards, fastest in</span><b>25% of the pot</b></div>
            <div className="kv"><span>Next 45</span><b>10×</b></div>
            <div className="kv"><span>Everyone in the top 20%</span><b>1.5×</b></div>
            <p className="hint" style={{ marginTop: 9 }}>Projected while open. These become fact the moment the slate closes — before tip-off.</p>
          </div>
        </div>

        {/* ══ REVIEW ══ */}
        <div className={`pane${paneOn("p5") ? " on" : ""}`} id="p5">
          <h2>Ready to publish</h2>
          <p className="hint">This is exactly what a player sees.</p>
          <div className="preview" id="preview">
            <div className="eb">QUILL · WOLF</div>
            <div className="bdg">Cash · 44 states</div>
            <div className="ttl">Tuesday Night Three</div>
            <div className="sb">Three games · locks 7:10 pm</div>
            <div className="pleg"><div className="q">Who has the bigger night?</div>
              <div className="opts">
                <div className="opt"><div className="nm">Luka</div><div className="cx">Lakers at Celtics<br />32 a night · 41 last out</div></div>
                <div className="opt"><div className="nm">Jokić</div><div className="cx">Denver vs Phoenix<br />26 · 12 · 9 on the season</div></div>
              </div></div>
            <div className="pleg"><div className="q">Who leads the floor tonight?</div>
              <div className="opts">
                <div className="opt"><div className="nm">Luka</div><div className="cx">Lakers at Celtics<br />32 a night</div></div>
                <div className="opt"><div className="nm">Giannis</div><div className="cx">Milwaukee at Miami<br />31 a night</div></div>
              </div></div>
            <button className="cta">Lock in · $25</button>
          </div>
          <div className="blk">
            <div className="kv"><span>Target pot</span><b>$25,000</b></div>
            <div className="kv"><span>Host fee</span><b>$2 per entry</b></div>
            <div className="kv"><span>Reaches</span><span className="g">44 states</span></div>
            <div className="kv"><span>Closes</span><b>Tue 7:10 pm</b></div>
          </div>
        </div>

      </div>

      <div id="ft" style={{ display: inB ? "flex" : "none" }}>
        <button id="back" disabled={step === 1} style={{ visibility: step === 1 ? "hidden" : "visible" }} onClick={onBack}>Back</button>
        <button id="next" disabled={nextDisabled} onClick={onNext}>{nextLabel}</button>
      </div>
      <button id="ls" title="Ask the Locksmith" style={{ display: view === "lockpick" ? "none" : "" }} onClick={() => go("lockpick")}>🦊</button>
    </div>
  );
}
