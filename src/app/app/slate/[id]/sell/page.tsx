import { notFound, redirect } from "next/navigation";
import { SkillGameDisclaimer } from "@/components/SkillGameDisclaimer";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId } from "@/lib/firebase/session";
import { fetchSlate } from "@/server/data/slates";
import { PackageBuilder } from "./PackageBuilder";

export default async function SellPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const uid = await getCurrentUserId();
  if (!uid) redirect("/login");

  const slate = await fetchSlate(adminDb(), id);
  if (!slate) notFound();
  if (slate.creatorId !== uid) redirect(`/app/slate/${id}`);

  return (
    <div className="flex flex-col gap-5 p-6">
      <div>
        <h1 className="text-xl font-semibold">Sell your picks</h1>
        <p className="text-sm text-muted">
          {slate.title} — your picks stay hidden from buyers&apos; rivals until
          lock.
        </p>
      </div>

      <PackageBuilder slate={slate} />

      <SkillGameDisclaimer className="mt-auto pt-4" />
    </div>
  );
}
