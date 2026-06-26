"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { doc, onSnapshot } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/types";
import { Button, Card } from "@/components/ui";
import { formatCents } from "@/lib/utils";
import type { Transaction } from "@/lib/wallet";
import { DepositSheet } from "./DepositSheet";
import { WithdrawSheet } from "./WithdrawSheet";

export function WalletView({
  uid,
  coinBalance: initialCoins,
  cashBalanceCents: initialCash,
  kycVerified,
  transactions,
}: {
  uid: string;
  coinBalance: number;
  cashBalanceCents: number;
  kycVerified: boolean;
  transactions: Transaction[];
}) {
  const [coins, setCoins] = useState(initialCoins);
  const [cash, setCash] = useState(initialCash);
  const [sheet, setSheet] = useState<"deposit" | "withdraw" | null>(null);

  // Live balances — the deposit webhook credits asynchronously.
  useEffect(() => {
    const unsub = onSnapshot(
      doc(getDb(), COLLECTIONS.users, uid),
      (snap) => {
        const data = snap.data();
        if (!data) return;
        if (typeof data.coinBalance === "number") setCoins(data.coinBalance);
        if (typeof data.cashBalanceCents === "number")
          setCash(data.cashBalanceCents);
      },
      () => {},
    );
    return unsub;
  }, [uid]);

  return (
    <div className="flex flex-col gap-5">
      {/* Dual balance */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-xs text-muted">Coins</p>
          <p className="mt-1 text-2xl font-semibold text-win">{coins}</p>
          <p className="mt-1 text-xs text-muted">Play free contests</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Cash</p>
          <p className="mt-1 text-2xl font-semibold text-accent">
            {formatCents(cash)}
          </p>
          <p className="mt-1 text-xs text-muted">Enter paid contests</p>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button variant="accent" size="lg" onClick={() => setSheet("deposit")}>
          Add funds
        </Button>
        <Button
          variant="neutral"
          size="lg"
          onClick={() => setSheet("withdraw")}
        >
          Withdraw
        </Button>
      </div>

      {/* KYC banner */}
      {!kycVerified && (
        <Link
          href="/onboarding"
          className="flex items-center justify-between rounded border border-accent-border bg-accent-soft px-4 py-3"
        >
          <span className="text-sm text-accent">
            Verify your identity for paid contests
          </span>
          <span className="text-sm text-accent">→</span>
        </Link>
      )}

      {/* Educational note */}
      <Card className="text-xs leading-relaxed text-muted">
        <span className="font-medium text-foreground">Coins vs cash.</span>{" "}
        Coins are free to play with and have no cash value — you earn them and
        spend them on free contests. Cash is real money: deposit it to enter paid
        contests and withdraw your winnings.
      </Card>

      {/* Transaction history */}
      <div>
        <h2 className="mb-2 text-sm font-semibold">Activity</h2>
        {transactions.length === 0 ? (
          <p className="rounded border border-border bg-surface-card p-6 text-center text-sm text-muted">
            No transactions yet.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded border border-border">
            {transactions.map((t) => (
              <TransactionRow key={t.id} txn={t} />
            ))}
          </ul>
        )}
      </div>

      <DepositSheet
        open={sheet === "deposit"}
        onClose={() => setSheet(null)}
      />
      <WithdrawSheet
        open={sheet === "withdraw"}
        onClose={() => setSheet(null)}
        availableCents={cash}
        kycVerified={kycVerified}
      />
    </div>
  );
}

function TransactionRow({ txn }: { txn: Transaction }) {
  const credit = txn.amountCents >= 0;
  const date =
    txn.timestampMs > 0
      ? new Date(txn.timestampMs).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      : "—";

  return (
    <li className="flex items-center justify-between bg-surface-card px-4 py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{txn.description}</p>
        <p className="text-xs text-muted">
          {date} · {txn.status}
        </p>
      </div>
      <span
        className={
          "text-sm font-semibold " + (credit ? "text-win" : "text-foreground")
        }
      >
        {credit ? "+" : "−"}
        {formatCents(Math.abs(txn.amountCents))}
      </span>
    </li>
  );
}
