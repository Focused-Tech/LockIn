"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { loginUser, sendPasswordReset } from "@/lib/firebase/auth";
import { loginSchema } from "@/lib/validation";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resetPending, setResetPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const form = new FormData(e.currentTarget);
    const parsed = loginSchema.safeParse({
      email,
      password: form.get("password"),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid details");
      return;
    }

    setPending(true);
    try {
      await loginUser(parsed.data);
      router.push("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
      setPending(false);
    }
  }

  async function onForgotPassword() {
    setError(null);
    setNotice(null);

    // A reset needs a valid email to send to — reuse the login email schema.
    const emailResult = loginSchema.shape.email.safeParse(email);
    if (!emailResult.success) {
      setError("Enter the email for your account above, then tap Forgot password?");
      return;
    }

    setResetPending(true);
    try {
      await sendPasswordReset(emailResult.data);
      setNotice(
        "If an account exists for that email, a reset link is on its way.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset email");
    } finally {
      setResetPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Email</span>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Password</span>
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>

      <button
        type="button"
        onClick={onForgotPassword}
        disabled={resetPending}
        className="self-end text-xs text-accent hover:underline disabled:opacity-50"
      >
        {resetPending ? "Sending…" : "Forgot password?"}
      </button>

      {error && (
        <div
          role="alert"
          className="rounded border border-[rgba(232,84,84,0.25)] bg-[rgba(232,84,84,0.10)] px-3 py-2 text-sm text-loss"
        >
          {error}
          <button
            type="button"
            onClick={onForgotPassword}
            disabled={resetPending}
            className="mt-1 block text-xs text-accent hover:underline disabled:opacity-50"
          >
            Forgot password?
          </button>
        </div>
      )}

      {notice && (
        <p
          role="status"
          className="rounded border border-border bg-surface px-3 py-2 text-sm text-muted"
        >
          {notice}
        </p>
      )}

      <Button
        type="submit"
        variant="accent"
        size="lg"
        className="w-full"
        disabled={pending}
      >
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
