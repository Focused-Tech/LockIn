import { notFound } from "next/navigation";
import { FoxPitRoom } from "./Room";
import { FoxPitStyles } from "../../styles";
import { FOXPIT_ROOMS, type FoxPitRoomKey } from "@/lib/foxpit";
import { getCurrentUserProfile } from "@/lib/firebase/session";

/** Fox Pit room interior (door intro → room → table → face-off). */
export default async function FoxPitRoomPage({
  params,
}: {
  params: Promise<{ room: string }>;
}) {
  const { room } = await params;
  if (!FOXPIT_ROOMS.some((r) => r.key === room)) notFound();
  const profile = await getCurrentUserProfile();
  return (
    <>
      <FoxPitStyles />
      <FoxPitRoom
        roomKey={room as FoxPitRoomKey}
        username={profile?.username ?? "Member"}
        avatarUrl={profile?.avatarUrl ?? null}
        categories={profile?.categories ?? []}
        coinBalance={profile?.coinBalance ?? 0}
      />
    </>
  );
}
