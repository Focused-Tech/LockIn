/**
 * LEG COUNT — RULED (2026-08-23). This overrides the design references.
 *
 *   ONE topic per slate.
 *   THREE legs per slate.
 *   No slate outside the Championship presents more than FIVE questions to a player.
 *
 * `design/lockin_product_surface_v3_2026-08-17.html` renders SIX legs. That file is STALE on this
 * point and must not be copied: use it for layout, interaction and copy only, never for leg count.
 * `design/lockin_cordell_demo_v2.html` already agrees with the ruling — its chapter 2 reads
 * "one topic, three legs".
 *
 * Why a module and not three loose constants: the ruling has an exception (the Championship) and a
 * distinction that is easy to blur — how many legs a slate is BUILT with (3) versus how many
 * questions a player may be SHOWN (≤5). Keeping both, plus the validator, in one place means a call
 * site cannot accidentally honour one half of the rule.
 */

/** Topics per slate. One. A slate is about a single thing. */
export const TOPICS_PER_SLATE = 1;

/** Legs a standard slate is built with. Exactly three — not a minimum, not a maximum. */
export const LEGS_PER_SLATE = 3;

/**
 * Hard ceiling on questions presented to a player in one slate, outside the Championship.
 * A slate is built with THREE; this is the ceiling no non-Championship surface may cross.
 */
export const MAX_LEGS_PRESENTED = 5;

/** The Championship is the sole exemption, and only from the presentation ceiling. */
export type SlateKind = "standard" | "championship";

export interface LegRuleViolation {
  code: "TOPIC_COUNT" | "LEG_COUNT" | "PRESENTED_OVER_CEILING";
  /** Creator-facing. Says the number required and the number found. */
  message: string;
}

/**
 * Validate a slate's shape against the ruling. Returns every violation, not the first, so a creator
 * fixing one is not ambushed by the next.
 *
 * `presentedCount` defaults to `legCount` — they differ only where a surface shows a subset or a
 * superset of the built legs.
 */
export function validateLegRules(input: {
  topicCount: number;
  legCount: number;
  presentedCount?: number;
  kind?: SlateKind;
}): LegRuleViolation[] {
  const kind = input.kind ?? "standard";
  const presented = input.presentedCount ?? input.legCount;
  const out: LegRuleViolation[] = [];

  if (input.topicCount !== TOPICS_PER_SLATE) {
    out.push({
      code: "TOPIC_COUNT",
      message: `A slate covers one topic. This one has ${input.topicCount}.`,
    });
  }

  // The Championship is exempt from the PRESENTATION ceiling only — it still builds in threes.
  if (input.legCount !== LEGS_PER_SLATE) {
    out.push({
      code: "LEG_COUNT",
      message: `A slate has ${LEGS_PER_SLATE} legs. This one has ${input.legCount}.`,
    });
  }

  if (kind !== "championship" && presented > MAX_LEGS_PRESENTED) {
    out.push({
      code: "PRESENTED_OVER_CEILING",
      message: `A contest can show at most ${MAX_LEGS_PRESENTED} questions. This one shows ${presented}.`,
    });
  }

  return out;
}

/** True when the slate satisfies the ruling. */
export function legRulesPass(input: Parameters<typeof validateLegRules>[0]): boolean {
  return validateLegRules(input).length === 0;
}

/** The first violation's message, or null — for a single-line form error. */
export function firstLegRuleError(input: Parameters<typeof validateLegRules>[0]): string | null {
  return validateLegRules(input)[0]?.message ?? null;
}
