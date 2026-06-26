/**
 * Create (or reuse) the recurring Stripe Price for the $9.99/mo LockIn Pro plan,
 * then print the price id to put in STRIPE_PRO_PRICE_ID.
 *
 * Usage (env must hold your Stripe secret key — use a TEST key first):
 *   STRIPE_SECRET_KEY=sk_test_... npm run stripe:price
 *
 * Idempotent: keyed on the price lookup_key "lockin_pro_monthly", so re-running
 * reuses the existing price instead of creating duplicates. Run once per Stripe
 * mode (test, then live).
 */
import Stripe from "stripe";

// Mirror src/lib/constants.ts → PRO_PRICE_CENTS ($9.99). Keep in sync.
const PRO_PRICE_CENTS = 999;
const LOOKUP_KEY = "lockin_pro_monthly";
const PRODUCT_NAME = "LockIn Pro";

const secret = process.env.STRIPE_SECRET_KEY;
if (!secret) {
  console.error("Missing STRIPE_SECRET_KEY");
  process.exit(1);
}

const stripe = new Stripe(secret, { apiVersion: "2025-02-24.acacia" });
const mode = secret.startsWith("sk_live") ? "LIVE" : "TEST";

// Reuse an existing price with this lookup_key if present.
const existing = await stripe.prices.list({
  lookup_keys: [LOOKUP_KEY],
  active: true,
  limit: 1,
});

let price = existing.data[0];
if (price) {
  console.log(`[${mode}] Reusing existing price.`);
} else {
  const product = await stripe.products.create({
    name: PRODUCT_NAME,
    description: "AI Strategy Advisor, category performance, and Pro perks.",
  });
  price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: PRO_PRICE_CENTS,
    recurring: { interval: "month" },
    lookup_key: LOOKUP_KEY,
  });
  console.log(`[${mode}] Created product ${product.id} + price.`);
}

console.log("");
console.log(`  STRIPE_PRO_PRICE_ID=${price.id}`);
console.log("");
console.log("Add that to your env (and Vercel), then redeploy.");
