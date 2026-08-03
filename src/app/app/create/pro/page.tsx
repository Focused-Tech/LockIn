import { redirect } from "next/navigation";

/**
 * The creator hub now lives at the creator ENTRY route (/app/creator) with the dashboard re-parented
 * under it (Addendum C). This old route redirects there so there is ONE hub entry — no second path in.
 */
export default async function CreatorProRedirect() {
  redirect("/app/creator");
}
