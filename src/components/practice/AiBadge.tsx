import { PRACTICE_CONFIG } from "@/lib/practice/config";

/**
 * The honest "AI" label for AI-simulated creators. CLEAR by default (a pill) so
 * players always know AI vs (future) real creators — never disguised as a real
 * person. Prominence is config-driven (PRACTICE_CONFIG.aiCreators.labelStyle).
 */
export function AiBadge({
  long = false,
  className = "",
}: {
  /** Show the expanded "AI training opponent" framing. */
  long?: boolean;
  className?: string;
}) {
  const cfg = PRACTICE_CONFIG.aiCreators;
  const text = long ? cfg.labelLong : cfg.label;

  if (cfg.labelStyle === "subtle") {
    return (
      <span className={"text-[10px] font-medium uppercase tracking-wider text-muted " + className}>
        {text}
      </span>
    );
  }

  // "badge" — clear, readable AI-blue pill (the project's AI agent colour).
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full border border-[rgba(59,139,255,0.35)] bg-[rgba(59,139,255,0.12)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ai " +
        className
      }
    >
      <span aria-hidden>🤖</span>
      {text}
    </span>
  );
}
