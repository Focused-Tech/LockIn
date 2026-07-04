import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/firebase/session";

/**
 * CREATOR STUDIO — you are the creator: build a slate (write-in your own legs)
 * and invite followers to play along. The real host tool already exists at
 * /app/practice/create (manual mode = write-in legs), so Studio frames it and
 * routes straight in. Sandbox / practice hosting — play-money only.
 */
export default async function CreatorStudioPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  return (
    <div className="page-enter flex flex-col gap-4 p-6">
      <div>
        <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#afa9ec]">
          Creator Studio
        </span>
        <h1 className="mt-1 text-xl font-semibold">You&apos;re the creator</h1>
        <p className="text-sm text-muted">
          Build a slate — add legs or write in your own — then invite followers
          to play what you host. This is the sandbox: practice hosting before you
          take it live for real coins.
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-card p-4">
        <span className="text-sm font-semibold">What you can do here</span>
        <ul className="flex flex-col gap-1 text-sm text-muted">
          <li>• Pick the categories your slate covers</li>
          <li>• Add AI-suggested legs or write in custom legs</li>
          <li>• Share an invite code — followers join and pick your slate</li>
        </ul>
      </div>

      <Link
        href="/app/practice/create"
        className="flex items-center justify-between rounded-xl border p-4 font-semibold transition active:scale-[0.98]"
        style={{
          borderColor: "rgba(175,169,236,0.55)",
          background: "rgba(175,169,236,0.12)",
          color: "#afa9ec",
        }}
      >
        <span>Build your slate →</span>
        <span>→</span>
      </Link>
    </div>
  );
}
