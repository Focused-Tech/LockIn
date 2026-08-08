/**
 * KEYHOLDER ATTRIBUTION — pure, first-touch, immutable.
 *
 * Attribution rides the EXISTING referral rail (code = username, resolved at signup). The only thing
 * added here is: when the resolved referrer is a keyholder, the referred account is stamped ONCE with
 * that keyholder (and their keymaster upline). Callers write the stamp at account creation and NEVER
 * again — there is no update path, and the field is absent from the firestore.rules client whitelist,
 * so a re-signup or any later write can never re-attribute an account.
 */

export interface KeyholderStamp {
  keyholderUid: string;
  keymasterUid: string | null;
}

/** The minimal referrer shape needed to decide attribution. */
export interface ReferrerLike {
  uid: string;
  keyholder?: boolean;
  keymasterUid?: string | null;
}

/**
 * The first-touch keyholder stamp for a resolved referrer, or null when the referrer is not a
 * keyholder (ordinary referrals are untouched). Pure — same input, same output, no side effects.
 */
export function keyholderStampFor(referrer: ReferrerLike | null | undefined): KeyholderStamp | null {
  if (!referrer || !referrer.keyholder) return null;
  return { keyholderUid: referrer.uid, keymasterUid: referrer.keymasterUid ?? null };
}
