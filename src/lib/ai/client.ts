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
 * Model for the AI agent. Sonnet 4.6 is the project's documented choice
 * (HANDOFF.md) — the right tier for a high-volume, latency-sensitive chat
 * assistant. Change deliberately; higher tiers cost more per token.
 */
export const AI_MODEL = "claude-sonnet-4-6";
