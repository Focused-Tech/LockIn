"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { logoutUser } from "@/lib/firebase/auth";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    await logoutUser();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={onClick} disabled={pending}>
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
