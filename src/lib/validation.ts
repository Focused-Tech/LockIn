import { z } from "zod";
import { MIN_AGE } from "./constants";

/** Whole years between a date-of-birth (YYYY-MM-DD) and today. */
export function ageFromDob(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

/**
 * Validate a typed MM/DD/YYYY date of birth and normalize to YYYY-MM-DD (the
 * format the rest of the app + the signup API expect). Returns `{ iso }` on
 * success, or `{ error }` with user-facing copy for an inline message.
 *
 * Rejects malformed input, impossible calendar dates (e.g. 02/30/1975,
 * 13/01/2000 — caught by the round-trip through Date), and under-18 birthdates.
 */
export function validateDobInput(
  raw: string,
): { iso: string } | { error: string } {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw.trim());
  if (!m) return { error: "Enter your date of birth as MM/DD/YYYY" };

  const month = Number(m[1]);
  const day = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return { error: "Enter a real calendar date (MM/DD/YYYY)" };
  }
  // Round-trip through Date to reject impossible dates like 02/30 or 04/31.
  const d = new Date(year, month - 1, day);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return { error: "Enter a real calendar date (MM/DD/YYYY)" };
  }

  const iso = `${m[3]}-${m[1]}-${m[2]}`;
  if (ageFromDob(iso) < MIN_AGE) {
    return { error: `You must be ${MIN_AGE} or older to sign up` };
  }
  return { iso };
}

/** Checkbox inputs arrive as "on" when checked, absent otherwise. */
const checkbox = z.preprocess(
  (v) => v === "on" || v === "true" || v === true,
  z.boolean(),
);

const username = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(24, "Username must be 24 characters or fewer")
  .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, and underscores only");

const email = z.string().trim().toLowerCase().email("Enter a valid email");

const dateOfBirth = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter your date of birth")
  .refine((dob) => ageFromDob(dob) >= MIN_AGE, {
    message: `You must be ${MIN_AGE} or older to use LockIn`,
  });

/**
 * Full signup form — validated client-side before creating the Firebase user.
 *
 * NOTE: age is NOT self-attested via a checkbox anymore. It is DERIVED from
 * `dateOfBirth` (which enforces `MIN_AGE` above) at signup, and real-money
 * eligibility is re-checked server-side per jurisdiction at entry time
 * (`src/lib/eligibility`). The Terms/Privacy consent checkbox stays required.
 */
export const signupSchema = z.object({
  username,
  email,
  dateOfBirth,
  password: z.string().min(8, "Password must be at least 8 characters"),
  tosConfirm: checkbox.refine((v) => v === true, {
    message: "You must accept the Terms, Privacy, and Responsible Play policies",
  }),
});

/** Profile fields the signup API persists after verifying the Firebase ID token. */
export const signupProfileSchema = z.object({ username, dateOfBirth });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password"),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type SignupProfileInput = z.infer<typeof signupProfileSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
