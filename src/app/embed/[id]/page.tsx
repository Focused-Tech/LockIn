import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { adminDb } from "@/lib/firebase/admin";
import { fetchSlate } from "@/server/data/slates";
import { buildEmbedView } from "@/lib/embed";
import { EmbedWidget } from "@/components/embed/EmbedWidget";
import { EmbedAutoRefresh } from "@/components/embed/EmbedAutoRefresh";
import { isMobileClientUA } from "@/lib/mobileClient";

/** firebase-admin needs the Node.js runtime. */
export const runtime = "nodejs";

/**
 * Public, frameable widget for embedding a contest on any site. Reads public
 * slate data server-side (no auth). Framing is allowed via the
 * `frame-ancestors *` header set for /embed in next.config.ts.
 */
export default async function EmbedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const isMobile = isMobileClientUA((await headers()).get("user-agent"));
  const slate = await fetchSlate(adminDb(), id, { blockCashEntertainment: isMobile });
  if (!slate) notFound();

  const view = buildEmbedView(slate);

  return (
    <div className="p-2">
      <EmbedWidget view={view} ctaHref={`/s/${id}`} ctaNewTab />
      <EmbedAutoRefresh seconds={60} />
    </div>
  );
}
