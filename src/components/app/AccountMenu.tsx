"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { logoutUser } from "@/lib/firebase/auth";

/**
 * ACCOUNT DRAWER (§2b). The avatar lives in the header (top-right). Tapping it TOGGLES this drawer;
 * tapping the avatar again (or the backdrop) closes it and leaves you on the SAME route — it never
 * navigates on its own. The drawer holds the account destinations that used to be scattered:
 *   Profile · Wallet · Refer · Responsible play · Settings · Sign out.
 */
const ITEMS: { href: string; label: string }[] = [
  { href: "/app/profile", label: "Profile" },
  { href: "/app/wallet", label: "Wallet" },
  { href: "/app/refer", label: "Refer" },
  { href: "/app/responsible-play", label: "Responsible play" },
  { href: "/app/settings", label: "Settings" },
];

export function AccountMenu({
  username,
  isKeyholder = false,
  isAdmin = false,
}: {
  username: string;
  isKeyholder?: boolean;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Role destinations — shown ONLY when the flag is set. The portal/admin are REACHED here, never
  // by being redirected on load. Nothing here for a user without the flags.
  const roleItems: { href: string; label: string }[] = [
    ...(isKeyholder ? [{ href: "/app/keyholder", label: "Keyholder portal" }] : []),
    ...(isAdmin ? [{ href: "/admin/keyholders", label: "Admin" }] : []),
  ];

  async function signOut() {
    setSigningOut(true);
    await logoutUser();
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-accent-border bg-accent-soft text-xs font-bold text-accent"
      >
        {username.charAt(0).toUpperCase()}
      </button>

      {open && (
        <>
          {/* backdrop — tap to close, stay on the same route */}
          <button
            type="button"
            aria-label="Close account menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/50"
          />
          <div
            role="menu"
            className="fixed right-3 top-16 z-50 w-56 overflow-hidden rounded-[15px] border border-border bg-surface-card shadow-2xl"
            style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,.05), 0 12px 30px rgba(0,0,0,.6)" }}
          >
            <div className="border-b border-border px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted">Signed in as</p>
              <p className="truncate text-sm font-semibold text-foreground">@{username}</p>
            </div>
            {[...ITEMS, ...roleItems].map((it) => (
              <Link
                key={it.href}
                href={it.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between px-4 py-3 text-sm text-foreground transition-colors hover:bg-surface"
              >
                {it.label}
                <span aria-hidden className="text-muted">
                  ›
                </span>
              </Link>
            ))}
            <button
              type="button"
              role="menuitem"
              onClick={signOut}
              disabled={signingOut}
              className="flex w-full items-center justify-between border-t border-border px-4 py-3 text-left text-sm text-loss transition-colors hover:bg-surface disabled:opacity-60"
            >
              {signingOut ? "Signing out…" : "Sign out"}
              <span aria-hidden className="text-muted">
                ›
              </span>
            </button>
          </div>
        </>
      )}
    </>
  );
}
