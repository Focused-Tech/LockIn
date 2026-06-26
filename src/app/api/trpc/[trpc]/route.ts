import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/root";
import { createContext } from "@/server/context";

/** firebase-admin (used in tRPC context) requires the Node.js runtime. */
export const runtime = "nodejs";

function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
  });
}

export { handler as GET, handler as POST };
