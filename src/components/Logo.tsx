import { cn } from "@/lib/utils";

/** LockIn wordmark. The only place all-caps + the solid cayenne color is used. */
export function Logo({
  className,
  size = "md",
}: {
  className?: string;
  size?: "md" | "lg";
}) {
  return (
    <span
      className={cn(
        "font-bold tracking-tight text-accent",
        size === "lg" ? "text-4xl" : "text-xl",
        className,
      )}
    >
      LockIn
    </span>
  );
}
