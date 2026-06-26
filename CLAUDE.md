# LockIn — Skill-Based Prediction Contest Platform

## What This Is
LockIn is a creator-powered prediction contest platform. Influencers host prediction slates (events), their audience enters by picking outcomes, and winners split a prize pool. Pool-based model — NOT gambling, NOT a sportsbook. LockIn never bets against users.

## Current State
- index.html is the V5 interactive prototype (Creator Journey demo); HANDOFF.md is the full product/business source of truth
- Next.js 15 foundation is scaffolded (config, design system, constants, base UI, client setups). No feature pages yet — built incrementally.
- All business rules, payout math, and design decisions are finalized (see HANDOFF.md)

## Project Structure
- `src/app` — Next.js App Router pages and layouts
- `src/components` — React components; `src/components/ui` — base UI (Button, Card, Input, Pill)
- `src/lib/constants.ts` — ALL business rules. Single source of truth for money math. Import from here, never hardcode.
- `src/lib/types.ts` — shared domain types
- `src/lib/utils.ts` — `cn()`, `formatCents()`, `formatMultiple()`
- `src/lib/firebase` — `client.ts` (browser SDK: auth/db/storage), `admin.ts` (Admin SDK: `adminAuth/adminDb/adminStorage`), `session.ts` (verify session cookie → user/profile), `auth.ts` (client register/login/logout), `config.ts`, `types.ts` (Firestore doc interfaces + `COLLECTIONS`)
- `src/lib/categories.ts` — `CATEGORIES` reference data (was a DB table)
- `src/lib/stripe` — `index.ts` (server client), `client.ts` (browser), `fees.ts` (fee pass-through math)
- `src/lib/contest` — engine: `rake.ts`, `payout.ts`, `scoring.ts`, `settlement.ts`
- `src/lib/ai` — agent: `client.ts`, `probability.ts`, `verifier.ts`
- `src/server` — tRPC: `trpc.ts` (init/procedures), `context.ts` (Firebase user + `adminDb`), `root.ts` (mount feature routers here)
- `src/app/api/auth` — `session` (mint/clear cookie), `signup` (create profile + cookie) route handlers
- `firestore.rules`, `storage.rules`, `firestore.indexes.json`, `firebase.json` — Firebase project config
- Path alias: `@/*` → `src/*`

## Firestore data model (collections)
- `users/{uid}` — profile, balances (`coinBalance`, `cashBalanceCents`), `kycStatus`, creator fields, stripe IDs, `categories[]`
- `slates/{slateId}` — title, category, status, `creatorId`, `entryTiers`, `lockTime`, timestamps
- `slates/{slateId}/predictions/{predictionId}` — question, options, probabilities, `result`
- `slates/{slateId}/entries/{entryId}` — `userId`, tier, picks, score, rank, payout
- `deposits/{id}`, `withdrawals/{id}`, `pickPackages/{id}`, `creatorEarnings/{id}`
- `usernames/{lower}` — server-only uniqueness reservation (→ `{ uid }`)
- camelCase field names; money in cents; timestamps via `serverTimestamp()`. Server reads/writes use the Admin SDK (bypasses rules); client realtime uses `onSnapshot` from `src/lib/firebase/client.ts`.

