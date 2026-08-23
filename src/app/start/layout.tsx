import Link from "next/link";
import type { Metadata } from "next";
import "./start.css";

/**
 * WEB CHROME for /start. Deliberately does NOT use {@link AppFrame} — that is the phone shell
 * (a 430px column with a device border) and a website is not the app at a narrow viewport.
 *
 * This layout is a normal document: a full-width header, a centred content grid capped at 1280px,
 * and a footer. It scales DOWN to a phone without ever becoming the app shell.
 */
export const metadata: Metadata = {
  title: "Lock In — Here you play against people, not a house",
  description:
    "Here you play against people, not a house. Being right gets you paid. Being fast decides how much.",
};

const NAV = [
  { href: "/start#how", label: "How it works" },
  { href: "/start#categories", label: "Categories" },
  { href: "/app/championship", label: "Championship" },
];

const FOOTER_LINKS = [
  { href: "/app/responsible-play", label: "Responsible play" },
  { href: "/start#terms", label: "Terms" },
  { href: "/start#privacy", label: "Privacy" },
  { href: "/start#rules", label: "Contest rules" },
  { href: "/start#support", label: "Support" },
];

export default function StartLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="lk-web">
      <header className="lk-web-header">
        <div className="lk-web-shell lk-web-headrow">
          <Link href="/start" className="lk-web-brand" aria-label="Lock In — home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/wordmark-lockin.png" alt="Lock In" height={26} />
          </Link>

          <nav className="lk-web-nav" aria-label="Main">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="lk-web-navlink">
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="lk-web-actions">
            <Link href="/login" className="lk-web-signin">
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="lk-web-main">{children}</main>

      <footer className="lk-web-footer">
        <div className="lk-web-shell lk-web-footrow">
          <p className="lk-web-legal">
            A skill contest — knowledge and lock-in speed decide the winners. 18+. Paid contests are
            unavailable in WA, AZ, IA, LA, MT and SC.
          </p>
          <nav className="lk-web-footlinks" aria-label="Policies">
            {FOOTER_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="lk-web-footlink">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
