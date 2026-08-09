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
 * The Locksmith help chat. The floating FAB was REMOVED — she's now a permanent slot in the bottom
 * nav (BottomNav → dispatches `locksmith:open`), so a second floating launcher was redundant. This
 * component only listens for that event and renders the SAME full-screen {@link LocksmithChat} the
 * tutorial uses; nothing floats on the screen when it's closed.
 */
export function ChatAssistant() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const mode = pathnameToMode(pathname);

  // The nav Locksmith slot (and any help entry) opens THIS Locksmith.
  useEffect(() => {
    const openIt = () => setOpen(true);
    window.addEventListener("locksmith:open", openIt);
    return () => window.removeEventListener("locksmith:open", openIt);
  }, []);

  if (!open) return null;

  // FULL-SCREEN — the same surface every entry point opens; greeting from the shared store.
  return (
    <div className="fixed inset-0 z-[55]">
      <LocksmithChat
        mode={mode}
        seed={TUTORIALS[mode].intro}
        greeting={LOCKSMITH_GREETING}
        onDismiss={() => setOpen(false)}
        dismissLabel="Close"
      />
    </div>
  );
}
