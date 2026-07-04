import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { ArenaColiseumStub } from "./ArenaColiseumStub";

/**
 * COLISEUM route — renders the visible stub. The team backend (arenaSessions) is
 * not built this pass; see ArenaColiseumStub + src/lib/practice/arenaSession.ts.
 */
export default async function ColiseumPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  return (
    <div className="page-enter flex flex-col gap-5 p-6">
      <ArenaColiseumStub />
    </div>
  );
}
