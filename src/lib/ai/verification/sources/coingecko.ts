import type { PredictionInput, SourceVote, VerificationSource } from "../types";
import { fetchJsonWithTimeout, overUnderChoice } from "./util";

/** Common coin tokens → CoinGecko ids. Extend as categories grow. */
const COIN_IDS: Record<string, string> = {
  btc: "bitcoin",
  bitcoin: "bitcoin",
  eth: "ethereum",
  ethereum: "ethereum",
  sol: "solana",
  solana: "solana",
  doge: "dogecoin",
  dogecoin: "dogecoin",
  ada: "cardano",
  cardano: "cardano",
  xrp: "ripple",
  ripple: "ripple",
  bnb: "binancecoin",
  avax: "avalanche-2",
  matic: "matic-network",
  link: "chainlink",
};

function coinIdFrom(question: string): string | null {
  const tokens = question.toLowerCase().split(/[^a-z0-9]+/);
  for (const t of tokens) if (COIN_IDS[t]) return COIN_IDS[t];
  return null;
}

/**
 * CoinGecko free API — authoritative for crypto over/under price questions.
 * Resolves "Will <coin> be over/under <line>?" by comparing the live spot price
 * to the line. Returns null when it can't identify the coin or hits an error.
 */
export const coingeckoSource: VerificationSource = {
  name: "coingecko",
  supports(input: PredictionInput) {
    return (
      input.category === "Crypto" &&
      input.predictionType === "over_under" &&
      input.overUnderLine !== null &&
      coinIdFrom(input.question) !== null
    );
  },
  async resolve(input): Promise<SourceVote | null> {
    const coinId = coinIdFrom(input.question);
    if (coinId === null || input.overUnderLine === null) return null;

    const data = await fetchJsonWithTimeout(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
    ).catch(() => null);
    const price = (data as Record<string, { usd?: number }> | null)?.[coinId]?.usd;
    if (typeof price !== "number") return null;

    const isOver = price >= input.overUnderLine;
    const choice = overUnderChoice(input, isOver);
    if (choice === null) return null;

    return {
      source: "coingecko",
      choice,
      confidence: 0.99,
      detail: `${coinId} spot $${price.toLocaleString()} ${isOver ? "≥" : "<"} line $${input.overUnderLine.toLocaleString()} → ${isOver ? "Over" : "Under"}`,
    };
  },
};
