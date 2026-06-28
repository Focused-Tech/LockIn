import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Server-side Anthropic client for the LockIn AI agent.
 *
 * Lazily constructed: instantiating at module load throws when ANTHROPIC_API_KEY
 * is absent (e.g. during `next build` page-data collection). Call at request time.
 */
let client: Anthropic | undefined;

export function getAnthropic(): Anthropic {
  return (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! }));
}

/**
 * Per-feature model config (split from a single shared constant so cost vs
 * quality is tuned per feature). Change deliberately; tiers differ in cost.
 *
 * - Slate generation + chat: high-volume / latency-sensitive → Haiku 4.5.
 * - Strategy advisor: heavier reasoning, lower volume → Sonnet 4.6 (quality).
 */
export const SLATE_MODEL = "claude-haiku-4-5-20251001";
export const CHAT_MODEL = "claude-haiku-4-5-20251001";
export const ADVISOR_MODEL = "claude-sonnet-4-6";
