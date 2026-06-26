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

/** Full signup form — validated client-side before creating the Firebase user. */
export const signupSchema = z.object({
  username,
  email,
  dateOfBirth,
  password: z.string().min(8, "Password must be at least 8 characters"),
  ageConfirm: checkbox.refine((v) => v === true, {
    message: "You must confirm you are 18 or older",
  }),
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
