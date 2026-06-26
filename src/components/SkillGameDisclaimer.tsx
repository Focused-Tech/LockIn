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
        LockIn is a skill-based prediction contest platform. Winners are
        determined by the accuracy of their predictions, not by chance. Entry
        fees fund a shared prize pool — LockIn never bets against you and has no
        stake in any outcome.{" "}
        <span className="text-foreground">
          This is not gambling and not sports betting.
        </span>{" "}
        You must be 18 or older to participate. Paid contests are unavailable in
        WA, AZ, IA, LA, MT, and SC.
      </div>
    );
  }

  return (
    <p className={cn("text-center text-xs text-muted", className)}>
      Skill-based prediction contest platform. Not gambling. Not sports betting.
      18+.
    </p>
  );
}
