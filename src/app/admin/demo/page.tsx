import { notFound } from "next/navigation";
import { getCurrentUserId, isAdminUid } from "@/lib/firebase/session";
import { DEMO_CHAPTERS, DEMO_SCRIPT, DEMO_SPEEDS } from "@/lib/demo/presentation";
import { DemoPlayer } from "./DemoPlayer";

export const runtime = "nodejs";
/** Never cache a page whose whole point is that most people cannot see it. */
export const dynamic = "force-dynamic";

/**
 * PRESENTATION DEMO — admin / owner only.
 *
 * `notFound()` rather than a redirect: a redirect to /login or /app tells an unauthorised visitor
 * the route exists. A 404 tells them nothing. The check runs BEFORE the demo module's data is read,
 * and that module is `server-only`, so the marquee names it carries cannot be reached by a client
 * bundle even if this guard were somehow bypassed.
 */
export default async function AdminDemoPage() {
  const uid = await getCurrentUserId();
  if (!uid) notFound();
  if (!(await isAdminUid(uid))) notFound();

  return (
    <DemoPlayer
      script={DEMO_SCRIPT}
      chapters={DEMO_CHAPTERS}
      speeds={[...DEMO_SPEEDS]}
    />
  );
}
