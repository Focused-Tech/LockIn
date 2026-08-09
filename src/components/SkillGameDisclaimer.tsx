import { cn } from "@/lib/utils";

/**
 * Standardized skill-game disclaimer. `variant="footer"` is the one-line legal
 * footer; `variant="block"` is the fuller block shown at signup.
 */
export function SkillGameDisclaimer({
  variant = "footer",
  className,
}: {
  variant?: "footer" | "block";
  className?: string;
}) {
  if (variant === "block") {
    return (
      <div
        className={cn(
          "rounded border border-border bg-surface p-3 text-xs leading-relaxed text-muted",
          className,
        )}
      >
        LockIn runs skill contests. Winners are decided by the accuracy of their
        picks and their lock-in speed — knowledge and judgment, not chance. Entry
        fees fund a shared prize pool that LockIn has no stake in.{" "}
        <span className="text-foreground">The best cards win the pool.</span>{" "}
        You must be 18 or older to participate. Paid contests are unavailable in
        WA, AZ, IA, LA, MT, and SC.
      </div>
    );
  }

  return (
    <p className={cn("text-center text-xs text-muted", className)}>
      A skill contest — knowledge and lock-in speed decide the winners. 18+.
    </p>
  );
}
