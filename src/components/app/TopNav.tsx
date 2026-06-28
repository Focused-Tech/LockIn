import Link from "next/link";
import { Pill } from "@/components/ui";
import { formatCents } from "@/lib/utils";
import { HeaderBack } from "./HeaderBack";

/**
 * Persistent mobile top bar (design: prototype `.top-nav`). Logo left; coin +
 * cash balances and the profile avatar on the right.
 * Rendered once by {@link AppFrame} so every /app screen shares it — pages no
 * longer carry their own logo header. (The notification bell was removed: it was
 * a non-interactive placeholder with a fake unread dot and no destination —
 * restore it when a real notifications screen ships.)
 */
export function TopNav({
  username,
  coinBalance,
  cashBalanceCents,
}: {
  username: string;
  coinBalance: number;
  cashBalanceCents: number;
}) {
  return (
    <header className="flex shrink-0 items-center justify-between bg-surface px-4 pb-2 pt-[calc(env(safe-area-inset-top)_+_0.75rem)]">
      <HeaderBack />

      <div className="flex items-center gap-2.5">
        <Link href="/app/wallet" className="flex items-center gap-1.5">
          <Pill tone="accent">🪙 {coinBalance}</Pill>
          <Pill tone="win">{formatCents(cashBalanceCents)}</Pill>
        </Link>

        <Link
          href="/app/profile"
          aria-label="Your profile"
          className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-accent-border bg-accent-soft text-xs font-bold text-accent"
        >
          {username.charAt(0).toUpperCase()}
        </Link>
      </div>
    </header>
  );
}
