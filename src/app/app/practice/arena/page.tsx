import { redirect } from "next/navigation";

/**
 * /app/practice/arena opens the "Choose your arena" chooser. The multi-slate
 * round it used to render lives at ./multi (the Multi-Slate mode), reached from
 * the chooser. This redirect keeps existing inbound links working.
 */
export default function ArenaPage() {
  redirect("/app/practice/arena/chooser");
}
