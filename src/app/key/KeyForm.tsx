"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { getClientAuth } from "@/lib/firebase/client";
import { Button, Input } from "@/components/ui";

/**
 * KEY SIGN-IN (Part 3 D) — takes an enrolment key + email/password and redeems it: verifies the key,
 * creates or attaches the account, becomes a keyholder in the issuing tree, and lands in the portal.
 * NOT the consumer signup flow. A bad key fails with a plain message and reveals nothing.
 */
export function KeyForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"have" | "new">("have");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!code.trim()) {
      setError("Enter your key.");
      return;
    }
    setPending(true);
    const auth = getClientAuth();
    let createdNew = false;
    try {
      const cred =
        mode === "new"
          ? ((createdNew = true), await createUserWithEmailAndPassword(auth, email.trim(), password))
          : await signInWithEmailAndPassword(auth, email.trim(), password);
      const idToken = await cred.user.getIdToken();

      const res = await fetch("/api/auth/key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, code, username: mode === "new" ? username.trim() : undefined }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        // Clean up an orphaned new auth user if redemption failed.
        if (createdNew) await auth.currentUser?.delete().catch(() => {});
        throw new Error(data.error ?? "That key can't be used.");
      }
      const data = (await res.json()) as { redirect?: string };
      router.push(data.redirect ?? "/app/keyholder");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That key can't be used.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Key</span>
        <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXX-XXXX" autoCapitalize="characters" required />
      </label>

      <div className="flex gap-2 text-sm">
        <button type="button" onClick={() => setMode("have")} className={"flex-1 rounded-md border px-3 py-2 " + (mode === "have" ? "border-accent-border bg-accent-soft text-accent" : "border-border text-muted")}>
          I have an account
        </button>
        <button type="button" onClick={() => setMode("new")} className={"flex-1 rounded-md border px-3 py-2 " + (mode === "new" ? "border-accent-border bg-accent-soft text-accent" : "border-border text-muted")}>
          Create one
        </button>
      </div>

      {mode === "new" && (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Username</span>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
        </label>
      )}
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Email</span>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Password</span>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "new" ? "new-password" : "current-password"} required />
      </label>

      {error && (
        <p role="alert" className="rounded border border-[rgba(232,84,84,0.25)] bg-[rgba(232,84,84,0.10)] px-3 py-2 text-sm text-loss">
          {error}
        </p>
      )}

      <Button type="submit" variant="accent" size="lg" className="w-full" disabled={pending}>
        {pending ? "Verifying…" : "Redeem key"}
      </Button>
    </form>
  );
}
