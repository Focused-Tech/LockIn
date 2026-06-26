# LOCKIN — COMPLETE HANDOFF DOCUMENT
## For Developer, Claude Code, or New Conversation Sessions

This document captures every product, business, design, and technical decision made during the LockIn design and planning phase. It is the single source of truth.

---

## PRODUCT OVERVIEW

LockIn is a skill-based prediction contest platform where digital content creators and influencers host prediction events for their audience. Users pick outcomes on sports, esports, entertainment, politics, crypto, and more. Winners split a prize pool funded entirely by entry fees. LockIn operates as a pool-based skill game — it is NOT gambling and NOT a sportsbook. LockIn never bets against users and has zero financial exposure to outcomes.

Tagline: "Your call. Your cash."
Brand voice: Confident, competitive, social, culture-first.

---

## BUSINESS MODEL

### Revenue Streams (LockIn)
1. Scaled rake on contest pools: 15% ($5 tier), 20% ($10 tier), 30% ($25 tier), 35% (pools > $250K)
2. Hosting fee cut: 60% of creator hosting fees ($1-$3 per entry)
3. Pick package marketplace cut: 60% of creator package sales
4. 1,000x payout cap overflow: any payout above 1,000x the entry cost flows to LockIn
5. Creator partnership subscription fees: $0 (basic), $199/mo (Pro), $499/mo (Elite), $999/mo + 5% above $100K (Partner)
6. User Pro subscription: $9.99/month (AI analysis, speed bonus, early access)
7. Stripe processing fees: $0 to LockIn (100% passed to customer)

### Revenue Streams (Creators)
1. Hosting fees: 40% of per-entry hosting fee × entries
2. Pick package sales: 40% of package price × sales
3. Referral bonuses: $1-$2 per new paid user referred
4. Pro subscription referral: 20% recurring ($2/month per referred Pro subscriber)
5. Card Rush hosting: same 60/40 split

### Entry Tiers
- $5 Standard (15% rake, $1-$2 hosting fee)
- $10 Mid (20% rake, $2 hosting fee)
- $25 High Stakes (30% rake, $3 hosting fee)
- $250K+ Mega (35% rake, any tier)

### Payout Structure
- Top 25% of participants receive payouts
- Bottom 75% lose their entry fee (standard for all DFS/skill-game platforms)
- Curve: 1st 12%, 2nd 7%, 3rd 4.5%, 4th 3%, 5th 2.5%, 6th-10th 2% each, 11th-25th 1% each, 26th-50th 0.5% each, 51st-100th 0.25% each, 101st-175th 0.15% each, 176th-250th 0.12% each
- 1,000x payout cap: max any single winner receives = 1,000 × their total entry cost
- Cap overflow = additional LockIn revenue
- Minimum 20 paid participants for cash payouts (auto-convert to free below 20)

### Honest Win Multiples by Event Size ($5 tier, $6 total entry)
- 20 people: 1st wins $10.20 (1.7x)
- 100 people: 1st wins $51 (8.5x)
- 500 people: 1st wins $255 (42.5x)
- 1,000 people: 1st wins $510 (85x)
- 10,000 people: 1st wins $5,100 (850x)
- 12,000+ people: 1st wins $6,000 (1,000x CAPPED)
- Marketing MUST tie multiples to event size. Never claim "1,000x" without specifying scale.

### Coin Economy
- 500 free coins at signup
- Coins earned through wins, streaks, referrals, daily login
- Coins spent on free contest entries (50-200 per entry)
- Coin redemption for paid entry tokens: 5,000 = $5, 10,000 = $10, 20,000 = $25
- Tokens expire after 30 days, no cash value
- Coins can also buy creator pick packages (2,000 coins per package)
- Coins have NO cash value and cannot be withdrawn

### Stripe Fee Pass-Through
- All processing fees passed to customer at deposit time
- Card: 2.9% + $0.30 per transaction
- ACH bank transfer: also passed to customer (no free rides)
- User sees exact fee before confirming deposit
- UI shows savings tips: larger deposits = lower fee %, bank transfer cheapest
- Cancellation: Stripe fees are NON-REFUNDABLE (already collected at deposit)

