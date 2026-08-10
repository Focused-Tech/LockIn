# Store Privacy Forms — code-derived (2026-08-09)

Built by auditing what the code **actually** collects/stores/shares (file:line evidence in the
engineering notes). Two blockers surfaced up front — fix these before submitting either store.

## 🚫 Blockers (fix before submission)
1. **No functional account-deletion path.** Settings shows "Delete account" and "Download my data"
   rows but both are inert stubs — no `href`, no `onClick`, no server action (`SettingsView.tsx:191,203`).
   The only `deleteUser` call is a signup-rollback (`auth.ts:82`), not user-initiated. **Apple 5.1.1(v)
   and Google both require in-app account deletion for apps that create accounts.** Must be built.
2. **Privacy policy URL is unreachable.** `https://lockin.llc/privacy` refuses HTTPS (parked
   Namecheap IP `198.54.117.242`). Both stores require a live policy URL. The code↔policy diff (below)
   cannot be completed until the policy is published — I'll finish it the moment the URL is live.

---

## 1. Apple Privacy Nutrition Labels
Format: **Data Type — Linked to identity? — Purpose.** Everything stored is keyed to the Firebase uid,
so all of it is *Linked to identity*. **No tracking** (no analytics/ad SDK, no IDFA) — answer "Used to
Track You?" = **No** for every type.

| Apple data type | Collected | Linked | Purpose |
|---|---|---|---|
| **Email address** | Yes | Yes | App Functionality (account) |
| **Name** (username; display name from OAuth) | Yes | Yes | App Functionality |
| **Other User Contact Info** (—) | No | — | — |
| **Physical Address** | **No** (KYC form gathers it; only *state* persists) | — | — |
| **Phone Number** | **No** (gathered in KYC, never stored) | — | — |
| **Sensitive Info** (SSN/gov ID) | **No** — only last-4 collected then discarded; Persona is mocked | — | — |
| **Date of Birth** | Yes | Yes | App Functionality (age gate) |
| **Coarse Location** (region/state from IP) | Yes | Yes | App Functionality (geo-eligibility) |
| **Precise Location** (GPS) | **No** (no Geolocation API anywhere) | — | — |
| **Payment Info** (card/bank) | **No** on our servers — tokenized by Stripe; we store only Stripe IDs | — | — |
| **Purchase History / Financial Info** (balances, deposits, withdrawals, entries) | Yes | Yes | App Functionality |
| **Audio Data** (microphone) | **No storage** — live STT only, never recorded/stored | — | — |
| **User Content** (chat messages to the Locksmith) | Yes | Yes | App Functionality |
| **Identifiers** (user id; push device token) | Yes | Yes | App Functionality (auth, notifications) |
| **Usage / Diagnostics / Analytics** | **No** — no analytics SDK present | — | — |

Mic + notifications require the usage strings already in `Info.plist:37` (mic) — keep them.

---

## 2. Google Play Data Safety
**Data collected:** Yes. **Data shared with third parties:** Yes (service providers — Firebase, Stripe,
Anthropic; see §3). **Encrypted in transit:** **Yes** (HTTPS throughout — Capacitor `androidScheme:"https"`,
all SDKs HTTPS, session cookie `httpOnly`+`secure`). **Users can request data deletion:** ⚠️ **must be
"Yes"** — build the deletion flow first (Blocker 1).

| Google category → data type | Collected | Shared | Purpose |
|---|---|---|---|
| **Personal info** → Email | Yes | Yes (Firebase) | Account management |
| **Personal info** → Name (username) | Yes | Yes | Account management, App functionality |
| **Personal info** → Other IDs (DOB) | Yes | Yes | Fraud prevention / compliance (age) |
| **Personal info** → Address, Phone | **No** | — | — |
| **Financial info** → Purchase history / balances | Yes | Yes (Firebase) | App functionality |
| **Financial info** → Payment info (card) | **No** (Stripe-tokenized; we never receive it) | — | — |
| **Location** → Approximate location | Yes (IP→region) | No | Geo-eligibility / compliance |
| **Location** → Precise location | **No** | — | — |
| **Audio** → Voice/sound recordings | **No** (STT only, not stored) | — | — |
| **Messages** → Other in-app messages (Locksmith chat) | Yes | Yes (Anthropic) | App functionality |
| **App activity** → In-app actions (plays/wins) | Yes | Yes (Firebase) | App functionality |
| **Device/other IDs** → Device ID (push token) | Yes | Yes (Firebase/FCM) | Notifications |

Data-deletion request mechanism: in-app **and** a URL — needs Blocker 1 + a policy page section.

---

## 3. Third parties (what leaves the app)
- **Firebase / Google** — email, username, DOB, state, balances, transactions, device token, chat context. Identity-linked.
- **Stripe** — card/bank entered *directly into Stripe*; we send only `email` + `uid` metadata. Identity-linked.
- **Anthropic (Claude)** — Locksmith chat sends **username, coin + cash balances, KYC-verified bool, registered state, plays/wins/win-rate, total won, and the user's typed messages** in the system prompt; advisor sends username + per-category record. **No email/DOB/SSN/address.** Identity-linked (username). ⚠️ **The privacy policy must disclose that in-app messages + account/financial summary are processed by a third-party AI provider.**
- **Persona (KYC)** — declared in stack but **not integrated** (mock). No data leaves today.
- **MaxMind (geo)** — **not integrated**; geo is Vercel's edge IP header. No data leaves to MaxMind.
- **Vercel** — hosting/edge; sees request IPs inherently.

---

## 4. Diff — code vs policy (BOTH directions)
> **Cannot be completed: the policy URL is down.** Once `lockin.llc/privacy` is live I'll diff it line-by-line.
> Meanwhile, the code-side facts the policy **MUST** state (or it's a code→policy gap on submission):

- Collects **email, username, DOB, coarse (IP) location/state, balances + full transaction history,
  push device token, and Locksmith chat messages** — all linked to identity.
- **Shares** account/financial summary **+ chat messages with Anthropic (AI)**, payment data with
  **Stripe**, and everything with **Firebase/Google**. The policy must name AI processing explicitly.
- **Does NOT** collect: precise GPS, phone, street address, full SSN, card numbers (Stripe-tokenized),
  or any analytics/advertising identifiers. If the policy *claims* any of these (e.g. boilerplate
  "we use analytics/advertising cookies," "we collect your address," "we use MaxMind/Persona"), that's
  a **policy→code gap** — the policy overclaims and must be corrected, or the stores will see a mismatch.
- **Retention/among:** balances + transactions are retained indefinitely (no TTL in code); no deletion
  path exists (Blocker 1) — the policy must not promise deletion the app can't perform.

**Ranked risk:** (1) account-deletion gap, (2) dead policy URL, (3) AI-processing disclosure of
chat + financial summary to Anthropic, (4) any analytics/advertising/MaxMind/Persona *overclaim* in a
boilerplate policy that the code doesn't back.