## Auth & Onboarding (built — Firebase)
- Firebase Auth. Sign in/up run **client-side** (`src/lib/firebase/auth.ts`) to get an ID token, which is exchanged for an httpOnly **session cookie** (`__session`) via `POST /api/auth/session` (login) or `POST /api/auth/signup` (signup: verifies token, transactionally reserves username + creates `users/{uid}` with 500 coins, then mints the cookie).
- `src/middleware.ts` does a **cookie-presence** check only (firebase-admin can't run on Edge); real verification is `getCurrentUser()` in server components/route handlers (`src/lib/firebase/session.ts`).
- Routes: `/` landing, `/signup`, `/login`, `/onboarding` (3 steps), `/app`. Sign-out: `SignOutButton` → `logoutUser()` (client `signOut` + `DELETE /api/auth/session`).
- KYC mocked (`verifyIdentity` in `src/app/onboarding/actions.ts`): ~3s delay, then Admin-SDK update of `kycStatus`. SSN never persisted. Balance/KYC/creator fields are Admin-write-only (enforced in `firestore.rules`).
- Selected categories saved on the **user doc** (`categories[]`) via a server action using the Admin SDK.

## Explore feed + contest data layer (built)
- `/app` is the Explore feed. Server component fetches via `fetchFeedSlates(adminDb())` (`src/server/data/slates.ts`) — live/locked slates + their predictions as serializable `FeedSlate` DTOs (`src/lib/feed.ts`, millis not Timestamps).
- **Realtime**: `ExploreFeed` (client) subscribes with Firestore `onSnapshot` to the `slates` collection and recomputes pools live; predictions come from the initial SSR payload.
- **Prize-pool math**: `computeSlateMetrics(tier, hostingFeeCents, entryCount)` in `src/lib/contest/metrics.ts` (pure, client-safe) = rake + 1st-place curve + 1,000× cap. Pool funded by entry fees; `entryCount` is denormalized on the slate doc.
- **tRPC**: `slates.list` router (`src/server/routers/slates.ts`) exposed at `/api/trpc/[trpc]` (fetch adapter, Node runtime). No client React Query provider yet — the feed uses SSR + onSnapshot.
- **Seed**: `npm run seed` (`scripts/seed-firestore.mjs`) writes sample slates/predictions with fixed ids (idempotent). Needs the Admin env vars set.
- UI: `src/components/feed/SlateCard.tsx`; category tabs + free/paid + tier ($5/$10/$25) selector in `ExploreFeed`.

## Responsible play (built)
- `/app/responsible-play` (linked from Wallet): set **deposit limits** (daily/weekly/monthly — defaults in `DEPOSIT_LIMITS` are also the regulatory MAX; `updateDepositLimits` only lets users tighten, clamps to caps + daily≤weekly≤monthly) and **self-exclude** (24h/7d/30d/permanent via `setSelfExclusion` — extend-only, never lifted early; permanent = `PERMANENT_EXCLUSION_MS`). Shows rolling usage + the NCPG hotline (`NCPG_HOTLINE`).
- **Enforcement** (server-side, can't be bypassed by the client):
  - `createDepositIntent` — blocks while self-excluded; rejects when daily/weekly/monthly deposit sums (succeeded + pending, `fetchDepositUsage`) + the new amount exceed the user's limits.
  - `submitEntry` and `buyPackage` — throw `EXCLUDED` while self-excluded (paid + free entries and all purchases paused).
- `isSelfExcluded` / `fetchDepositUsage` in `src/server/data/responsiblePlay.ts`. New user-doc fields `depositLimit{Weekly,Monthly}Cents` (signup defaults). Wallet shows a self-exclusion banner.

## Referral program (built)
- **Code = username.** Invite link `…/signup?ref=<username>`. The signup page reads `?ref=`, passes it through `SignupForm` → `registerUser` → `POST /api/auth/signup`, which resolves the code via the `usernames/{lower}` doc.
- **Signup reward (in the signup transaction)**: referred user gets `REFERRED_WELCOME_COINS` extra coins; referrer gets `REFERRAL_SIGNUP_COINS` + `referralCount++`; a `referrals/{referredUid}` doc is created (status `signed_up`). New user-doc fields: `referredBy`, `referralRewarded`, `referralCount`, `referralEarningsCents`.
- **Conversion reward**: `maybeRewardReferral` (`src/server/referrals.ts`) fires from the deposit webhook's `creditDeposit` on the referred user's **first successful deposit** — idempotent via `referralRewarded`; credits the referrer `REFERRAL_PAID_BONUS_CENTS` cash + `referralEarningsCents`, marks the referral `converted`, and writes a `referral`-type `creatorEarnings` ledger entry (so it shows on the creator dashboard).
- **UI**: `/app/refer` (`fetchReferralDashboard` → `ReferralView`) — copyable invite link, stats (referred / converted / cash earned), and the referral list. Linked from Wallet + Creator dashboard. `referrals` collection rule: referrer-read, server-write.

## Pick packages — creator marketplace (built)
- **Sell** `/app/slate/[id]/sell` (creator-only, linked from the slate page): `PackageBuilder` sets name, cash price, optional coin price (default 2000), optional early-bird price + deadline, and the creator's pick on every prediction. `createPackage` validates + writes a `pickPackages` doc.
- **Buy** `/app/packages` (Marketplace, linked "Packages" on Explore): `fetchMarketplace` lists available packages (live slates) with effective price (early-bird aware) + creator + sold count; `buyPackage` charges **cash or coins** in one transaction — debits buyer, writes a `packagePurchases/{packageId}_{uid}` doc (one per user), bumps the count, and pays the creator **40%** (`PACKAGE_SPLIT`): cash → `creatorEarnings` ledger (type `package`) + cash balance; coins → coin balance.
- **Picks are the product**: `pickPackages` is no longer world-readable (rule tightened to owner-only); the marketplace + the gated reveal (to buyers / the creator) are served server-side via the Admin SDK. `PackagePurchaseDoc` + `COLLECTIONS.packagePurchases` added.

## Creator dashboard (built)
- `/app/creator` — server-rendered. `fetchCreatorDashboard` (`src/server/data/creator.ts`) aggregates the `creatorEarnings` ledger + the creator's slates: headline stats (lifetime net earnings, contests hosted, total entries), earnings **breakdown by type** (hosting/package/referral/pro_commission), and a list of their contests (status, entry count, realized net) linking to each slate. Empty state → "Host your first contest". Linked from the Explore header ("Creator").
- **Earnings are generated at settlement**: `settleSlate` now computes hosting fees on non-refunded paid entries, splits **40% creator / 60% platform** (`HOSTING_FEE_SPLIT`), writes a `creatorEarnings/hosting_{slateId}` ledger doc, and credits the creator's cash balance (withdrawable via the wallet). Package/referral/pro_commission ledger types are supported by the dashboard but not yet produced.

## Card Rush (built)
- Card Rush = a **boosted, time-limited, capped** contest (purple `rush` branding). Slate fields: `isCardRush`, `rushMultiplier` (1 normal; 2 or 3 for a rush), `maxEntries` (null = uncapped). Same engine underneath.
- **Boosted prizes**: `computeSlateMetrics(..., rushMultiplier)` scales the post-rake pool; `settleEntries(..., { prizeMultiplier })` boosts paid prize pools + free coin pools at settlement (`settleSlate` passes `slate.rushMultiplier`). LockIn funds the boost; the **1,000× cap still holds** (tested). New tests cover 2x payout + cap + free-tier coins (14 total).
- **Capped entries**: `submitEntry` blocks at `entryCount >= maxEntries` ("This Card Rush is full"). `CardRushMeta` shows the ⚡ badge, multiplier, and a fill progress bar on the feed card, slate page, and embed widget.
- **Builder**: Card Rush toggle + 2x/3x + max-entries in `SlateBuilder` → `createSlate`. `FeedSlate`/fetchers/`ExploreFeed` snapshot carry the rush fields; seed includes a `seed-boxing-rush` 3x demo.

## Creator slate builder (built)
- `/app/create` — `SlateBuilder` (client): title, category, lock time, description; add/remove **predictions** (binary or over/under — O/U auto-labels "Over/Under {line}"); **AI odds** per prediction via `suggestOdds` (mock `suggestOddsMock`, accept or override — Option B % is derived as 100 − A); choose entry **tiers** ($5/$10/$25) with per-tier hosting fee (defaults $1/$2/$3).
- `createSlate` server action (`src/app/app/create/actions.ts`): zod-validated, writes the slate (`status: 'live'`, `creatorId = uid`) + predictions (with derived multipliers) in one batch, sets `isCreator: true`, returns the id → client routes to `/app/slate/[id]`. Any signed-in user may host (real creator verification is a separate flow).
- Entry point: "+ Host" on the Explore header. Slates created here flow through the existing feed → entry → settlement loop.

## Leaderboard (built)
- `/app/leaderboard?window=today|week|all` — server-rendered, tabs via query param. `fetchLeaderboard` (`src/server/data/leaderboard.ts`) scans settled entries (collection group) in the window, aggregates per user (cash won excluding refunds, wins, plays, win rate, trailing streak), ranks by won → wins → win rate, fetches usernames for the top 50 + current user, and **pins the current user's row** when outside the top. Top-3 podium + ranked list.
- A `win` = settled entry with non-refunded `payoutCents > 0` or `payoutCoins > 0`; entries now carry a `refunded` flag (set at entry creation + settlement) so refunds aren't counted as winnings. Requires the entries `submittedAt` collection-group field override (in `firestore.indexes.json`). Linked from the Explore header ("Ranks"). Scan is capped at 5000 — precompute aggregates at real scale.

## Auto-settlement cron (built)
- `runAutoSettlement` (`src/server/settlement/cron.ts`) does time-based slate lifecycle each run: settle `locked` slates past `lockTime` → lock `live` slates past `lockTime` (one-cycle "results pending" window) → publish `draft` slates whose `promotionOpensAt` has arrived. Uses the slates `(status, lockTime)` index; bounded at 100/state/run; idempotent via `settleSlate`'s status guard.
- `GET /api/cron/settle` (Node runtime, `maxDuration: 60`) guarded by `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron sends this automatically). Scheduled every 5 min in `vercel.json`; any external scheduler can hit it too. `/api/admin/settle` remains for manual single-slate settlement.

## Settlement / scoring engine (built)
- **Pure engine** `settleEntries(entries, results, predictionOrder)` in `src/lib/contest/settlement.ts`: scores each card (`scoreCard`), ranks (score desc → earlier submit → id), and pays out. **Each paid tier is its own pool** (single-buy-in fairness): gross = count × entry fee, rake by tier, **top 25%** paid via the curve + **1,000× cap**; a tier under `MIN_PARTICIPANTS_FOR_PAYOUT` (20) is fully **refunded**. The free tier is a separate **coin** pool.
- **Verified by tests** (`settlement.test.ts`, `npm test`): reproduces HANDOFF figures exactly — 20→$10.20, 100→$51, 500→$255, 1000→$510, 10000→$5,100, 12000→$6,000 capped — plus refund/top-25%/tiebreak/coins.
- **Orchestrator** `settleSlate(slateId)` (`src/server/settlement/settle.ts`): atomically claims the slate (`status → settling`, idempotent), resolves predictions via the **mock verifier** (`resolveOutcomeMock` — favorite wins; real AI later), runs the engine, writes per-entry `score/rank/payoutCents/payoutCoins`, and **credits balances with `FieldValue.increment`** in chunked batches, then `status → settled`.
- **Trigger**: `POST /api/admin/settle` (Node runtime) guarded by `ADMIN_SETTLE_SECRET` bearer — stand-in for cron/auto-settlement until an admin UI exists.
- **UI**: settled slates show graded picks (✓/✗ + the winning option) and the entry's score/rank/prize on `/app/slate/[id]`; cash winnings flow into the wallet activity feed. `FeedPrediction.result` carries the outcome.

## Entry / pick flow (built)
- `/app/slate/[id]` — slate detail. Server fetches the slate + predictions (`fetchSlate`) and the user's existing entry; `SlatePicker` (client) builds the pick card: tap A/B per prediction, choose Free (coins) or Paid (tier), live prize pool via `onSnapshot`, then submit. Feed cards link here.
- `submitEntry` server action (`src/app/app/slate/[id]/actions.ts`) enforces, atomically: contest live + unlocked, a pick on every prediction, **one entry per user** (entry doc id = uid), sufficient balance, and for paid — **KYC verified + geo-eligible** (not an `EXCLUDED_STATES` registered state). It debits coins/cash, bumps `slate.entryCount`, and writes `slates/{id}/entries/{uid}` in one transaction.
- Free entry costs `FREE_ENTRY_COIN_COST` coins (constants); paid debits `tier*100 + hostingFeeCents`. Paid entries surface in the wallet activity feed via the collection-group query; the live pool/feed update from the `entryCount` bump.
- Re-entry is blocked; an existing entry renders a read-only "Locked in" card. Locked slates show "results pending."

## Embeddable widgets (built)
- **`/embed/[id]`** — public, frameable iframe widget (no auth; reads slate via Admin SDK). State-aware via `buildEmbedView` (`src/lib/embed.ts`): **live** (pool, 1st multiple, live `Countdown`, prediction + odds, Play CTA) → **locked** ("results pending") → **settled** (outcomes per question, AI hit-rate, prize pool, Join CTA). Framing allowed by a `frame-ancestors *` header for `/embed` in `next.config.ts`; `EmbedAutoRefresh` reloads every 60s so it auto-transitions.
- **`/s/[id]`** — public share landing with **Open Graph + Twitter** meta tags (`generateMetadata`, state-aware description) and a "Play on LockIn" CTA.
- **Embed code generator**: `EmbedSnippet` (copyable iframe + share link) on the slate page, shown to the creator. Shared `EmbedWidget` renders both routes (CTA adapts: new-tab to `/s/[id]` from the iframe, same-tab to `/app/slate/[id]` on the share page).
- Both routes are public (not in middleware `PROTECTED_PREFIXES`) and Node runtime. No dynamic OG image yet (meta tags only).

## AI chat assistant (built)
- Persistent blue (#3B8BFF) floating widget on every `/app` screen, mounted via `src/app/app/layout.tsx` → `ChatAssistant`. Streams replies token-by-token (reads `res.body` reader).
- `POST /api/chat` (Node runtime, auth-gated): injects a LockIn **knowledge base + the player's own data** (`fetchUserChatContext` — balances, KYC, win rate, total won) as the system prompt, then streams Claude. History is sanitized + capped (`MAX_CHAT_HISTORY`).
- **Model**: `AI_MODEL = claude-sonnet-4-6` (`src/lib/ai/client.ts`) — the project's documented choice (HANDOFF.md) for a high-volume, latency-sensitive chat; `getAnthropic()` is **lazily** constructed (same build-time gotcha as Stripe/Firebase). Uses `@anthropic-ai/sdk`. System prompt in `src/lib/ai/chat.ts` (never says "rake"/gambling; surfaces the NCPG hotline on distress). Needs `ANTHROPIC_API_KEY`.

## Wallet + payments (built)
- `/app/wallet` — dual balance (coins green, cash cayenne), Add funds / Withdraw sheets, KYC banner, coins-vs-cash note, unified cash activity (`fetchTransactions` merges deposits + withdrawals + paid entries/winnings via a collection-group query). Live balances via `onSnapshot` on `users/{uid}`.
- **Deposit**: `createDepositIntent` server action → Stripe **PaymentIntent** + pending `deposits/{id}` doc; client shows the fee breakdown BEFORE confirm, then confirms with Stripe **Payment Element** (`@stripe/react-stripe-js`, stripe-js v9). Card fee is grossed-up (`depositFeeCents`) so LockIn nets the full amount; ACH = $0, shown as a green "Free" label.
- **Balance crediting is webhook-only** (`/api/webhooks/stripe`, Node runtime, raw-body signature verify): `payment_intent.succeeded` → idempotent credit (txn-guarded on deposit status); `payout.paid/failed` → finalize withdrawal, re-credit on failure. Never credit optimistically client-side.
- **Withdraw**: `requestWithdrawal` — KYC-gated, min $10, reserves funds + creates the record atomically, then initiates an ACH payout (rolls back on failure). NOTE: `payouts.create` here stands in for a Connect transfer+payout to the user's connected account in production.
- Fee/deposit constants in `src/lib/constants.ts`; fee math in `src/lib/stripe/fees.ts`.

## Lazy-init gotcha (build-time)
- SDKs that throw on missing creds at construction MUST be lazily initialized — `next build` imports route/client modules during page-data collection with no env. Both the Firebase web SDK (`src/lib/firebase/client.ts`) and the Stripe **server** client (`getStripeServer()` in `src/lib/stripe/index.ts`) are lazy singletons for this reason. Don't construct them at module scope.

## Firebase notes
- Admin credentials: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (escaped `\n` restored at runtime). Web config: `NEXT_PUBLIC_FIREBASE_*`.
- Route handlers touching firebase-admin set `export const runtime = "nodejs"`.
- Server logic uses Next.js API routes / server actions; `firebase-functions` is installed for future background/scheduled jobs.
- Deploy rules/indexes: `firebase deploy --only firestore:rules,firestore:indexes,storage`.

## Tech Stack
- Next.js 15 (App Router, TypeScript strict)
- Firebase (Firestore, Auth, Realtime via onSnapshot, Storage, Cloud Functions)
- tRPC (API layer)
- Stripe (PaymentIntents, Connect, Webhooks)
- Tailwind CSS (dark theme)
- Persona API (KYC identity verification)
- MaxMind GeoIP2 (geo-fencing)
- Anthropic API (AI agent for odds, verification, chat assistant)

## Commands
- `npm run dev` — start dev server
- `npm run build` — production build
- `npm test` — run test suite
- `npm run lint` — ESLint check
- `firebase emulators:start` — local Auth/Firestore/Storage emulators
- `firebase deploy --only firestore:rules,firestore:indexes,storage` — push security rules & indexes

## Design System
- Background: #0A0D12, Surfaces: #0D1118 / #12161E, Borders: #1E2A38
- Text: #E8ECF2, Muted: #6B7A8E
- Accent (cayenne): #FF3B00 — ALWAYS translucent (rgba(255,59,0,.10) bg, never solid fill)
- Win states: #22C55E (green) — only for correct picks, win rates, positive outcomes
- Card Rush: #9B5DE5 (purple) — only for Card Rush feature
- Live events: #F5A623 (amber)
- Losses: #E85454 (red)
- AI agent: #3B8BFF (blue)
- No visible scrollbars anywhere (scrollbar-width: none)
- Translucent buttons everywhere — no solid color fills on interactive elements

## Business Rules (Constants)
- RAKE: $5 tier → 15%, $10 tier → 20%, $25 tier → 30%, pool > $250K → 35%
- PAYOUT CAP: 1,000x entry cost (overflow → LockIn revenue)
- HOSTING SPLIT: 60% LockIn / 40% Creator
- PACKAGE SPLIT: 60% LockIn / 40% Creator
- TOP PAID: 25% of participants
- MIN PARTICIPANTS: 20 for cash payouts (auto-convert to free below 20)
- PAYOUT CURVE: 1st 12%, 2nd 7%, 3rd 4.5%, 4th 3%, 5th 2.5%, 6-10th 2% each, 11-25th 1% each, 26-50th 0.5% each, 51-100th 0.25% each, 101-175th 0.15% each, 176-250th 0.12% each
- STRIPE FEES: 100% passed to customer (LockIn pays $0)
- COINS: 500 at signup, 5000=free $5 entry, 10000=$10, 20000=$25
- EXCLUDED STATES: WA, AZ, IA, LA, MT, SC

## Conventions
- Server components by default
- TypeScript strict mode, no `any`
- All money stored as cents (integers)
- All timestamps as Firestore Timestamps (written via `serverTimestamp()`)
- No jargon in UI — every term explained inline on first appearance
- "Rake" never shown to users — they see "entry fee" and "prize pool"
- Every event card shows LIVE prize pool and current 1st place multiple
