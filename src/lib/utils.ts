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

/** One decimal, but drop a trailing ".0" (10 → "10", 3.5 → "3.5", 30.5 → "30.5"). */
function oneDecimal(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

/**
 * Compact USD for tight card layouts: amounts of $1,000+ (four or more digits) abbreviate with a
 * lowercase k / M — $3.5k, $30.5k, $10k, $2.5M — so figures never collide; under $1,000 stays exact.
 */
export function formatCentsShort(cents: number): string {
  const dollars = cents / 100;
  const abs = Math.abs(dollars);
  if (abs >= 1_000_000) return `$${oneDecimal(dollars / 1_000_000)}M`;
  if (abs >= 1_000) return `$${oneDecimal(dollars / 1_000)}k`;
  return formatCents(cents);
}

/** Compact a plain count the same way: 5240 → "5.2k", 1_200_000 → "1.2M"; under 1000 stays exact. */
export function formatCountShort(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${oneDecimal(n / 1_000_000)}M`;
  if (abs >= 1_000) return `${oneDecimal(n / 1_000)}k`;
  return n.toLocaleString("en-US");
}

/** Format a multiple, e.g. 8.5 → "8.5x". */
export function formatMultiple(multiple: number): string {
  const rounded = Math.round(multiple * 10) / 10;
  return `${rounded}x`;
}
