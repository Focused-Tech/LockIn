import Link from "next/link";
import { Logo } from "@/components/Logo";
import { KeyForm } from "./KeyForm";

/**
 * KEY SIGN-IN page — reached from the discreet "Key" link on sign-in/up. Labelled only "Key" (never
 * admin/keymaster/keyholder). Redeems an enrolment key into a keyholder account and lands in the portal.
 */
export default function KeyPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 p-6">
      <Link href="/" className="self-center">
        <Logo />
      </Link>

      <div className="text-center">
        <h1 className="text-2xl font-semibold">Enter your key</h1>
        <p className="mt-1 text-sm text-muted">Redeem an enrolment key to get set up.</p>
      </div>

      <KeyForm />

      <p className="text-center text-sm text-muted">
        <Link href="/login" className="text-accent">Back to sign in</Link>
      </p>
    </main>
  );
}
