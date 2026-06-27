"use client";

import {
  createUserWithEmailAndPassword,
  deleteUser,
  getRedirectResult,
  GoogleAuthProvider,
  OAuthProvider,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
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

// ── Social sign-in (Google / Apple) ─────────────────────────────────────────────

export type SocialProvider = "google" | "apple";

/** Minimal shape of the native FirebaseAuthentication plugin call we use. */
interface NativeFirebaseAuth {
  signInWithGoogle(): Promise<{
    credential?: { idToken?: string | null } | null;
  }>;
}

/** Friendly copy for the social-specific Firebase Auth error codes. */
function socialAuthMessage(code: string): string {
  switch (code) {
    case "auth/operation-not-allowed":
      return "That sign-in method isn't enabled yet. Try email, or check back soon.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
    case "auth/user-cancelled":
      return "Sign-in cancelled.";
    case "auth/popup-blocked":
      return "Your browser blocked the sign-in window. Allow popups and try again.";
    case "auth/account-exists-with-different-credential":
      return "An account already exists for this email. Sign in with your original method.";
    case "auth/unauthorized-domain":
      return "This site isn't authorized for social sign-in yet.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return "Could not complete sign-in. Please try again.";
  }
}

function buildProvider(kind: SocialProvider) {
  if (kind === "google") {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    return provider;
  }
  // Apple via Firebase's generic OIDC provider.
  const provider = new OAuthProvider("apple.com");
  provider.addScope("email");
  provider.addScope("name");
  return provider;
}

/**
 * True inside the Capacitor native WebView, where OAuth popups don't work —
 * we use a full-page redirect there instead. Detected via the injected
 * `window.Capacitor` global (no @capacitor/core import needed).
 */
function isNativeWebView(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean };
  }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

/** Exchange a signed-in provider user for our session cookie + profile. */
async function mintSocialSession(
  user: User,
  ref?: string,
): Promise<{ isNewUser: boolean }> {
  const idToken = await user.getIdToken();
  const res = await fetch("/api/auth/social", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idToken,
      displayName: user.displayName ?? null,
      photoURL: user.photoURL ?? null,
      ref,
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Could not complete sign-in");
  }
  const body = (await res.json()) as { isNewUser: boolean };
  return { isNewUser: body.isNewUser };
}

/**
 * Start social sign-in.
 *  - Web: a popup completes inline → returns `{ completed: true, isNewUser }`.
 *  - Native (Capacitor WebView): kicks off a full-page redirect → returns
 *    `{ completed: false }`; the result is finished by {@link completeSocialRedirect}
 *    when the app reloads back onto the auth screen.
 */
export async function signInWithProvider(
  kind: SocialProvider,
  ref?: string,
): Promise<{ completed: boolean; isNewUser?: boolean }> {
  const auth = getClientAuth();
  const provider = buildProvider(kind);

  if (isNativeWebView()) {
    // NATIVE GOOGLE: use the @capacitor-firebase/authentication plugin via the
    // Capacitor bridge (Play Services / system browser) — NOT a WebView redirect,
    // which Google blocks with `disallowed_useragent`. We only need its ID token,
    // then sign into the JS SDK so the rest of the flow is identical to web. We
    // reach it through registerPlugin (not an npm import) so the web bundle never
    // pulls in the plugin's firebase-12 web implementation.
    if (kind === "google") {
      try {
        const { registerPlugin } = await import("@capacitor/core");
        const FirebaseAuthentication = registerPlugin<NativeFirebaseAuth>(
          "FirebaseAuthentication",
        );
        const result = await FirebaseAuthentication.signInWithGoogle();
        const idToken = result?.credential?.idToken;
        if (!idToken) throw new Error("No Google credential returned");
        const userCred = await signInWithCredential(
          auth,
          GoogleAuthProvider.credential(idToken),
        );
        const { isNewUser } = await mintSocialSession(userCred.user, ref);
        return { completed: true, isNewUser };
      } catch (err) {
        const code = firebaseErrorCode(err);
        throw new Error(
          code ? socialAuthMessage(code) : (err as Error).message,
        );
      }
    }

    // Apple (and any fallback) on native: full-page redirect for now. Native
    // Apple sign-in (the plugin's signInWithApple) is wired when we're on iOS.
    if (ref) {
      try {
        sessionStorage.setItem("lockin.socialRef", ref);
      } catch {
        /* storage blocked — referral simply won't apply */
      }
    }
    try {
      await signInWithRedirect(auth, provider);
    } catch (err) {
      throw new Error(socialAuthMessage(firebaseErrorCode(err)));
    }
    return { completed: false };
  }

  try {
    const cred = await signInWithPopup(auth, provider);
    const { isNewUser } = await mintSocialSession(cred.user, ref);
    return { completed: true, isNewUser };
  } catch (err) {
    // Re-throw our own server errors (Error without a Firebase code) as-is.
    const code = firebaseErrorCode(err);
    throw new Error(code ? socialAuthMessage(code) : (err as Error).message);
  }
}

/**
 * Finish a redirect-based social sign-in. Call once on the auth screen's mount;
 * returns the routing decision when a redirect just completed, else null.
 */
export async function completeSocialRedirect(): Promise<
  { isNewUser: boolean } | null
> {
  const auth = getClientAuth();
  let result;
  try {
    result = await getRedirectResult(auth);
  } catch (err) {
    throw new Error(socialAuthMessage(firebaseErrorCode(err)));
  }
  if (!result?.user) return null;

  let ref: string | undefined;
  try {
    ref = sessionStorage.getItem("lockin.socialRef") ?? undefined;
    sessionStorage.removeItem("lockin.socialRef");
  } catch {
    /* ignore */
  }
  return mintSocialSession(result.user, ref);
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
