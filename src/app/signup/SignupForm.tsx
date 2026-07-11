"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { registerUser } from "@/lib/firebase/auth";
import { signupSchema, validateDobInput } from "@/lib/validation";

/** Format raw keystrokes into an MM/DD/YYYY mask as the user types. */
function maskDob(input: string): string {
  const d = input.replace(/\D/g, "").slice(0, 8); // MMDDYYYY
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

export function SignupForm({ referralCode }: { referralCode?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [dob, setDob] = useState("");
  const [dobError, setDobError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setDobError(null);

    // Validate + normalize the typed MM/DD/YYYY date to the YYYY-MM-DD the API
    // expects; show the failure inline on the field (no silent failure).
    const dobResult = validateDobInput(dob);
    if ("error" in dobResult) {
      setDobError(dobResult.error);
      return;
    }

    const form = new FormData(e.currentTarget);
    const parsed = signupSchema.safeParse({
      username: form.get("username"),
      email: form.get("email"),
      dateOfBirth: dobResult.iso,
      password: form.get("password"),
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
        <Input
          name="dateOfBirth"
          inputMode="numeric"
          autoComplete="bday"
          placeholder="MM/DD/YYYY"
          value={dob}
          onChange={(e) => {
            setDob(maskDob(e.target.value));
            if (dobError) setDobError(null);
          }}
          aria-invalid={dobError ? true : undefined}
          required
        />
        {dobError && (
          <span role="alert" className="text-xs text-loss">
            {dobError}
          </span>
        )}
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

      {/*
        Age is verified from the date of birth above — no self-attestation
        checkbox. Real-money eligibility (age + jurisdiction) is re-checked
        server-side at entry time. Only the Terms/Privacy consent remains.
      */}
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
