import { cn } from "@/lib/utils";

/**
 * LockIn wordmark image — orange "Lock" with the padlock-as-"o", white "In".
 * Swapped from the old text wordmark; this single component renders the mark in
 * every header, auth screen, splash and nav, so pointing it here updates them all.
 */
export function Logo({
  className,
  size = "md",
}: {
  className?: string;
  size?: "md" | "lg";
}) {
  const h = size === "lg" ? 42 : 22;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/wordmark-lockin.png"
      alt="LockIn"
      height={h}
      style={{ height: h, width: "auto" }}
      className={cn("block", className)}
    />
  );
}
