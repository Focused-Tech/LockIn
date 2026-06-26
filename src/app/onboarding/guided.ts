/** Shape consumed by the guided-pick tour in step 3. */
export interface GuidedSlate {
  title: string;
  category: string;
  prizePoolCents: number;
  firstPlaceMultiple: number;
  prediction: {
    question: string;
    optionA: string;
    optionB: string;
    probA: number;
    probB: number;
  };
}

/** Fallback used when no live slate exists yet (e.g. fresh database). */
export const SAMPLE_SLATE: GuidedSlate = {
  title: "Daytona 500 — Final Lap Showdown",
  category: "NASCAR",
  prizePoolCents: 2_485_000, // $24,850
  firstPlaceMultiple: 42.5,
  prediction: {
    question: "Who finishes higher?",
    optionA: "Chase Elliott",
    optionB: "Ryan Blaney",
    probA: 58,
    probB: 42,
  },
};