---

## PREDICTION CATEGORIES

Sports: NASCAR, NFL, NBA, MLB, NHL, Soccer (EPL, La Liga, MLS, Champions League, World Cup), Tennis (ATP, WTA, Grand Slams), Golf (PGA, Majors), Boxing, UFC/MMA
Esports: League of Legends, Valorant, CS2, Dota 2, Overwatch
Entertainment: Award shows (VMAs, Oscars, Grammys), Reality TV (Survivor, Bachelor)
Music: Billboard Hot 100, album drops, chart predictions
Markets: Crypto (BTC/ETH targets, ETF approvals), Economics (Fed rates, CPI, jobs data)
World: Politics (elections, legislation), Geopolitics (trade, treaties, conflicts)
Other: Weather (hurricanes, records), Viral/Culture
Rule: Any event an AI agent can verify with 3+ independent sources is eligible.
Prediction types: Binary (A vs B), Over/Under (with AI-set lines)

---

## DESIGN SYSTEM

### Colors
- Background: #0A0D12
- Surface primary: #0D1118
- Surface card: #12161E
- Borders: #1E2A38
- Text primary: #E8ECF2
- Text muted: #6B7A8E
- Accent (cayenne): #FF3B00 — ALWAYS translucent. rgba(255,59,0,.10) for backgrounds, rgba(255,59,0,.25) for borders. NEVER solid fill on buttons or pills.
- Win/success: #22C55E — ONLY for correct picks, win rates, positive money, win states
- Loss/error: #E85454
- Live/pending: #F5A623
- Card Rush: #9B5DE5 — ONLY for Card Rush feature, same translucent treatment
- AI agent: #3B8BFF — tooltips, chat, knowledge base elements

### Typography
- System font stack: system-ui, -apple-system, sans-serif
- No Bebas Neue (removed from original). Clean, modern type only.
- Sentence case everywhere. No all-caps except the logo.

### Buttons
- Always translucent: rgba background + solid text color + subtle border
- Never solid fill. Never clip-path. Standard rounded rectangles (border-radius: 8px).
- Disabled state: opacity 0.35

### Scrollbars
- Hidden everywhere: scrollbar-width: none, ::-webkit-scrollbar { display: none }
- Gesture/swipe only on mobile. Click-drag on desktop.

### Icons
- No emoji in navigation or system UI
- Emoji acceptable for category labels (🏎️ NASCAR, 🎮 Esports, etc.)
- Clean icons for nav, status indicators, actions

---

## TECH STACK

- Next.js 15 with App Router (TypeScript strict mode)
- Firebase (Firestore + Auth + Realtime via onSnapshot + Storage + Cloud Functions)
- tRPC for type-safe API layer
- Stripe (PaymentIntents for deposits, Connect for creator payouts, Webhooks for async events)
- Persona API for KYC identity verification
- MaxMind GeoIP2 for geo-fencing (block excluded states)
- Anthropic API (Claude Sonnet 4.6) for AI agent (odds calculator, outcome verifier, chat assistant, strategy advisor)
- Tailwind CSS for styling
- Puppeteer for server-side PNG card generation (shareable pick cards)

---

## KEY FEATURES

### Authentication & Onboarding
- Signup: username, email, DOB, password
- Age checkbox (18+) REQUIRED
- ToS + Privacy + Responsible Play checkbox REQUIRED
- Skill-game disclaimer visible at signup
- KYC via Persona: full name, address, SSN last 4, phone (required for paid, skippable for free)
- Geo-fencing: block paid contests in WA, AZ, IA, LA, MT, SC
- Guided first-pick tour: 60-second walkthrough making first prediction with AI tooltips
- Category selection for personalized feed

### Home Feed (Explore)
- Horizontal scrollable category tabs with count badges
- Free/Paid toggle with tier selector ($5/$10/$25)
- "Happening now" featured events row
- Card Rush banner (purple)
- Event cards showing: category, status, title, entry cost, LIVE prize pool + 1st place multiple, AI badge, prediction options with probability pills
- Pick slip (bottom sheet mobile, sidebar desktop)

