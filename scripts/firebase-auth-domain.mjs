/**
 * Add an authorized domain to Firebase Auth (Identity Platform), so popup/
 * redirect social sign-in is allowed from that origin. Idempotent.
 *
 * Usage (Admin creds in env):
 *   node scripts/firebase-auth-domain.mjs <domain>
 *   e.g. node scripts/firebase-auth-domain.mjs lockin-three-zeta.vercel.app
 */
import { GoogleAuth } from "google-auth-library";

const domain = process.argv[2];
if (!domain) {
  console.error("Usage: node scripts/firebase-auth-domain.mjs <domain>");
  process.exit(1);
}

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY");
  process.exit(1);
}

const auth = new GoogleAuth({
  credentials: { client_email: clientEmail, private_key: privateKey },
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});
const client = await auth.getClient();
const token = (await client.getAccessToken()).token;
const base = `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`;

const getRes = await fetch(base, { headers: { Authorization: `Bearer ${token}` } });
if (!getRes.ok) {
  console.error("GET config failed:", getRes.status, await getRes.text());
  process.exit(1);
}
const cfg = await getRes.json();
const domains = cfg.authorizedDomains ?? [];

if (domains.includes(domain)) {
  console.log(JSON.stringify({ domain, alreadyAuthorized: true, authorizedDomains: domains }, null, 2));
  process.exit(0);
}

const next = [...domains, domain];
const patchRes = await fetch(`${base}?updateMask=authorizedDomains`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ authorizedDomains: next }),
});
if (!patchRes.ok) {
  console.error("PATCH failed:", patchRes.status, await patchRes.text());
  process.exit(1);
}
const updated = await patchRes.json();
console.log(JSON.stringify({ domain, added: true, authorizedDomains: updated.authorizedDomains }, null, 2));
