import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className, type = "text", ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      "h-10 w-full rounded border border-border bg-surface px-3 text-sm text-foreground",
      "placeholder:text-muted",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-border",
      "disabled:opacity-35 disabled:pointer-events-none",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
