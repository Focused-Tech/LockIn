import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { fetchFeedSlates } from "../data/slates";

export const slatesRouter = router({
  /** Explore feed: live/locked slates with predictions, optionally filtered. */
  list: publicProcedure
    .input(z.object({ category: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      // store compliance strip — this is a public HTTP endpoint, gate the payload directly rather
      // than trusting the SSR page that normally calls fetchFeedSlates.
      const slates = await fetchFeedSlates(ctx.db, { blockCashEntertainment: ctx.isMobile });
      if (input?.category) {
        return slates.filter((s) => s.category === input.category);
      }
      return slates;
    }),
});
