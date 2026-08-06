import Link from "next/link";
import { Pill } from "@/components/ui";
import { HeaderBack } from "./HeaderBack";
import { AccountMenu } from "./AccountMenu";

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
        {/* Header carries the COIN balance only — it's the user's score, not sensitive. The CASH
            balance is removed from the header (no room to mask it here); cash is masked-by-default
            in the Wallet + Profile instead. */}
        <Link href="/app/wallet" className="flex items-center gap-1.5">
          <Pill tone="accent">🪙 {coinBalance}</Pill>
        </Link>

        <AccountMenu username={username} />
      </div>
    </header>
  );
}
