/**
 * THE SIX LANES on the web front door (/start) — RULED, this exact set.
 *
 *   PUBLIC     Creator · Advanced · Beginner        — anyone, signed in or not
 *   ROLE-GATED Admin · Keymaster · Keyholder        — only when the UserDoc carries the flag
 *
 * Fox Pit practice is NOT a lane here.
 *
 * WHY THE GATING LIVES IN A PURE FUNCTION. `visibleLanes` takes the roles it is given and returns a
 * list. The caller is a SERVER component that reads the roles off the Firestore user doc, so an
 * anonymous visitor's payload never contains the staff lanes at all — they are not rendered-then-
 * hidden, they are absent. That also means the words "Admin", "Keymaster" and "Keyholder" never
 * appear in an anonymous response, which is the other half of the ruling: staff without a session
 * use the discreet /key entry, and nothing on the public page advertises that a staff door exists.
 */

export type LaneAccess = "public" | "role";
export type StaffRole = "admin" | "keymaster" | "keyholder";

export interface JourneyLaneDef {
  id: string;
  title: string;
  /** Short line under the title. */
  body: string;
  access: LaneAccess;
  /** Set only when access is "role". */
  role?: StaffRole;
  /** Accent key used by the card's left edge. */
  color: "creator" | "orange" | "fox" | "steel";
  href: string;
}

/** The roles a signed-in user carries, read server-side off the user doc. */
export interface LaneRoles {
  admin?: boolean;
  keymaster?: boolean;
  keyholder?: boolean;
}

export const LANES: JourneyLaneDef[] = [
  {
    id: "creator",
    title: "Creator",
    body: "Host contests for your audience. Draft your questions, set the entry, take your cut.",
    access: "public",
    color: "creator",
    href: "/app/creator",
  },
  {
    id: "advanced",
    title: "Advanced",
    body: "The full market. Every contest, every category, real payouts. Lock in to win.",
    access: "public",
    color: "orange",
    href: "/app",
  },
  {
    id: "beginner",
    title: "Beginner",
    body: "Play the same live contests in practice first. When you are ready, take the real one.",
    access: "public",
    color: "fox",
    href: "/app/beginner",
  },
  {
    id: "admin",
    title: "Admin",
    body: "Owner console — applications, settlements, reports and platform state.",
    access: "role",
    role: "admin",
    color: "steel",
    href: "/admin",
  },
  {
    id: "keymaster",
    title: "Keymaster",
    body: "Your network: downline requests, enrolment keys, production and override.",
    access: "role",
    role: "keymaster",
    color: "steel",
    href: "/app/keymaster",
  },
  {
    id: "keyholder",
    title: "Keyholder",
    body: "Your creators, your referral links, and what they have produced.",
    access: "role",
    role: "keyholder",
    color: "steel",
    href: "/app/keyholder",
  },
];

/** The three lanes anyone sees. */
export const PUBLIC_LANES = LANES.filter((l) => l.access === "public");

/** The three staff lanes. Never returned without a matching flag. */
export const ROLE_LANES = LANES.filter((l) => l.access === "role");

/**
 * The lanes this visitor may see. `roles` is null for an anonymous visitor.
 *
 * A user holding several roles sees several lanes — the same additive behaviour the account drawer
 * already ships (a keymaster is also a keyholder, so both appear).
 */
export function visibleLanes(roles: LaneRoles | null): JourneyLaneDef[] {
  if (!roles) return PUBLIC_LANES;
  return LANES.filter((lane) => {
    if (lane.access === "public") return true;
    return lane.role ? roles[lane.role] === true : false;
  });
}

/** True when the visitor carries at least one staff role. */
export function hasAnyStaffRole(roles: LaneRoles | null): boolean {
  return !!roles && ROLE_LANES.some((l) => l.role && roles[l.role] === true);
}
