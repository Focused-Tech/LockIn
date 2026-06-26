"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { loginUser } from "@/lib/firebase/auth";
import { loginSchema } from "@/lib/validation";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const parsed = loginSchema.safeParse({
      email: form.get("email"),
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

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Email</span>
        <Input name="email" type="email" autoComplete="email" required />
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

      {error && (
        <p
          role="alert"
          className="rounded border border-[rgba(232,84,84,0.25)] bg-[rgba(232,84,84,0.10)] px-3 py-2 text-sm text-loss"
        >
          {error}
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
