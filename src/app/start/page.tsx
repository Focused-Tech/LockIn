import Link from "next/link";
import { Shell } from "@/components/web/Shell";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { CATEGORIES } from "@/lib/categories";
import { visibleLanes, type LaneRoles, type JourneyLaneDef } from "@/lib/journey/lanes";

export const runtime = "nodejs";
/** Role-dependent output — never cached across visitors. */
export const dynamic = "force-dynamic";

/**
 * /start — THE WEB FRONT DOOR.
 *
 * A real web page: full-width header, a content grid capped at 1280px, a lane GRID, and a footer.
 * It does not import {@link AppFrame}; nothing here renders the phone shell.
 *
 * ROLE GATING IS SERVER-SIDE AND BY OMISSION. The roles come off the Firestore user doc in this
 * server component, and `visibleLanes` returns only what this visitor may see. An anonymous
 * visitor's HTML therefore contains no Admin/Keymaster/Keyholder card and none of those WORDS — the
 * staff lanes are absent, not hidden. Staff without a session use the discreet /key entry, which is
 * exactly why nothing on this page advertises that a staff door exists.
 */

const ACCENT: Record<JourneyLaneDef["color"], string> = {
  creator: "#7C5CF5",
  orange: "#FF5A1F",
  fox: "#F0C463",
  steel: "#5B7A99",
};

const STEPS = [
  {
    n: "01",
    h: "Pick a contest",
    b: "One topic, three questions, a published close time. You can see the whole card before you commit.",
  },
  {
    n: "02",
    h: "Make your calls",
    b: "Answer every question and lock in. Speed is part of the score, so the clock matters.",
  },
  {
    n: "03",
    h: "Get paid on the result",
    b: "Every question settles against a named public source. The best cards split the pool.",
  },
];

export default async function StartPage() {
  // Roles are read here, on the server. Anonymous visitors get `null` and never see a staff lane.
  const profile = await getCurrentUserProfile();
  const roles: LaneRoles | null = profile
    ? {
        admin: profile.isAdmin === true,
        keymaster: profile.keymaster === true,
        keyholder: profile.keyholder === true,
      }
    : null;

  const lanes = visibleLanes(roles);

  return (
    <>
      <Shell as="section" className="lk-web-hero">
        {/* HERO: wordmark, tagline, two buttons. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="lk-web-hero-mark" src="/wordmark-lockin.png" alt="Lock In" />
        <p className="lk-web-tag">
          Here you play against people, not a house. Being right gets you paid. Being fast decides
          how much.
        </p>
        <div className="lk-web-herocta">
          <Link href="/signup" className="lk-web-btn primary">
            Create account
          </Link>
          <Link href="/start#how" className="lk-web-btn">
            How it works
          </Link>
        </div>
      </Shell>

      <Shell as="section" className="lk-web-sec" aria-labelledby="lanes-h">
        <h2 id="lanes-h" className="lk-web-sech">
          Choose your lane
        </h2>
        <div className="lk-web-lanes">
          {lanes.map((lane) => (
            <Link
              key={lane.id}
              href={lane.href}
              className="lk-web-lane"
              style={{ ["--lane-accent" as string]: ACCENT[lane.color] }}
            >
              <div className="lk-web-lanetop">
                <span className="lk-web-lanetitle">{lane.title}</span>
                {lane.access === "role" && <span className="lk-web-tagpill">Staff</span>}
              </div>
              <p className="lk-web-lanebody">{lane.body}</p>
              <span className="lk-web-lanego">Open →</span>
            </Link>
          ))}
        </div>
      </Shell>

      <Shell as="section" className="lk-web-sec" id="how" aria-labelledby="how-h">
        <h2 id="how-h" className="lk-web-sech">
          How it works
        </h2>
        <div className="lk-web-steps">
          {STEPS.map((s) => (
            <div key={s.n} className="lk-web-step">
              <div className="lk-web-stepn">{s.n}</div>
              <div className="lk-web-steph">{s.h}</div>
              <p className="lk-web-stepb">{s.b}</p>
            </div>
          ))}
        </div>
      </Shell>

      <Shell as="section" className="lk-web-sec" id="categories" aria-labelledby="cat-h">
        <h2 id="cat-h" className="lk-web-sech">
          Categories
        </h2>
        <div className="lk-web-cats">
          {CATEGORIES.map((c) => (
            <span key={c.name} className="lk-web-cat">
              <span aria-hidden>{c.icon}</span> {c.name}
            </span>
          ))}
        </div>
      </Shell>
    </>
  );
}
