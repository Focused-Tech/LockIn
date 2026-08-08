import { notFound } from "next/navigation";
import { isCurrentUserAdmin } from "@/lib/firebase/session";
import { listKeymasters } from "./search";
import { AdminKeyholders } from "./AdminKeyholders";
import "../../app/lk-panels.css";

/**
 * ADMIN — keyholder / keymaster role toggles. Hard 404 for non-admins (same gate pattern as the
 * portal). Search a user, see their current flags, toggle keyholder/keymaster, and set/clear the
 * keymaster upline (picker limited to keymasters). All WRITES go through the existing
 * setKeyholder/setKeymaster actions — no new write paths, no bulk ops, no delete, no payout.
 */
export default async function AdminKeyholdersPage() {
  if (!(await isCurrentUserAdmin())) notFound();
  const keymasters = await listKeymasters();
  return <AdminKeyholders initialKeymasters={keymasters} />;
}
