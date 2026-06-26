"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Button, Card, Input } from "@/components/ui";
import { EXCLUDED_STATES } from "@/lib/constants";
import {
  saveCategories,
  skipKyc,
  verifyIdentity,
  type KycInput,
} from "./actions";

interface Category {
  name: string;
  icon: string;
}

const STEPS = ["Interests", "Verify"] as const;

export function OnboardingFlow({
  categories,
}: {
  categories: Category[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col gap-6 p-6">
      <header className="flex flex-col items-center gap-4 pt-2">
        <Logo />
        <ProgressDots count={STEPS.length} active={step} />
      </header>

      {step === 0 && (
        <CategoryStep
          categories={categories}
          onDone={() => setStep(1)}
        />
      )}
      {/* Finish onboarding -> /app, which routes lane-less accounts to the
          choose-your-journey picker (/app/choose). The first pick now happens
          in-context inside the chosen journey, not in a cold onboarding step. */}
      {step === 1 && <KycStep onDone={() => router.push("/app")} />}
    </main>
  );
}

function ProgressDots({ count, active }: { count: number; active: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className={
            "h-1.5 rounded-full transition-all " +
            (i === active
              ? "w-6 bg-accent"
              : i < active
                ? "w-1.5 bg-accent"
                : "w-1.5 bg-border")
          }
        />
      ))}
    </div>
  );
}

// ── Step 1: interests ─────────────────────────────────────────────────────────
function CategoryStep({
  categories,
  onDone,
}: {
  categories: Category[];
  onDone: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const toggle = (name: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const handleContinue = () =>
    startTransition(async () => {
      await saveCategories([...selected]);
      onDone();
    });

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">What are you into?</h1>
        <p className="mt-1 text-sm text-muted">
          Pick a few — we&apos;ll tune your feed. You can change these later.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {categories.map((c) => {
          const on = selected.has(c.name);
          return (
            <button
              key={c.name}
              type="button"
              onClick={() => toggle(c.name)}
              aria-pressed={on}
              className={
                "flex items-center gap-2 rounded border px-3 py-2.5 text-left text-sm transition-colors " +
                (on
                  ? "border-accent-border bg-accent-soft text-accent"
                  : "border-border bg-surface-card text-foreground hover:bg-[#161b25]")
              }
            >
              <span aria-hidden>{c.icon}</span>
              <span className="truncate">{c.name}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-auto flex flex-col gap-2">
        <Button
          variant="accent"
          size="lg"
          onClick={handleContinue}
          disabled={pending || selected.size === 0}
        >
          {pending ? "Saving…" : `Continue${selected.size ? ` (${selected.size})` : ""}`}
        </Button>
        <Button variant="ghost" onClick={handleContinue} disabled={pending}>
          Skip for now
        </Button>
      </div>
    </div>
  );
}

// ── Step 2: KYC ────────────────────────────────────────────────────────────────
function KycStep({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"prompt" | "form">("prompt");
  const [error, setError] = useState<string | null>(null);
  const [verifying, startTransition] = useTransition();

  const handleSkip = () =>
    startTransition(async () => {
      await skipKyc();
      onDone();
    });

  const handleVerify = (form: FormData) =>
    startTransition(async () => {
      setError(null);
      const input: KycInput = {
        fullName: String(form.get("fullName") ?? ""),
        address: String(form.get("address") ?? ""),
        city: String(form.get("city") ?? ""),
        state: String(form.get("state") ?? ""),
        zip: String(form.get("zip") ?? ""),
        ssnLast4: String(form.get("ssnLast4") ?? ""),
        phone: String(form.get("phone") ?? ""),
      };
      const result = await verifyIdentity(input);
      if (result.ok) onDone();
      else setError(result.error);
    });

  if (mode === "prompt") {
    return (
      <div className="flex flex-1 flex-col gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Verify your identity</h1>
          <p className="mt-1 text-sm text-muted">
            Required to enter paid contests and withdraw winnings. Takes about a
            minute.
          </p>
        </div>

        <Card className="text-sm text-muted">
          <p>
            We use a secure identity provider to confirm you&apos;re a real,
            eligible adult. You can always play free contests without verifying.
          </p>
        </Card>

        <div className="mt-auto flex flex-col gap-2">
          <Button variant="accent" size="lg" onClick={() => setMode("form")}>
            Verify for paid contests
          </Button>
          <Button variant="ghost" onClick={handleSkip} disabled={verifying}>
            Skip — free contests only
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      action={handleVerify}
      className="flex flex-1 flex-col gap-4"
    >
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Identity details</h1>
        <p className="mt-1 text-sm text-muted">
          Secured by our verification provider.
        </p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Full legal name</span>
        <Input name="fullName" autoComplete="name" required />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Street address</span>
        <Input name="address" autoComplete="street-address" required />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className="col-span-1 flex flex-col gap-1.5">
          <span className="text-sm text-muted">City</span>
          <Input name="city" autoComplete="address-level2" required />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">State</span>
          <Input name="state" maxLength={2} placeholder="CA" required />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">ZIP</span>
          <Input name="zip" autoComplete="postal-code" required />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">SSN (last 4)</span>
          <Input
            name="ssnLast4"
            inputMode="numeric"
            maxLength={4}
            placeholder="1234"
            required
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Phone</span>
          <Input name="phone" type="tel" autoComplete="tel" required />
        </label>
      </div>

      <p className="text-xs text-muted">
        Paid contests are unavailable in {EXCLUDED_STATES.join(", ")}.
      </p>

      {error && (
        <p
          role="alert"
          className="rounded border border-[rgba(232,84,84,0.25)] bg-[rgba(232,84,84,0.10)] px-3 py-2 text-sm text-loss"
        >
          {error}
        </p>
      )}

      <div className="mt-auto flex flex-col gap-2">
        <Button type="submit" variant="accent" size="lg" disabled={verifying}>
          {verifying ? "Verifying your identity…" : "Submit for verification"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setMode("prompt")}
          disabled={verifying}
        >
          Back
        </Button>
      </div>
    </form>
  );
}

