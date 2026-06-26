/** Public Firebase web config (safe to expose to the browser). */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** Name of the auth session cookie minted from a Firebase ID token. */
export const SESSION_COOKIE = "__session";

/** Session cookie lifetime (5 days, in ms) — within Firebase's 14-day max. */
export const SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;
