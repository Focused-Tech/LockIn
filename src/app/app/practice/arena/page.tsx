import { redirect } from "next/navigation";

/**
 * /app/practice/arena opens the "Choose your arena" chooser. The Parlay
 * round it used to render lives at ./multi (the Parlay mode), reached from
 * the chooser. This redirect keeps existing inbound links working.
 */
export default function ArenaPage() {
  redirect("/app/practice/arena/chooser");
}
