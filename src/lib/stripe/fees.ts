import { STRIPE_CARD_FEE, type PaymentMethodKind } from "@/lib/constants";
import type { Cents } from "@/lib/types";

/**
 * Card processing fee passed to the customer on a deposit.
 *
 * Fees are 100% customer-borne (LockIn pays $0). To guarantee LockIn nets the
 * intended deposit, we gross up: customer pays `amount + fee` where the fee is
 * computed on the total charge, not the net.
 *
 * fee = (net·p + f) / (1 − p), rounded up to the nearest cent.
 */
export function cardFeeForDeposit(netCents: Cents): Cents {
  const { percent: p, fixedCents: f } = STRIPE_CARD_FEE;
  const fee = (netCents * p + f) / (1 - p);
  return Math.ceil(fee);
}

/** Total the customer is charged for a card deposit (net + grossed-up fee). */
export function totalChargeForDeposit(netCents: Cents): Cents {
  return netCents + cardFeeForDeposit(netCents);
}

/** Processing fee for a deposit by rail. ACH (bank transfer) is fee-free. */
export function depositFeeCents(
  netCents: Cents,
  method: PaymentMethodKind,
): Cents {
  return method === "ach" ? 0 : cardFeeForDeposit(netCents);
}

/** Total charged for a deposit by rail (net + fee). */
export function depositTotalCents(
  netCents: Cents,
  method: PaymentMethodKind,
): Cents {
  return netCents + depositFeeCents(netCents, method);
}
