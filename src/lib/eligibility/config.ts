// LEGAL: this allowlist is set by counsel. Do not add jurisdictions without sign-off.
//
// LEGAL: Starting classification for a PEER-TO-PEER PICK'EM contest, current as of Jul 2026.
// This is compliant-by-default, NOT a legal determination. Counsel confirms every "allow",
// evaluates whether LockIn's peer-to-peer structure reopens any "block_pickem" state,
// and confirms registration/fees where required. Anything not "allow" blocks real-money.
// Practice is open everywhere.
//
// Shape (attorney-editable):
//   defaultRealMoneyAllowed — fail closed; never authorizes on its own.
//   allowedCountries        — ISO country codes real-money is offered in.
//   states[<US region>]     — { status: "allow" | "block_*", minAge } keyed by the
//                             two-letter region code Vercel reports (x-vercel-ip-country-region).
//                             Only status === "allow" permits real-money play.
export const ELIGIBILITY = {
  defaultRealMoneyAllowed: false, // fail closed
  allowedCountries: ["US"], // US-only at launch; all other countries blocked
  states: {
    // ---- ALLOW (candidate-legal for pick'em; attorney confirms) ----
    AL: { status: "allow", minAge: 19 },
    AK: { status: "allow", minAge: 18 },
    FL: { status: "allow", minAge: 18 },
    GA: { status: "allow", minAge: 18 },
    IL: { status: "allow", minAge: 18 },
    IN: { status: "allow", minAge: 18 },
    KY: { status: "allow", minAge: 18 },
    MA: { status: "allow", minAge: 21 },
    MN: { status: "allow", minAge: 18 },
    NE: { status: "allow", minAge: 19 },
    NH: { status: "allow", minAge: 18 },
    NM: { status: "allow", minAge: 18 },
    ND: { status: "allow", minAge: 18 },
    OK: { status: "allow", minAge: 18 },
    RI: { status: "allow", minAge: 18 },
    SC: { status: "allow", minAge: 18 },
    SD: { status: "allow", minAge: 18 },
    TN: { status: "allow", minAge: 18 },
    TX: { status: "allow", minAge: 18 },
    VA: { status: "allow", minAge: 18 },
    WI: { status: "allow", minAge: 18 },
    WV: { status: "allow", minAge: 18 },
    WY: { status: "allow", minAge: 18 },
    DC: { status: "allow", minAge: 18 },

    // ---- BLOCK: DFS illegal entirely ----
    HI: { status: "block_dfs", minAge: 99 },
    ID: { status: "block_dfs", minAge: 99 },
    MT: { status: "block_dfs", minAge: 99 },
    NV: { status: "block_dfs", minAge: 99 },
    WA: { status: "block_dfs", minAge: 99 },

    // ---- BLOCK: pick'em restricted/contested (attorney: check if peer-to-peer reopens these) ----
    AZ: { status: "block_pickem", minAge: 99 },
    AR: { status: "block_pickem", minAge: 99 },
    CA: { status: "block_pickem", minAge: 99 }, // 2025 AG opinion — high risk
    CO: { status: "block_pickem", minAge: 99 },
    CT: { status: "block_pickem", minAge: 99 },
    DE: { status: "block_pickem", minAge: 99 },
    IA: { status: "block_pickem", minAge: 99 },
    KS: { status: "block_pickem", minAge: 99 },
    LA: { status: "block_pickem", minAge: 99 }, // parish-by-parish — complex
    ME: { status: "block_pickem", minAge: 99 },
    MD: { status: "block_pickem", minAge: 99 },
    MI: { status: "block_pickem", minAge: 99 },
    MO: { status: "block_pickem", minAge: 99 },
    MS: { status: "block_pickem", minAge: 99 },
    NJ: { status: "block_pickem", minAge: 99 },
    NY: { status: "block_pickem", minAge: 99 }, // peer-to-peer may qualify — attorney call
    NC: { status: "block_pickem", minAge: 99 },
    OH: { status: "block_pickem", minAge: 99 },
    OR: { status: "block_pickem", minAge: 99 }, // DFS legal but pick'em unclear
    PA: { status: "block_pickem", minAge: 99 },
    UT: { status: "block_pickem", minAge: 99 }, // bans essentially all gambling
    VT: { status: "block_pickem", minAge: 99 }, // AG called DFS illegal
  },
} as const;

export type JurisdictionStatus =
  (typeof ELIGIBILITY.states)[keyof typeof ELIGIBILITY.states]["status"];
