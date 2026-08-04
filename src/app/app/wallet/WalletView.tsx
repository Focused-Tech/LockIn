"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { doc, onSnapshot } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/types";
import { formatCents } from "@/lib/utils";
import { REFERRAL_SIGNUP_COINS } from "@/lib/constants";
import type { Transaction } from "@/lib/wallet";
import { DepositSheet } from "./DepositSheet";
import { WithdrawSheet } from "./WithdrawSheet";

/**
 * WALLET — one currency per mode (two-currency rule). ADVANCED holds cash and is the
 * only place money moves: balance, deposit/withdraw (the real Stripe sheets, unchanged),
 * payment method, cash activity. BEGINNER holds coins: balance, ways to earn, coin note.
 * NO DOLLAR FIGURE EVER RENDERS IN BEGINNER.
 */
export function WalletView({
  uid,
  advanced,
  coinBalance: initialCoins,
  cashBalanceCents: initialCash,
  kycVerified,
  transactions,
}: {
  uid: string;
  advanced: boolean;
  coinBalance: number;
  cashBalanceCents: number;
  kycVerified: boolean;
  transactions: Transaction[];
}) {
  const [coins, setCoins] = useState(initialCoins);
  const [cash, setCash] = useState(initialCash);
  const [sheet, setSheet] = useState<"deposit" | "withdraw" | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(getDb(), COLLECTIONS.users, uid),
      (snap) => {
        const data = snap.data();
        if (!data) return;
        if (typeof data.coinBalance === "number") setCoins(data.coinBalance);
        if (typeof data.cashBalanceCents === "number") setCash(data.cashBalanceCents);
      },
      () => {},
    );
    return unsub;
  }, [uid]);

  if (!advanced) {
    return (
      <div className="lk-acct flex flex-col gap-4 p-4 pb-24">
        <div className="blk coin">
          <div className="lb">Coin balance <i></i></div>
          <div className="hero">
            <div className="k">Your score in beginner mode</div>
            <div className="v coin">{coins.toLocaleString()}</div>
            <div className="sub">Coins are score — they buy nothing and never convert to cash</div>
          </div>
          <div className="btns">
            <Link href="/app/beginner" className="btn pri text-center">
              Earn more
            </Link>
          </div>
        </div>

        <div className="blk">
          <div className="lb">Ways to earn <i></i></div>
          <div className="row static">
            <span className="n"><b>Finish a slate</b><span>Every contest you complete</span></span>
            <span className="val coin">score</span>
          </div>
          <div className="row static">
            <span className="n"><b>Invite a friend</b><span>When they play their first slate</span></span>
            <span className="val coin">+{REFERRAL_SIGNUP_COINS}</span>
          </div>
        </div>

        <div className="blk">
          <div className="lb">Recent activity <i></i></div>
          <p className="hint">Your coin play shows up here once you enter a beginner contest.</p>
        </div>

        <p className="hint">Coins are score. They buy nothing and never convert to cash.</p>
      </div>
    );
  }

  return (
    <div className="lk-acct flex flex-col gap-4 p-4 pb-24">
      {/* Cash balance */}
      <div className="blk money">
        <div className="lb">Cash balance <i></i></div>
        <div className="hero">
          <div className="k">Available to play or withdraw</div>
          <div className="v cash">{formatCents(cash)}</div>
          <div className="sub">Entry fees leave your balance when a contest locks, not when you pick</div>
        </div>
        <div className="btns">
          <button type="button" className="btn pri" onClick={() => setSheet("deposit")}>
            Deposit
          </button>
          <button type="button" className="btn" onClick={() => setSheet("withdraw")}>
            Withdraw
          </button>
        </div>
      </div>

      {!kycVerified && (
        <Link href="/onboarding" className="blk act block">
          <div className="flex items-center gap-3">
            <span className="n min-w-0 flex-1">
              <b className="block text-[15px] font-semibold text-white">Verify your identity</b>
              <span className="block text-[11.5px] text-[#6E7787]">Required before you can withdraw</span>
            </span>
            <span className="text-[19px] leading-none text-[#fc3e01]">›</span>
          </div>
        </Link>
      )}

      {/* Payment method */}
      <div className="blk">
        <div className="lb">Payment method <i></i></div>
        <button type="button" className="row" onClick={() => setSheet("deposit")}>
          <span className="n"><b>Add a card or bank</b><span>Used for deposits and payouts</span></span>
          <span className="cv">›</span>
        </button>
        <div className="row static">
          <span className="n"><b>Payout account</b><span>Where winnings are sent</span></span>
          <span className="val muted">Not set</span>
        </div>
      </div>

      {/* Recent activity */}
      <div className="blk">
        <div className="lb">Recent activity <i></i></div>
        {transactions.length === 0 ? (
          <p className="hint">No activity yet.</p>
        ) : (
          transactions.map((t) => <TxnRow key={t.id} txn={t} />)
        )}
      </div>

      <p className="hint">
        Withdrawals go back to the method you deposited with. Entry fees leave your balance when a contest locks, not when you pick.
      </p>

      <DepositSheet open={sheet === "deposit"} onClose={() => setSheet(null)} />
      <WithdrawSheet
        open={sheet === "withdraw"}
        onClose={() => setSheet(null)}
        availableCents={cash}
        kycVerified={kycVerified}
      />
    </div>
  );
}

function TxnRow({ txn }: { txn: Transaction }) {
  const credit = txn.amountCents >= 0;
  const date =
    txn.timestampMs > 0
      ? new Date(txn.timestampMs).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "—";
  return (
    <div className="row static">
      <span className="n">
        <b>{txn.description}</b>
        <span>
          {date} · {txn.status}
        </span>
      </span>
      <span className={"val " + (credit ? "cash" : "neg")}>
        {credit ? "+" : "−"}
        {formatCents(Math.abs(txn.amountCents))}
      </span>
    </div>
  );
}
