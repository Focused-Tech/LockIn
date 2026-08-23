/**
 * Seed creators through the apply → approve → Connect flow.
 *
 * Usage (Admin creds required; same env as `npm run seed`):
 *   FIREBASE_PROJECT_ID=... FIREBASE_CLIENT_EMAIL=... FIREBASE_PRIVATE_KEY="..." \
 *     npm run seed:creators
 *
 * Writes, idempotently (fixed uids):
 *   - 12 APPROVED creators: users/{uid} (creatorVerified) + an approved
 *     creatorApplications/{uid} (so it mirrors a reviewed application).
 *
 * Connect onboarding is interactive (a hosted Stripe form), so it can't be fully
 * scripted. This marks approved creators as "approved, payout setup pending"
 * (creatorStripeConnectId=null, creatorPayoutsEnabled=false) — finish onboarding
 * in-app via the dashboard "Connect payouts" button. For a settlement/withdrawal
 * DRY-RUN where you want payouts to look complete, set SEED_FORCE_PAYOUTS=1 to
 * stamp a placeholder connected account (simulation only — not a real Stripe acct).
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY");
  process.exit(1);
}
if (!getApps().length) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}
const db = getFirestore();

const FORCE_PAYOUTS = process.env.SEED_FORCE_PAYOUTS === "1";
const reviewer = (process.env.ADMIN_UIDS ?? "seed-admin").split(",")[0].trim();

const APPROVED = [
  { handle: "hoopsdaily", size: 142000, cats: ["NBA"], url: "https://youtube.com/@hoopsdaily" },
  { handle: "gridironguru", size: 88000, cats: ["NFL"], url: "https://youtube.com/@gridironguru" },
  { handle: "octagoninsider", size: 64000, cats: ["UFC", "Boxing"], url: "https://tiktok.com/@octagoninsider" },
  { handle: "pitchside", size: 210000, cats: ["Soccer"], url: "https://youtube.com/@pitchside" },
  { handle: "degencharts", size: 51000, cats: ["Crypto"], url: "https://x.com/degencharts" },
  { handle: "aceswing", size: 33000, cats: ["Golf", "Tennis"], url: "https://youtube.com/@aceswing" },
  { handle: "puckluck", size: 41000, cats: ["NHL"], url: "https://tiktok.com/@puckluck" },
  { handle: "diamonddata", size: 27000, cats: ["MLB"], url: "https://x.com/diamonddata" },
  { handle: "esportsedge", size: 305000, cats: ["Esports"], url: "https://twitch.tv/esportsedge" },
  { handle: "polypulse", size: 76000, cats: ["Politics", "Geopolitics"], url: "https://youtube.com/@polypulse" },
  { handle: "screentime", size: 120000, cats: ["TV Shows", "Entertainment"], url: "https://tiktok.com/@screentime" },
  { handle: "rpmradio", size: 58000, cats: ["NASCAR"], url: "https://youtube.com/@rpmradio" },
];


function baseUser(handle, extra) {
  return {
    username: handle,
    email: `${handle}@seed.lockin.test`,
    dateOfBirth: "1995-01-01",
    avatarUrl: null,
    coinBalance: 500,
    cashBalanceCents: 0,
    kycStatus: "verified", // so they can withdraw in a dry-run
    kycProviderId: null,
    kycVerifiedAt: FieldValue.serverTimestamp(),
    geoState: "NY",
    registeredState: "NY",
    stripeCustomerId: null,
    isCreator: false,
    creatorVerified: false,
    creatorTier: "basic",
    creatorStripeConnectId: null,
    creatorPayoutsEnabled: false,
    proSubscriber: false,
    proExpiresAt: null,
    stripeSubscriptionId: null,
    depositLimitDailyCents: 50000,
    depositLimitWeeklyCents: 200000,
    depositLimitMonthlyCents: 500000,
    selfExclusionUntil: null,
    categories: extra.cats,
    referredBy: null,
    referralRewarded: false,
    referralCount: 0,
    referralEarningsCents: 0,
    createdAt: FieldValue.serverTimestamp(),
    ...extra.overrides,
  };
}

async function run() {
  const batch = db.batch();

  APPROVED.forEach((c, i) => {
    const uid = `seed-creator-${String(i + 1).padStart(2, "0")}`;
    const overrides = {
      isCreator: true,
      creatorVerified: true,
      ...(FORCE_PAYOUTS
        ? { creatorStripeConnectId: `acct_seed_${uid}`, creatorPayoutsEnabled: true }
        : {}),
    };
    batch.set(db.collection("users").doc(uid), baseUser(c.handle, { cats: c.cats, overrides }));
    batch.set(db.collection("usernames").doc(c.handle.toLowerCase()), { uid });
    batch.set(db.collection("creatorApplications").doc(uid), {
      userId: uid,
      username: c.handle,
      audienceUrl: c.url,
      audienceSize: c.size,
      categories: c.cats,
      pitch: `I run ${c.handle} with ${c.size.toLocaleString()} followers in ${c.cats.join("/")} and can drive my audience to weekly contests.`,
      status: "approved",
      reviewNote: null,
      reviewedBy: reviewer,
      createdAt: FieldValue.serverTimestamp(),
      reviewedAt: FieldValue.serverTimestamp(),
    });
  });

  // NO PENDING APPLICANTS ARE SEEDED. Creator approval is not a manual queue — marquee hosts
  // are signed on paper, off-platform, and everyone else is verified automatically. Seeding a
  // review inbox invented work that does not exist. Do not add fixtures back here.

  await batch.commit();
  console.log(
    `Seeded ${APPROVED.length} approved creators (no pending applicants — approval is automatic).` +
      (FORCE_PAYOUTS ? " (payouts force-enabled for dry-run)" : ""),
  );
}

run().then(() => process.exit(0));
