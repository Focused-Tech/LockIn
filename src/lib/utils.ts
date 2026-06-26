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

/** Format a multiple, e.g. 8.5 → "8.5x". */
export function formatMultiple(multiple: number): string {
  const rounded = Math.round(multiple * 10) / 10;
  return `${rounded}x`;
}
