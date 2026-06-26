import { router } from "./trpc";
import { slatesRouter } from "./routers/slates";

/**
 * Root tRPC router. Feature routers are mounted here as they are built
 * (e.g. wallet, creator, leaderboard).
 */
export const appRouter = router({
  slates: slatesRouter,
});

export type AppRouter = typeof appRouter;
