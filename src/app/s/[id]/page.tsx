import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { adminDb } from "@/lib/firebase/admin";
import { fetchSlate } from "@/server/data/slates";
import { buildEmbedView } from "@/lib/embed";
import { EmbedWidget } from "@/components/embed/EmbedWidget";
import { SkillGameDisclaimer } from "@/components/SkillGameDisclaimer";
import { formatCents } from "@/lib/utils";
import { isMobileClientUA } from "@/lib/mobileClient";

export const runtime = "nodejs";

/** Open Graph / Twitter meta tags for rich social previews of a shared slate. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const slate = await fetchSlate(adminDb(), id);
  if (!slate) return { title: "LockIn contest" };

  const view = buildEmbedView(slate);
  const description =
    view.state === "live"
      ? `Live contest · ${formatCents(view.prizePoolCents)} prize pool · 1st pays ${formatCents(view.firstPlaceCents)}. Make your picks on LockIn.`
      : view.state === "settled"
        ? `Settled · ${formatCents(view.prizePoolCents)} prize pool. See the results on LockIn.`
        : "Entries closed — results pending. Catch the next one on LockIn.";

  const title = `${slate.title} · LockIn`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website", siteName: "LockIn" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SharePage({
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
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-4 p-6">
      <EmbedWidget view={view} ctaHref={`/app/slate/${id}`} />
      <p className="text-center text-sm text-muted">
        New to LockIn?{" "}
        <Link href="/signup" className="text-accent">
          Create an account
        </Link>
      </p>
      <SkillGameDisclaimer />
    </main>
  );
}
