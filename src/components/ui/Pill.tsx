import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "accent" | "win" | "loss" | "live" | "rush" | "ai";

export interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

/** Small translucent status/probability pill. */
const toneStyles: Record<Tone, string> = {
  neutral: "bg-surface-card text-muted border-border",
  accent: "bg-accent-soft text-accent border-accent-border",
  win: "bg-[rgba(34,197,94,0.10)] text-win border-[rgba(34,197,94,0.25)]",
  loss: "bg-[rgba(232,84,84,0.10)] text-loss border-[rgba(232,84,84,0.25)]",
  live: "bg-[rgba(245,166,35,0.10)] text-live border-[rgba(245,166,35,0.25)]",
  rush: "bg-rush-soft text-rush border-rush-border",
  ai: "bg-[rgba(59,139,255,0.10)] text-ai border-[rgba(59,139,255,0.25)]",
};

export function Pill({ className, tone = "neutral", ...props }: PillProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3 py-0.5 text-xs font-medium",
        toneStyles[tone],
        className,
      )}
      {...props}
    />
  );
}
