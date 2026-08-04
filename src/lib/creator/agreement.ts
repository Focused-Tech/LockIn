/**
 * LOCKIN CREATOR AGREEMENT — the copy is DATA, not markup, so counsel's edits bump the
 * version and force a re-sign WITHOUT a component change. Transcribed VERBATIM from
 * public/design/Creator Builder/creator_agreement.html (sha ddd4053b) — do not paraphrase,
 * tighten or "improve" a clause; that is a legal-review change, not an engineering one.
 *
 * DRAFT — not reviewed by counsel. Three sections, signed ONE AT A TIME.
 */

export const AGREEMENT_VERSION = "v1.0";

export type SectionKey = "content" | "contest" | "payout";
export const SECTION_KEYS: SectionKey[] = ["content", "contest", "payout"];

export interface AgreementPoint {
  marker: "yes" | "no";
  html: string;
}
export interface AgreementBlock {
  /** left-edge meaning: "" creator · warn danger · money cash */
  cls: "" | "warn" | "money";
  lb: string;
  pts: AgreementPoint[];
}
export interface AgreementSection {
  k: SectionKey;
  tag: string;
  title: string;
  sub: string;
  blocks: AgreementBlock[];
  sign: string;
}

export const AGREEMENT_SECTIONS: AgreementSection[] = [
  {
    k: "content",
    tag: "1 of 3",
    title: "What you can post",
    sub: "You choose the image and the caption on your share card, whatever you run — sports, entertainment, awards, music, reality. That makes them yours, and it makes them your responsibility.",
    blocks: [
      {
        cls: "",
        lb: "You are warranting",
        pts: [
          { marker: "yes", html: "<b>You own it, or you are licensed to use it.</b> Your own photos, your own graphics, or artwork you hold rights to." },
          { marker: "yes", html: "<b>It is yours to answer for.</b> LockIn does not create, select or endorse creator images and captions, and is not responsible for them." },
        ],
      },
      {
        cls: "warn",
        lb: "You may not upload",
        pts: [
          { marker: "no", html: "<b>Anything captured from a broadcast or a stream.</b> Game footage, show clips, film or series stills, music videos, awards-show footage, red-carpet photos, album art, promotional posters. <b>This gets slates pulled fastest, and it is not a sports-only rule.</b>" },
          { marker: "no", html: "League, team, network, studio, label, festival or awards-body logos and marks — in any category." },
          { marker: "no", html: "Sexual content, nudity, gore, violence, hate, harassment, or anything involving a minor." },
          { marker: "no", html: "Anyone else’s likeness without their permission." },
          { marker: "no", html: "Anything implying a league, team, network, studio, label, artist, awards body or brand endorses your contest." },
        ],
      },
      {
        cls: "",
        lb: "This applies to every category",
        pts: [
          { marker: "yes", html: "<b>Sports</b> — and every league within it." },
          { marker: "yes", html: "<b>Entertainment</b> — film, television, streaming." },
          { marker: "yes", html: "<b>Awards</b> — and the shows that hand them out." },
          { marker: "yes", html: "<b>Music</b> — releases, charts, ceremonies." },
          { marker: "yes", html: "<b>Reality</b> — competition and unscripted series." },
          { marker: "yes", html: "Any category added later. The rules follow the category list, not the other way round." },
        ],
      },
      {
        cls: "warn",
        lb: "If you break this",
        pts: [
          { marker: "no", html: "The image is removed and the slate can be pulled." },
          { marker: "no", html: "<b>Your host fee on that contest is forfeited.</b> Player entries and payouts are unaffected — that money is theirs, not yours and not ours." },
          { marker: "no", html: "Repeat or serious breaches suspend or close your creator account." },
          { marker: "no", html: "You cover the cost if a third party comes after us for something you posted." },
        ],
      },
    ],
    sign: "I own or am licensed to use everything I upload, in every category I run, I will not post the prohibited content listed above, and I accept the consequences if I do.",
  },
  {
    k: "contest",
    tag: "2 of 3",
    title: "How your contests run",
    sub: "Your slate is a skill contest in whatever category you run it — sports, entertainment, awards, music, reality. The rules that keep it one are not suggestions, and they are checked before anything publishes.",
    blocks: [
      {
        cls: "",
        lb: "Every question you write",
        pts: [
          { marker: "yes", html: "Draws from the question shapes approved <b>for the category you are running in</b>, and passes validation before it can go live. <b>The shapes are not the same in every category.</b>" },
          { marker: "yes", html: "In <b>sports</b>: compares performance across <b>different games</b> — never who wins a game, a score, a margin, a spread, a total, or a number on one player." },
          { marker: "yes", html: "In <b>every</b> category: nothing that turns your slate into a wager on a single outcome someone else already takes bets on." },
          { marker: "yes", html: "Carries the context a player needs to judge it, whatever the category." },
        ],
      },
      {
        cls: "warn",
        lb: "You will not",
        pts: [
          { marker: "no", html: "Enter your own contest, or have anyone acting for you enter it." },
          { marker: "no", html: "Use information the public does not have, or edit a slate after it locks." },
          { marker: "no", html: "Arrange, influence or profit from an outcome you are asking players to call." },
          { marker: "no", html: "Run contests on outcomes you have any control over — including a show, award, release or vote you take part in, work on, or can influence." },
        ],
      },
      {
        cls: "",
        lb: "You understand",
        pts: [
          { marker: "yes", html: "You set your host fee. <b>The pot belongs to the players.</b>" },
          { marker: "yes", html: "LockIn can decline, pause, correct or void any contest that breaks these rules, and will tell you why." },
          { marker: "yes", html: "Eligibility, age and state restrictions apply to your players and are enforced by the platform, not by you." },
        ],
      },
    ],
    sign: "I will run my contests within the rules approved for each category I use, I will not enter or influence my own contests, and I accept that LockIn can void a contest that breaks them.",
  },
  {
    k: "payout",
    tag: "3 of 3",
    title: "Getting paid",
    sub: "Host fees are income. That brings tax paperwork, verification, and a few things worth knowing before your first payout.",
    blocks: [
      {
        cls: "money",
        lb: "How payment works",
        pts: [
          { marker: "yes", html: "You earn a <b>host fee</b> on entries. It is the only figure on the slate you control." },
          { marker: "yes", html: "Fees settle after a contest closes and results are final, into the payout account you connect." },
          { marker: "yes", html: "You must verify your identity before your first withdrawal." },
        ],
      },
      {
        cls: "",
        lb: "Tax",
        pts: [
          { marker: "yes", html: "You are an <b>independent contractor</b>, not an employee. Nothing is withheld for you." },
          { marker: "yes", html: "US creators supply a W-9. Past the annual threshold you receive a 1099 and so does the IRS." },
          { marker: "yes", html: "What you owe on it is yours to handle." },
        ],
      },
      {
        cls: "warn",
        lb: "When a fee can be withheld",
        pts: [
          { marker: "no", html: "A contest voided for breaking the rules in step 2." },
          { marker: "no", html: "Content pulled under step 1." },
          { marker: "no", html: "A chargeback, fraud review, or an account under investigation." },
          { marker: "no", html: "Player entries and payouts are never touched by any of this." },
        ],
      },
    ],
    sign: "I understand how host fees are paid and taxed, that I am an independent contractor, and when a fee can be withheld.",
  },
];

/**
 * The creator-agreement GATE (pure, client-safe so the route AND tests can use it). A
 * creator is onboarded only when they have fully signed the CURRENT version — a counsel
 * edit that bumps AGREEMENT_VERSION flips this false and forces a re-sign.
 */
export function isCreatorOnboarded(profile: {
  creatorOnboarded?: boolean;
  creatorAgreementVersion?: string;
}): boolean {
  return profile.creatorOnboarded === true && profile.creatorAgreementVersion === AGREEMENT_VERSION;
}

/** The e-signature language shown under every section's sign box (from the spec). */
export const ESIG_TEXT =
  "By ticking this box you are signing this section of the LockIn Creator Agreement. You agree your electronic signature has the same legal meaning, validity and effect as your handwritten signature. Your name, the time and the version of this agreement are recorded.";