### Event Cards
- Show current entry count, current prize pool, current 1st place payout and multiple — all updating live
- Probability pills tappable to add/remove picks
- Each option shows: name, payout multiplier, community probability %
- Over/under lines displayed with AI-calculated probabilities
- "Pool grows as more enter" educational label

### Contest Engine
- Scoring: 10 pts per correct pick, 1.2x consecutive multiplier, 2x perfect card bonus
- Tiebreaker: earlier submission timestamp wins
- Settlement: AI agent verifies outcomes from 3+ sources, auto-settles at 99%+ confidence
- Parallel free tier on every paid slate with separate scoring
- Shadow earnings shown to free users: "This score would have won you $X in the paid contest"

### Wallet
- Dual balance: coins + cash
- Deposit: card (fee shown) or bank transfer (fee shown, cheapest option)
- Withdraw: ACH, 1-3 business days, $10 minimum, KYC required
- Transaction history
- Deposit limits configurable by user

### Creator Platform
- Creator application and verification process
- Creator dashboard: revenue breakdown, stats, follower count
- Slate builder: event selection, prediction questions, AI odds calculator (accept or override), tier selection, hosting fee, lock time, promotion window (1hr-7 days)
- Pick package builder: pricing, early bird option, picks encrypted until lock
- Promotion tools: auto-generated PNG cards (story/feed/Twitter sizes), deep link, embed code, caption template with dynamic entry count and current prize
- Stripe Connect for payouts (weekly or monthly schedule)

### Embeddable Widgets
- Iframe embed code for creator websites/blogs/Linktree
- Live state: shows predictions, probability %, entry count, countdown, "Play now" CTA
- Locked state: "Results pending"
- Settled state: shows outcomes, creator accuracy, prize pool, 1st place prize, "Join on LockIn" CTA
- Auto-transitions between states without creator intervention
- Open Graph meta tags on every slate URL for rich social previews

### AI Agent (4 modes)
1. Probability calculator: pulls from sports/financial/political APIs, calculates odds, sets over/under lines
2. Outcome verifier: cross-references 3+ sources, auto-settles at 99%+ confidence
3. Tour guide: contextual tooltips for first-time users on every screen
4. Chat assistant: persistent blue icon on every screen, answers questions using knowledge base, references user's own data (balance, win rate, history)
5. Strategy advisor: teasers for free users, full analysis for Pro ($9.99/mo) — parlay suggestions, historical accuracy data, category performance tracking

### Card Rush
- Time-limited boosted contests with purple branding
- 2x-3x prize multipliers
- Creator-hosted rushes
- Countdown timer, progress bar, max entries
- Same contest engine underneath with boosted payout calculation

### Leaderboard
- Tabs: Today, This Week, All Time
- Top 3 podium
- User's rank pinned if not visible
- Win rate, streak, total wins

### Responsible Play
- Daily deposit limit: $500 default, user-adjustable down
- Weekly limit: $2,000
- Monthly limit: $5,000
- Self-exclusion: 24hr, 7-day, 30-day, permanent
- Session time reminders (optional 60/120 min)
- NCPG hotline: 1-800-522-4700
- Loss limit alerts

### Legal Disclaimers
- Signup: age checkbox, ToS checkbox, skill-game disclaimer
- First paid entry: acknowledgement modal (skill-game disclosure, 15% fee, non-refundable after lock)
- Deposit: "Processing fees non-refundable" + savings tips
- Withdrawal: "Winnings $600+/year reported to IRS (1099-MISC)"
- Footer on every screen: "Skill-based prediction contest platform. Not gambling. Not sports betting. 18+."
- Attorney consultation ($500-800) required before accepting real money

---

## CANCELLATION & REFUND POLICY

- Event cancelled before lock: 100% entry + hosting refund to wallet. Stripe deposit fee NOT refunded.
- Under 20 paid participants at lock: auto-convert to free, 100% entry refund, users notified.
- Partial results: void unsettled picks, settle on remainder. Full pool distributes.
- Creator bonus on cancellation: refunded to creator wallet.
- Rake on cancelled events: not taken.

