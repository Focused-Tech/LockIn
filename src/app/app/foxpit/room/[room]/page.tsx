import { notFound } from "next/navigation";
import { FoxPitRoom } from "./Room";
import { FoxPitStyles } from "../../styles";
import { FOXPIT_ROOMS, type FoxPitRoomKey } from "@/lib/foxpit";

/** Fox Pit room interior (door intro → room → table → face-off). */
export default async function FoxPitRoomPage({
  params,
}: {
  params: Promise<{ room: string }>;
}) {
  const { room } = await params;
  if (!FOXPIT_ROOMS.some((r) => r.key === room)) notFound();
  return (
    <>
      <FoxPitStyles />
      <FoxPitRoom roomKey={room as FoxPitRoomKey} />
    </>
  );
}
