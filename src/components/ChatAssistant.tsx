"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { TUTORIALS, type TutorialMode } from "@/lib/tutorial/tutorials";
import { LOCKSMITH_GREETING } from "@/lib/locksmith/copy";
import { LocksmithChat } from "@/components/app/LocksmithChat";

/** Best-effort mode for the screen the user is standing on (contextual chips + seed). */
function pathnameToMode(pathname: string): TutorialMode {
  if (pathname.startsWith("/app/foxpit")) return "tower_boss";
  if (pathname.startsWith("/app/practice")) return "lone_fox";
  if (pathname.startsWith("/app/create") || pathname.startsWith("/app/creator")) return "creator";
  if (pathname.startsWith("/app/beginner")) return "beginner";
  return "advanced";
}

/**
 * The Locksmith is contextual (§3d): the FAB auto-appears only where a DECISION is being made — slate
 * detail, the creator builder, practice, and tower play. It never auto-shows on profile, wallet,
 * settings, etc. The nav Locksmith slot can still open her from anywhere (locksmith:open).
 *
 * Architect ruling L: the FAB opens the SAME canonical {@link LocksmithChat} the tutorial uses — the
 * old bespoke popover chat (emoji mic, "Send" text, cover-background desk, hardcoded greeting) is
 * GONE. This component owns only the FAB button, the sheet container, and its dismissal.
 */
const DECISION_PREFIXES = ["/app/slate/", "/app/create", "/app/creator", "/app/practice", "/app/foxpit"];
const DECISION_DENY = ["/app/creator/agreement"];
function isDecisionScreen(pathname: string): boolean {
  if (DECISION_DENY.some((p) => pathname.startsWith(p))) return false;
  return DECISION_PREFIXES.some((p) => pathname.startsWith(p));
}

export function ChatAssistant() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const mode = pathnameToMode(pathname);

  // §3b — the nav Locksmith slot (and any help entry) opens THIS same Locksmith.
  useEffect(() => {
    const openIt = () => setOpen(true);
    window.addEventListener("locksmith:open", openIt);
    return () => window.removeEventListener("locksmith:open", openIt);
  }, []);

  const showFab = isDecisionScreen(pathname);
  if (!showFab && !open) return null;

  return (
    <>
      {(showFab || open) && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close Locksmith" : "Open Locksmith — your AI guide"}
          className="fixed bottom-[4.5rem] right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(59,139,255,0.4)] bg-[rgba(59,139,255,0.15)] text-lg text-ai shadow-lg backdrop-blur transition-colors hover:bg-[rgba(59,139,255,0.25)]"
        >
          {open ? (
            "✕"
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/foxpit/locksmith/locksmith_badge.png" alt="" className="h-9 w-9 rounded-full object-cover" />
          )}
        </button>
      )}

      {/* SHEET — differs from the tutorial only in SIZE and dismissal (ruling L). A tall bottom sheet
          that renders the SAME LocksmithChat, compact hero, greeting from the shared store. */}
      {open && (
        <div className="fixed inset-x-0 bottom-0 top-14 z-[55] overflow-hidden rounded-t-2xl border-t border-border shadow-2xl">
          <LocksmithChat
            mode={mode}
            seed={TUTORIALS[mode].intro}
            greeting={LOCKSMITH_GREETING}
            compact
            onDismiss={() => setOpen(false)}
            dismissLabel="Close"
          />
        </div>
      )}
    </>
  );
}
