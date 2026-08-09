"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Button, Card, Input } from "@/components/ui";
import { EXCLUDED_STATES } from "@/lib/constants";
import type { JourneyLane } from "@/lib/firebase/types";
import { setJourneyLane } from "@/app/app/beginner/actions";
import { TutorialLauncher } from "@/components/app/TutorialLauncher";
import type { TutorialMode } from "@/lib/tutorial/tutorials";
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

const STEPS = ["Interests", "Verify", "Journey"] as const;

/** The four journeys — same set as the /app/choose picker. Beginner/Advanced set a feed LANE;
 *  Creator and the Fox Pit are entry points (no lane). Each fires its own tutorial, then routes. */
interface Journey {
  key: string;
  title: string;
  body: string;
  color: "creator" | "orange";
  tag: string;
  lane: JourneyLane | null;
  href: string;
  mode: TutorialMode;
}
// CANON ORDER (from the Fox Pit): Creator · Advanced · Beginner · Fox Pit. Do not reorder.
const JOURNEYS: Journey[] = [
  {
    key: "creator",
    title: "Creator — host contests",
    body: "Build prediction slates with AI-drafted questions, sell pick packages, and earn.",
    color: "creator", tag: "Cash", lane: null, href: "/app/creator", mode: "creator",
  },
  {
    key: "advanced",
    title: "Advanced — full market",
    body: "Every contest, every category, real payouts. Lock In to win.",
    color: "orange", tag: "Cash", lane: "advanced", href: "/app", mode: "advanced",
  },
  {
    key: "beginner",
    title: "Beginner — simple & guided",
    body: "Creator picks, plain-language calls, all in coins. We teach you up to the full game, step by step.",
    color: "creator", tag: "Coins", lane: "beginner", href: "/app/beginner", mode: "beginner",
  },
  {
    key: "foxpit",
    title: "The Fox Pit — practice journey",
    body: "Walk into the Pit. Choose the floor, face the boss, run it back.",
    color: "orange", tag: "Coins", lane: null, href: "/app/foxpit", mode: "lone_fox",
  },
];

export function OnboardingFlow({
  categories,
}: {
  categories: Category[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  // The journey pick is the FINAL onboarding step; once chosen, the tutorial fires right here (for
  // the chosen mode) before the user ever reaches the app.
  const [picked, setPicked] = useState<{ mode: TutorialMode; href: string } | null>(null);
  const [saving, startSaving] = useTransition();

  const pickJourney = (j: Journey) =>
    startSaving(async () => {
      if (j.lane) await setJourneyLane(j.lane); // Creator / Fox Pit are entry points, not lanes
      setPicked({ mode: j.mode, href: j.href }); // reveals the tutorial for this mode
    });

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
      {/* Verify (or skip) → the journey pick, now the final onboarding step. */}
      {step === 1 && <KycStep onDone={() => setStep(2)} />}
      {step === 2 && !picked && (
        <JourneyStep onPick={pickJourney} busy={saving} />
      )}

      {/* The tutorial fires HERE, inside onboarding, for the chosen mode — then advances into the
          app. (The app layout still offers it as a fallback for accounts that never saw it.) */}
      {step === 2 && picked && (
        <TutorialLauncher
          mode={picked.mode}
          initialSeen={false}
          onDone={() => router.replace(picked.href)}
        />
      )}
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

// ── Step 3: choose your journey — the final onboarding step (same four as /app/choose) ────────
const JOURNEY_EDGE = {
  creator: { edge: "#7C5CF5", glow: "inset 6px 0 14px -10px #7C5CF5" },
  orange: { edge: "var(--brand-orange)", glow: "inset 6px 0 14px -10px rgba(252,62,1,.6)" },
} as const;

function JourneyStep({
  onPick,
  busy,
}: {
  onPick: (j: Journey) => void;
  busy: boolean;
}) {
  return (
    <section className="flex flex-1 flex-col gap-3.5">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Choose your journey</h1>
        <p className="mt-1 text-sm text-muted">
          You can switch anytime from The Fox Pit.
        </p>
      </div>

      {JOURNEYS.map((j) => {
        const c = JOURNEY_EDGE[j.color];
        return (
          <button
            key={j.key}
            type="button"
            disabled={busy}
            onClick={() => onPick(j)}
            className="flex flex-col gap-1 p-4 text-left transition active:scale-[0.99] disabled:opacity-60"
            style={{
              borderRadius: 15,
              background: "linear-gradient(180deg,#161c25,#10151c)",
              border: "1px solid #232b37",
              borderLeft: `4px solid ${c.edge}`,
              boxShadow: `${c.glow}, inset 0 1px 0 rgba(255,255,255,.05), 0 8px 20px rgba(0,0,0,.55)`,
            }}
          >
            <span className="flex items-center gap-2">
              <span className="flex-1 text-base font-bold text-foreground">{j.title}</span>
              <span
                className="rounded-full border px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide"
                style={{ color: c.edge, borderColor: c.edge }}
              >
                {j.tag}
              </span>
            </span>
            <span className="text-[13px] text-muted">{j.body}</span>
          </button>
        );
      })}

      {busy && <p className="text-center text-sm text-muted">Setting up your journey…</p>}
    </section>
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
        affirmResidence: form.get("affirmResidence") === "on",
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

      {/* §2 — residence attestation captured HERE (signup flow), not on every slate. */}
      <label className="flex items-start gap-2.5 text-sm text-foreground">
        <input
          type="checkbox"
          name="affirmResidence"
          className="mt-0.5 accent-accent"
          required
        />
        <span className="text-xs text-muted">
          I affirm, under penalty of perjury, that the state of residence I have
          provided is true and correct, and I accept liability for any false
          statement.
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