---

## MARKETING PLAN

Target: Influencers with 100K-1M followers on one platform (3.5-5M creators worldwide in this range).
LockIn needs 220 creators for $200M/month revenue. That's 0.03% of addressable pool.

Phase 1 (Month 1-2): Direct outreach to 10-15 seed creators. Founding creator status: 0% hosting fee for first 3 months.
Phase 2 (Month 3-4): Case study marketing from seed creator earnings. Creator Challenge bonus.
Phase 3 (Month 5-7): Creator referral program ($500 per recruited creator). Partnership integrations.
Phase 4 (Month 8-12): Dedicated partnerships team. Creator Fund ($10K/month guarantee for 500K+ creators). PR push.

Users acquired via creators, not direct marketing. Creators ARE the marketing channel.

---

## INTERNATIONAL EXPANSION

US first. Free tier globally (no restrictions on virtual currency play).
Priority paid markets: India (skill games legal, 100M+ DFS users), Canada (DFS legal), UK (Gambling Commission license needed but achievable), Brazil (new regulated market), Germany, Spain (accessible).
Avoid: Netherlands, France, Belgium, Australia, New Zealand, Singapore, China (banned or require gambling license).

---

## COMMERCIAL CONCEPT

30-second spot: Celebrity making predictions that come true across UFC, NASCAR, award shows, and crypto. Quick cuts. Each prediction verified in real-time. Punchline: "Everybody's got an opinion. On LockIn... your opinion pays." Tagline: "Your call. Your cash."

---

## 12-MONTH REVENUE FORECAST (with 1,000x cap and 60/40 hosting)

Month 1: $139K (5 creators, 3K avg entries)
Month 3: $1.2M (18 creators, 7K avg entries)
Month 6: $7.4M (45 creators, 15K avg, cap overflow begins)
Month 9: $19.9M (72 creators, 22K avg)
Month 12: $40.8M-$200M (100-220 creators, 25K-30K avg, cap overflow dominant at 33% of revenue)

Year 1 cumulative at high-end model: $163M LockIn revenue, $88M creator payouts, $412M prizes distributed, $663M total through platform.

---

## EXISTING PROTOTYPE FILES

- lockin-v3.html — Base interactive prototype with all features (do not modify)
- lockin-v4.html — Paid and Free user journey demos with settlement reports
- lockin-v5.html — Creator journey demo (12 steps)
- index.html — Copy of V5 in the project root for Claude Code reference
- CLAUDE.md — Project context file for Claude Code sessions
- LockIn_Business_Model.md — Full business model (copy-paste format)
- LockIn_Scaled_Rake_Model.md — Scaled rake with 12-month forecast
- LockIn_Scaled_Rake_Charts.html — Visual chart version
- LockIn_Payout_Deep_Dive.md — Corrected payout structure and 10x/100x/1000x analysis
- LockIn_Payout_Charts.html — Visual payout charts
- LockIn_Capped_Forecast.html — 1,000x cap model with 12-month forecast
- LockIn_Implementation_Marketing_Plan.md — Build roadmap + marketing plan + embed spec
- LockIn_Revised_WinStructure_Onboarding_AI.md — Corrected win structure, onboarding UX, AI agent spec
- LockIn_ClaudeCode_BuildGuide.md — Claude Code prompts for Phase 1-12
- LockIn_RealMoney_Addendum.md — Payment flows, KYC, disclaimers
- LockIn_Redesign_Plan.md — Original UI redesign plan (Kalshi-inspired)
- SlateDay_TickerClash_Developer_Scope.docx — Original developer scope of work (in uploads)

---

## HOW TO USE THIS DOCUMENT

For Claude Code: Paste this entire document as context at the start of a new session, or save it as a file in the project root and reference it. All business rules, constants, and design decisions are captured here.

For a new conversation: Paste this document and say "This is the LockIn handoff. I need to continue building from where we left off. Start with [specific feature]."

For a developer: This document plus the ClaudeCode_BuildGuide.md contains everything needed to build the complete application.
