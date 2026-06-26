"use client";

import {
  createUserWithEmailAndPassword,
  deleteUser,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { getClientAuth } from "./client";

/** Map Firebase Auth error codes to friendly copy. */
function authMessage(code: string): string {
  switch (code) {
    case "auth/email-already-in-use":
      return "An account with that email already exists";
    case "auth/invalid-email":
      return "Enter a valid email";
    case "auth/weak-password":
      return "Password must be at least 8 characters";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password";
    case "auth/too-many-requests":
      return "Too many attempts. Try again later.";
    default:
      return "Something went wrong. Please try again.";
  }
}

function firebaseErrorCode(err: unknown): string {
  return typeof err === "object" && err !== null && "code" in err
    ? String((err as { code: unknown }).code)
    : "";
}

/**
 * Register: create the Firebase Auth user, then create the profile + session
 * cookie via the signup API. Rolls back the auth user on a server-side conflict.
 */
export async function registerUser(input: {
  email: string;
  password: string;
  username: string;
  dateOfBirth: string;
  ref?: string;
}): Promise<void> {
  let cred;
  try {
    cred = await createUserWithEmailAndPassword(
      getClientAuth(),
      input.email,
      input.password,
    );
  } catch (err) {
    throw new Error(authMessage(firebaseErrorCode(err)));
  }

  const idToken = await cred.user.getIdToken();
  const res = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idToken,
      username: input.username,
      dateOfBirth: input.dateOfBirth,
      ref: input.ref,
    }),
  });

  if (!res.ok) {
    // The profile wasn't created — remove the orphaned auth user so the email
    // and username stay reusable.
    await deleteUser(cred.user).catch(() => {});
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Could not complete signup");
  }
}

/** Sign in and mint the session cookie. */
export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<void> {
  let idToken: string;
  try {
    const cred = await signInWithEmailAndPassword(
      getClientAuth(),
      input.email,
      input.password,
    );
    idToken = await cred.user.getIdToken();
  } catch (err) {
    throw new Error(authMessage(firebaseErrorCode(err)));
  }

  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) throw new Error("Could not start your session");
}

/**
 * Send a password-reset email via Firebase Auth. Stays neutral about whether
 * the address is registered: `auth/user-not-found` is swallowed so the caller
 * always shows the same confirmation. Only genuinely actionable errors (bad
 * email, rate limiting) are surfaced.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(getClientAuth(), email);
  } catch (err) {
    const code = firebaseErrorCode(err);
    if (code === "auth/invalid-email") throw new Error("Enter a valid email");
    if (code === "auth/too-many-requests") {
      throw new Error("Too many attempts. Try again later.");
    }
    // auth/user-not-found and anything else → swallow; the caller shows the
    // neutral "if an account exists…" confirmation regardless.
  }
}

/** Sign out: clear client auth state and the session cookie. */
export async function logoutUser(): Promise<void> {
  await signOut(getClientAuth()).catch(() => {});
  await fetch("/api/auth/session", { method: "DELETE" });
}
