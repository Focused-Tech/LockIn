import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Pill } from "@/components/ui";
import { formatCents } from "@/lib/utils";

/**
 * Persistent mobile top bar (design: prototype `.top-nav`). Logo left; coin +
 * cash balances, a notification bell, and the profile avatar on the right.
 * Rendered once by {@link AppFrame} so every /app screen shares it — pages no
 * longer carry their own logo header. The bell is a visual placeholder until a
 * notifications screen exists.
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
    <header className="flex shrink-0 items-center justify-between bg-surface px-4 pb-2 pt-3">
      <Link href="/app" aria-label="LockIn home">
        <Logo />
      </Link>

      <div className="flex items-center gap-2.5">
        <Link href="/app/wallet" className="flex items-center gap-1.5">
          <Pill tone="accent">🪙 {coinBalance}</Pill>
          <Pill tone="win">{formatCents(cashBalanceCents)}</Pill>
        </Link>

        <span
          aria-hidden
          className="relative flex h-[30px] w-[30px] items-center justify-center rounded-full bg-surface-card text-sm text-muted"
        >
          🔔
          <span className="absolute right-1.5 top-1.5 h-[7px] w-[7px] rounded-full border-[1.5px] border-surface bg-accent" />
        </span>

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
