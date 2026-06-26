import { forwardRef, type ButtonHTMLAttributes } from "react";
import Link, { type LinkProps } from "next/link";
import { cn } from "@/lib/utils";

type Variant = "accent" | "rush" | "neutral" | "ghost";
type Size = "sm" | "md" | "lg";

/**
 * Translucent button styling — NEVER a solid color fill. Accent/rush variants
 * use a translucent background + solid text + subtle border, per the design
 * system. Shared by {@link Button} and {@link ButtonLink}.
 */
const variantStyles: Record<Variant, string> = {
  accent:
    "bg-accent-soft text-accent border border-accent-border hover:bg-[rgba(255,59,0,0.16)]",
  rush:
    "bg-rush-soft text-rush border border-rush-border hover:bg-[rgba(155,93,229,0.16)]",
  neutral:
    "bg-surface-card text-foreground border border-border hover:bg-[#161b25]",
  ghost:
    "bg-transparent text-muted border border-transparent hover:text-foreground hover:bg-surface-card",
};

const sizeStyles: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

const base =
  "inline-flex items-center justify-center rounded font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-border " +
  "disabled:opacity-35 disabled:pointer-events-none";

export function buttonClasses(
  variant: Variant = "neutral",
  size: Size = "md",
  className?: string,
): string {
  return cn(base, variantStyles[variant], sizeStyles[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "neutral", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={buttonClasses(variant, size, className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export interface ButtonLinkProps
  extends LinkProps,
    Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> {
  variant?: Variant;
  size?: Size;
  className?: string;
}

/** A Next.js Link styled as a button — renders a real <a>, valid for navigation. */
export function ButtonLink({
  className,
  variant = "neutral",
  size = "md",
  ...props
}: ButtonLinkProps) {
  return <Link className={buttonClasses(variant, size, className)} {...props} />;
}
