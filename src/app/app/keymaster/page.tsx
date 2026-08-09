import { notFound, redirect } from "next/navigation";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { fetchKeyholderPortal } from "@/server/data/keyholder";
import { KeymasterPortal } from "./KeymasterPortal";
import "../lk-panels.css";

/**
 * KEYMASTER PORTAL (architect ruling E) — the executive's OWN home, a dedicated route separate from
 * the keyholder portal. Hard 404 for non-keymasters. It carries the downline tree, the roll-up, and
 * enrolment (F). A keymaster lands HERE, not on the keyholder portal.
 */
export default async function KeymasterPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");
  if (!profile.keymaster) notFound();

  const data = await fetchKeyholderPortal(adminDb(), profile.id);
  const tree = data.keymaster ?? {
    keyholders: [],
    rollup: { creators: 0, players: 0, totalEntries: 0, totalProjectedCents: null },
  };
  return <KeymasterPortal code={data.code} tree={tree} />;
}
