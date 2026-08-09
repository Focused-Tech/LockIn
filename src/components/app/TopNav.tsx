import { HeaderBack } from "./HeaderBack";
import { AccountMenu } from "./AccountMenu";

/**
 * Persistent mobile top bar (design: prototype `.top-nav`). Logo left; the profile avatar on the
 * right. NO balances here — architect ruling: coin + cash appear ONLY in the profile and the wallet
 * (this header previously kept the coin chip, which is the regression being removed).
 */
export function TopNav({
  username,
  isKeyholder = false,
  isKeymaster = false,
  isAdmin = false,
}: {
  username: string;
  isKeyholder?: boolean;
  isKeymaster?: boolean;
  isAdmin?: boolean;
}) {
  return (
    <header className="flex shrink-0 items-center justify-between bg-surface px-4 pb-2 pt-[calc(env(safe-area-inset-top)_+_0.75rem)]">
      <HeaderBack />
      <AccountMenu username={username} isKeyholder={isKeyholder} isKeymaster={isKeymaster} isAdmin={isAdmin} />
    </header>
  );
}
