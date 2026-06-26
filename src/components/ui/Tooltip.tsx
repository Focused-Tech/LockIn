"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Placement = "top" | "bottom" | "left" | "right";

export interface TooltipProps {
  children: ReactNode;
  /** Side of the anchor the bubble sits on. */
  placement?: Placement;
  className?: string;
}

const bubbleStyles: Record<Placement, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

const arrowStyles: Record<Placement, string> = {
  top: "top-full left-1/2 -translate-x-1/2 -mt-1",
  bottom: "bottom-full left-1/2 -translate-x-1/2 -mb-1",
  left: "left-full top-1/2 -translate-y-1/2 -ml-1",
  right: "right-full top-1/2 -translate-y-1/2 -mr-1",
};

/**
 * Blue AI tooltip bubble (#3B8BFF). Render inside a `relative` anchor; it floats
 * on the chosen side with a matching arrow. Used by the guided onboarding tour.
 */
export function Tooltip({
  children,
  placement = "bottom",
  className,
}: TooltipProps) {
  return (
    <div
      role="tooltip"
      className={cn(
        "absolute z-30 w-64 rounded-lg border border-[rgba(59,139,255,0.35)] bg-[#0e1722] p-3 text-sm text-foreground shadow-xl",
        bubbleStyles[placement],
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute h-2 w-2 rotate-45 border border-[rgba(59,139,255,0.35)] bg-[#0e1722]",
          arrowStyles[placement],
        )}
      />
      {children}
    </div>
  );
}
