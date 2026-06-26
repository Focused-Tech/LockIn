import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/firebase/session";

/**
 * Per-request tRPC context. Exposes the Firestore admin instance and the
 * current user (null when unauthenticated).
 */
export async function createContext() {
  const user = await getCurrentUser();
  return { db: adminDb(), user };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
