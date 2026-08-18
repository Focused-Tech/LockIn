import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/firebase/session";
import { isMobileClientUA } from "@/lib/mobileClient";

/**
 * Per-request tRPC context. Exposes the Firestore admin instance, the current
 * user (null when unauthenticated), and whether the request is from the
 * native app (store compliance strip — the tRPC endpoint is a public HTTP
 * route, so this can't rely on the SSR page gate; it needs its own check).
 */
export async function createContext({ req }: FetchCreateContextFnOptions) {
  const user = await getCurrentUser();
  const isMobile = isMobileClientUA(req.headers.get("user-agent"));
  return { db: adminDb(), user, isMobile };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
