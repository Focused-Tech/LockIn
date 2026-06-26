import { cn } from "@/lib/utils";

/**
 * The LockIn Pro badge — a small translucent blue (#3B8BFF / `ai`) marker shown
 * next to a Pro subscriber's name. Inline by default; pass `className` to tweak.
 */
export function ProBadge({ className }: { className?: string }) {
  return (
    <span
      title="LockIn Pro member"
      className={cn(
        "inline-flex items-center rounded border border-ai/40 bg-[rgba(59,139,255,0.12)] px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide text-ai",
        className,
      )}
    >
      Pro
    </span>
  );
}
