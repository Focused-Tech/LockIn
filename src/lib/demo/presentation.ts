import "server-only";
import { LEGS_PER_SLATE, TOPICS_PER_SLATE } from "@/lib/contest/legRules";

/**
 * PRESENTATION DEMO — ADMIN / OWNER ONLY. NEVER PUBLIC.
 *
 * This is the pitch walkthrough from `design/lockin_cordell_demo_v2.html`. It keeps the reference's
 * MARQUEE NAMES — real broadcasters as hosts, real athletes inside the legs — because Frank ruled
 * they stay for presentation. That ruling is why this file exists as a separate, gated module rather
 * than as demo data anywhere near the product.
 *
 * TWO GUARDS, AND BOTH MATTER:
 *
 *  1. `import "server-only"` at the top. If any client component ever imports this module, the BUILD
 *     FAILS. That is deliberate: a client import would inline every marquee name into a JavaScript
 *     chunk served to the public, and no runtime role check can undo that. The build error is the
 *     backstop that a permission check cannot provide.
 *
 *  2. The only route that reads it (`/admin/demo`) calls `notFound()` for non-admins BEFORE touching
 *     this data, so a non-admin gets a 404 rather than a redirect that admits the page exists.
 *
 * Public-facing example data uses the Fox Pit cast instead — see `src/lib/demo/cast.ts`. Do not use
 * this module for anything a signed-out visitor, a player, or a creator can reach.
 *
 * LEG COUNT: capped at THREE per the 2026-08-23 ruling. The reference already ships three; the cap
 * is applied on the way in anyway so a future reference revision cannot quietly raise it.
 */

export interface DemoLeg {
  question: string;
  options: string[];
  /** Display-only context. Never a threshold. */
  context: string;
}

export interface DemoHost {
  id: string;
  name: string;
  initials: string;
  followers: number;
  tier: string;
  role: string;
  /** Entry stake in whole dollars, and the host's fee on top. */
  stake: number;
  hostFee: number;
  /** ONE topic per slate. */
  topic: string;
  subtitle: string;
  caption: string;
  /** THREE legs per slate. */
  legs: DemoLeg[];
}

export interface DemoCategory {
  id: string;
  name: string;
  emoji: string;
  color: string;
  creators: DemoHost[];
}

/**
 * The twelve chapters, verbatim from the reference. Copy is DATA so a wording change needs no code
 * change — the same reason the Locksmith fallbacks live in a copy store.
 */
export const DEMO_CHAPTERS: { n: number; id: string; title: string }[] = [
  { n: 1, id: "host", title: "The host takes the category seat" },
  { n: 2, id: "event", title: "The event — one topic, three legs" },
  { n: 3, id: "build", title: "The build — the Locksmith drafts, checks, and rewrites" },
  { n: 4, id: "legs", title: "The slate — three legs, one topic" },
  { n: 5, id: "price", title: "Price the room — two charges, one screen" },
  { n: 6, id: "publish", title: "Publish — sealed" },
  { n: 7, id: "share", title: "Distribution — the host's own audience" },
  { n: 8, id: "clock", title: "The countdown — the room fills" },
  { n: 9, id: "reveal", title: "The reveal — the same three questions, at the same second" },
  { n: 10, id: "settle", title: "Settlement — every leg against a named public source" },
  { n: 11, id: "board", title: "The payout board" },
  { n: 12, id: "worth", title: "What one seat is worth — and what fifty look like" },
];

/** Playback speeds offered by the player, from the reference's control strip. */
export const DEMO_SPEEDS = [0.6, 1, 1.6, 2.6] as const;

