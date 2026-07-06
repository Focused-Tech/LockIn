import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names, resolving conflicts. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Format a cent amount as USD, e.g. 5100 → "$51.00". */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/**
 * Compact USD for tight card layouts: large amounts abbreviate ($21.1K, $2.5M)
 * so two pool figures never collide; amounts under $1,000 stay exact ($51.00).
 */
export function formatCentsShort(cents: number): string {
  const dollars = cents / 100;
  const abs = Math.abs(dollars);
  if (abs >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(dollars / 1_000).toFixed(1)}K`;
  return formatCents(cents);
}

/** Format a multiple, e.g. 8.5 → "8.5x". */
export function formatMultiple(multiple: number): string {
  const rounded = Math.round(multiple * 10) / 10;
  return `${rounded}x`;
}
