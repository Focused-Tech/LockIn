"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { registerUser } from "@/lib/firebase/auth";
import { signupSchema } from "@/lib/validation";

export function SignupForm({ referralCode }: { referralCode?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const parsed = signupSchema.safeParse({
      username: form.get("username"),
      email: form.get("email"),
      dateOfBirth: form.get("dateOfBirth"),
      password: form.get("password"),
      ageConfirm: form.get("ageConfirm"),
      tosConfirm: form.get("tosConfirm"),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid details");
      return;
    }

    setPending(true);
    try {
      await registerUser({
        email: parsed.data.email,
        password: parsed.data.password,
        username: parsed.data.username,
        dateOfBirth: parsed.data.dateOfBirth,
        ref: referralCode,
      });
      router.push("/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Username</span>
        <Input name="username" autoComplete="username" required />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Email</span>
        <Input name="email" type="email" autoComplete="email" required />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Date of birth</span>
        <Input name="dateOfBirth" type="date" required />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Password</span>
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          required
        />
      </label>

      <label className="flex items-start gap-2.5 text-sm text-foreground">
        <input
          type="checkbox"
          name="ageConfirm"
          className="mt-0.5 accent-accent"
          required
        />
        <span>I confirm I am 18 years of age or older</span>
      </label>

      <label className="flex items-start gap-2.5 text-sm text-foreground">
        <input
          type="checkbox"
          name="tosConfirm"
          className="mt-0.5 accent-accent"
          required
        />
        <span>
          I agree to the Terms of Service, Privacy Policy, and Responsible Play
          Policy
        </span>
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
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