const RAW: DemoCategory[] = [
  {
    id: "nfl",
    name: "NFL Football",
    emoji: "🏈",
    color: "#2FB98A",
    creators: [
      {
        id: "sharpe",
        name: "Shannon Sharpe",
        initials: "SS",
        followers: 15000000,
        tier: "15M",
        role: "Category Boss — example scenario",
        stake: 25,
        hostFee: 3,
        topic: "Sunday: Who Shows Out",
        subtitle: "Week 1 · Early Window",
        caption: "Five million of y'all got opinions every Sunday. Time to put a timestamp on 'em. Lock in.",
        legs: [
        { question: "Bigger passing night Sunday: Mahomes in KC or Allen in Buffalo?", options: ["Mahomes","Allen"], context: "Two arms, two different games. Season form on the card — you make the call." },
        { question: "Who owns the ground across the early window: Bijan, Gibbs, or Pacheco?", options: ["Bijan","Gibbs","Pacheco"], context: "Field leader — three backs, three different games. Most rushing yards takes it." },
        { question: "First to 3 touchdowns on the day: Chase, Lamb, or St. Brown?", options: ["Chase","Lamb","St. Brown"], context: "A race across three games. First to the number, not the biggest number." },
        ],
      },
      {
        id: "clark",
        name: "Ryan Clark",
        initials: "RC",
        followers: 1000000,
        tier: "1M",
        role: "Second seat — example scenario",
        stake: 10,
        hostFee: 1,
        topic: "The Pivot: Sunday Calls",
        subtitle: "Week 1 · Full Slate",
        caption: "We talk it every week. Today you call it with us.",
        legs: [
        { question: "Bigger day through the air: Burrow in Cincy or Stroud in Houston?", options: ["Burrow","Stroud"], context: "Head-to-head, two different games." },
        { question: "Who owns the boards of the box score: which defense forces more takeaways — SF, BAL, or NYJ?", options: ["SF","BAL","NYJ"], context: "Field leader across three games. Total takeaways settles it." },
        { question: "First receiver to 100 yards across the late window: Hill, Adams, or Aiyuk?", options: ["Hill","Adams","Aiyuk"], context: "A race across three games." },
        ],
      },
    ],
  },
  {
    id: "nba",
    name: "NBA Basketball",
    emoji: "🏀",
    color: "#FC3E01",
    creators: [
      {
        id: "teague",
        name: "Jeff Teague",
        initials: "JT",
        followers: 1000000,
        tier: "1M",
        role: "Category Boss — example scenario",
        stake: 10,
        hostFee: 1,
        topic: "Friday Night: Whose League Is It?",
        subtitle: "Friday · 8-game board",
        caption: "I played with half these dudes. Let's see if you watch like I watch.",
        legs: [
        { question: "Whose night reads loudest Friday: Luka, Ant, or Wemby?", options: ["Luka","Ant","Wemby"], context: "Biggest stat night across three different games. Form on the card." },
        { question: "Who owns the glass across the Friday board: Sabonis, Gobert, or AD?", options: ["Sabonis","Gobert","AD"], context: "Field leader — total rebounds, three games." },
        { question: "First to 30 points anywhere on the slate: SGA, Tatum, or Booker?", options: ["SGA","Tatum","Booker"], context: "A race across three games. First there wins it." },
        ],
      },
    ],
  },
  {
    id: "pop",
    name: "Pop Culture",
    emoji: "🎤",
    color: "#7C5CF5",
    creators: [
      {
        id: "katt",
        name: "Katt Williams",
        initials: "KW",
        followers: 5000000,
        tier: "5M",
        role: "Category Boss — example scenario",
        stake: 10,
        hostFee: 2,
        topic: "The Special Drops Friday",
        subtitle: "Pop Culture · The Drop",
        caption: "I already told y'all what happens next. Friday you find out who was listening.",
        legs: [
        { question: "Which city sells out first once tour dates post: Atlanta, Houston, or Detroit?", options: ["Atlanta","Houston","Detroit"], context: "Settles: ticketing pages, dated." },
        { question: "Which clip crosses 1M views first: the opener, the encore, or the crowd moment?", options: ["Opener","Encore","Crowd moment"], context: "Settles: platform view counts, dated." },
        { question: "Where does the first sit-down land after the drop: podcast, morning radio, or late night?", options: ["Podcast","Morning radio","Late night"], context: "Settles: announced air dates." },
        ],
      },
    ],
  },
  {
    id: "comedy",
    name: "Comedy",
    emoji: "😂",
    color: "#F0C463",
    creators: [
      {
        id: "south85",
        name: "85 South Show",
        initials: "85",
        followers: 5000000,
        tier: "5M",
        role: "Category Boss — example scenario",
        stake: 10,
        hostFee: 2,
        topic: "Roast Season Opens",
        subtitle: "Comedy · The Roast",
        caption: "Somebody's getting cooked this month. Call the kitchen.",
        legs: [
        { question: "Who's announced on the roast card first?", options: ["The rapper","The ball player","The reality star"], context: "Settles: official card announcement, dated." },
        { question: "Which clip from the tour hits 1M first: the freestyle, the crowd work, or the walk-on?", options: ["Freestyle","Crowd work","Walk-on"], context: "Settles: platform view counts, dated." },
        { question: "Who responds on record first after the trailer drops?", options: ["Camp A","Camp B","Nobody in 7 days"], context: "Settles: on-record statement or post, dated window." },
        ],
      },
      {
        id: "dl",
        name: "DL Hughley",
        initials: "DL",
        followers: 5000000,
        tier: "5M",
        role: "Second seat — example scenario",
        stake: 10,
        hostFee: 2,
        topic: "The Radio Week",
        subtitle: "Comedy · The Response",
        caption: "Five mornings a week I make the calls. This week you make 'em with me.",
        legs: [
        { question: "Who addresses the interview on record first?", options: ["The host","The guest","Neither in 7 days"], context: "Settles: on-record statement, 7-day window." },
        { question: "Which special gets announced first this month?", options: ["Comic A","Comic B","Comic C"], context: "Settles: platform announcement, dated." },
        { question: "Which morning-show moment clears 1M views first?", options: ["Monday's","Wednesday's","Friday's"], context: "Settles: platform counts, dated." },
        ],
      },
    ],
  },
  {
    id: "music",
    name: "Hip-Hop & Music",
    emoji: "🎧",
    color: "#FF4D8D",
    creators: [
      {
        id: "budden",
        name: "Joe Budden",
        initials: "JB",
        followers: 5000000,
        tier: "5M",
        role: "Category Boss — example scenario",
        stake: 10,
        hostFee: 2,
        topic: "Release Friday: The Chart Race",
        subtitle: "Music · The Drop",
        caption: "The pod already made the calls. Your turn to timestamp yours.",
        legs: [
        { question: "Which album debuts higher on the chart Friday?", options: ["Album A","Album B"], context: "Settles: the published chart, dated." },
        { question: "Which single off the album leads streaming after week one?", options: ["Track 1","Track 4","Track 7"], context: "Settles: platform chart, dated." },
        { question: "Who announces a tour first after release week?", options: ["Artist A","Artist B","Neither in 14 days"], context: "Settles: official announcement, dated window." },
        ],
      },
      {
        id: "rage",
        name: "The Lady of Rage",
        initials: "LR",
        followers: 1000000,
        tier: "1M",
        role: "West Coast & Legacy — example scenario",
        stake: 10,
        hostFee: 1,
        topic: "Legacy Weekend",
        subtitle: "Music · West Coast & Legacy",
        caption: "Afro puffs never left. Neither did the West. Lock your calls in.",
        legs: [
        { question: "Which anniversary edition posts first this month?", options: ["Record A","Record B","Record C"], context: "Settles: official release listing, dated." },
        { question: "Which legacy act gets announced for the festival first?", options: ["Act A","Act B","Act C"], context: "Settles: festival lineup announcement." },
        { question: "Which classic crosses the streaming milestone first?", options: ["Track A","Track B"], context: "Settles: platform milestone, dated." },
        ],
      },
    ],
  },
  {
    id: "reality",
    name: "Reality TV",
    emoji: "📺",
    color: "#4DA6FF",
    creators: [
      {
        id: "yee",
        name: "Angela Yee",
        initials: "AY",
        followers: 5000000,
        tier: "5M",
        role: "Category Boss — example scenario",
        stake: 10,
        hostFee: 2,
        topic: "Reunion Night",
        subtitle: "Reality TV · built before it airs",
        caption: "I ask the questions for a living. Tonight you answer three of mine.",
        legs: [
        { question: "Who brings the receipts first?", options: ["Cast A","Cast B","Cast C"], context: "Settles: the broadcast. Slate locks before air — that's the rule." },
        { question: "Who leaves the couch first?", options: ["Cast A","Cast B","Nobody"], context: "Settles: the broadcast." },
        { question: "Whose apology actually lands on camera?", options: ["Cast A","Cast B","No apology airs"], context: "Settles: the broadcast." },
        ],
      },
    ],
  },
  {
    id: "gospel",
    name: "Gospel",
    emoji: "🙌",
    color: "#B58CFF",
    creators: [
      {
        id: "smiley",
        name: "Rickey Smiley",
        initials: "RS",
        followers: 5000000,
        tier: "5M",
        role: "Category Boss — example scenario",
        stake: 10,
        hostFee: 2,
        topic: "Award Sunday",
        subtitle: "Gospel · The Stage",
        caption: "Church, we watching together this Sunday. Make your calls before the doors open.",
        legs: [
        { question: "Who takes the opening performance slot?", options: ["Artist A","Artist B","A choir"], context: "Settles: the broadcast rundown." },
        { question: "Who's announced in the tribute lineup first?", options: ["Artist A","Artist B","Artist C"], context: "Settles: official lineup announcement, dated." },
        { question: "Which moment trends first after the show: the medley, the tribute, or the acceptance?", options: ["Medley","Tribute","Acceptance"], context: "Settles: platform trending lists, dated." },
        ],
      },
    ],
  },
  {
    id: "wnba",
    name: "WNBA",
    emoji: "⛹🏽‍♀️",
    color: "#FF8A3D",
    creators: [
      {
        id: "bossfox-w",
        name: "Boss Fox",
        initials: "BF",
        followers: 1000000,
        tier: "1M",
        role: "House demo — boss seat open",
        stake: 10,
        hostFee: 1,
        topic: "Friday Doubleheader",
        subtitle: "WNBA · two games, one night",
        caption: "The house doesn't play — the house hosts. Seat's open for the right boss.",
        legs: [
        { question: "Bigger night Friday: A'ja in Vegas or Caitlin in Indy?", options: ["A'ja","Caitlin"], context: "Head-to-head, two different games." },
        { question: "Who owns the assists column across the doubleheader?", options: ["Guard A","Guard B","Guard C"], context: "Field leader — most assists across both games." },
        { question: "First to 20 points anywhere on the night?", options: ["Player A","Player B","Player C"], context: "A race across the doubleheader." },
        ],
      },
    ],
  },
  {
    id: "wrestling",
    name: "Wrestling",
    emoji: "🤼",
    color: "#E7E7EB",
    creators: [
      {
        id: "bossfox-wr",
        name: "Boss Fox",
        initials: "BF",
        followers: 1000000,
        tier: "1M",
        role: "House demo — boss seat open",
        stake: 10,
        hostFee: 1,
        topic: "Premium Live Event Week",
        subtitle: "Wrestling · card week",
        caption: "Everybody's got a theory about Sunday. Timestamp yours.",
        legs: [
        { question: "Who's revealed as the surprise entrant first?", options: ["Name A","Name B","A returning legend"], context: "Settles: the broadcast." },
        { question: "Which match opens the card?", options: ["Title match","Grudge match","Tag match"], context: "Settles: broadcast running order." },
        { question: "Who's announced for the NEXT event live on air?", options: ["Name A","Name B","Nobody"], context: "Settles: the broadcast." },
        ],
      },
    ],
  },
  {
    id: "fashion",
    name: "Fashion",
    emoji: "🧥",
    color: "#2FD1C8",
    creators: [
      {
        id: "bossfox-f",
        name: "Boss Fox",
        initials: "BF",
        followers: 1000000,
        tier: "1M",
        role: "House demo — boss seat open",
        stake: 10,
        hostFee: 1,
        topic: "Fashion Week Opens",
        subtitle: "Fashion · the calendar",
        caption: "The tents go up Monday. Get your calls in before the first look walks.",
        legs: [
        { question: "Which house announces its collab first?", options: ["House A","House B","House C"], context: "Settles: official announcement, dated." },
        { question: "Who opens the headline show?", options: ["Model A","Model B","A debut face"], context: "Settles: runway order." },
        { question: "Which drop sells out first once listings post?", options: ["Drop A","Drop B"], context: "Settles: retailer listing status, dated." },
        ],
      },
    ],
  },];

/**
 * The exported script, with the ruling enforced on the way out rather than trusted on the way in.
 * A reference revision that adds a fourth leg gets truncated here instead of shipping.
 */
export const DEMO_SCRIPT: DemoCategory[] = RAW.map((c) => ({
  ...c,
  creators: c.creators.map((h) => ({ ...h, legs: h.legs.slice(0, LEGS_PER_SLATE) })),
}));

/** Flat host list, for the presenter's jump menu. */
export const DEMO_HOSTS: DemoHost[] = DEMO_SCRIPT.flatMap((c) => c.creators);

/** Shape assertions the gate test re-checks: one topic, three legs, everywhere. */
export const DEMO_SHAPE = {
  topicsPerSlate: TOPICS_PER_SLATE,
  legsPerSlate: LEGS_PER_SLATE,
  categories: DEMO_SCRIPT.length,
  hosts: DEMO_HOSTS.length,
} as const;
