import { notFound } from "next/navigation";
import { FoxPitRoom } from "./Room";
import { FoxPitStyles } from "../../styles";
import { FOXPIT_ROOMS, type FoxPitRoomKey } from "@/lib/foxpit";
import { getCurrentUserProfile } from "@/lib/firebase/session";

/** Fox Pit room interior (door intro → room → table → face-off). */
export default async function FoxPitRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ room: string }>;
  // §3.1 — resume deep-link: ?table=<idx>&round=<idx> jumps straight to that seat + round.
  searchParams: Promise<{ table?: string; round?: string }>;
}) {
  const { room } = await params;
  if (!FOXPIT_ROOMS.some((r) => r.key === room)) notFound();
  const profile = await getCurrentUserProfile();
  const sp = await searchParams;
  const tableN = sp.table != null ? Number(sp.table) : NaN;
  const roundN = sp.round != null ? Number(sp.round) : NaN;
  const resumeTable = Number.isInteger(tableN) && tableN >= 0 ? tableN : null;
  const resumeRound = Number.isInteger(roundN) && roundN >= 0 ? roundN : 0;
  return (
    <>
      <FoxPitStyles />
      <FoxPitRoom
        roomKey={room as FoxPitRoomKey}
        username={profile?.username ?? "Member"}
        avatarUrl={profile?.avatarUrl ?? null}
        categories={profile?.categories ?? []}
        coinBalance={profile?.coinBalance ?? 0}
        resumeTable={resumeTable}
        resumeRound={resumeRound}
      />
    </>
  );
}
