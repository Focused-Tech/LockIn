import type { Config } from "tailwindcss";

/**
 * LockIn design system.
 * Cayenne accent (#FF3B00) is ALWAYS translucent — never a solid fill.
 * Use the `accent-*` utilities below for backgrounds/borders/text.
 */
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Base surfaces
        background: "#0A0D12",
        surface: {
          DEFAULT: "#0D1118",
          card: "#12161E",
        },
        border: "#1E2A38",
        // Text
        foreground: "#E8ECF2",
        muted: "#94A3B4",
        // Accent (cayenne) — solid value only for text/icons; backgrounds use the
        // translucent tokens below. Never apply as a solid bg fill.
        // Cayenne. The translucent fill/border are CSS variables so the
        // "reads brown at low opacity" fix can be switched between variants
        // (a/b/c) from one place — see ACCENT_VARIANT in src/lib/theme.ts and the
        // [data-accent] blocks in globals.css. Stays translucent (brand rule).
        accent: {
          DEFAULT: "#FF3B00",
          soft: "var(--accent-soft)",
          border: "var(--accent-border)",
        },
        // Money (creator engine + pot): gold = pot money, cash = the cash-currency accent.
        gold: "#F0C463",
        cash: "#2FB98A",
        // Semantic states
        win: "#22C55E",
        loss: "#E85454",
        live: "#F5A623",
        rush: {
          DEFAULT: "#9B5DE5",
          soft: "rgba(155,93,229,0.10)",
          border: "rgba(155,93,229,0.25)",
        },
        ai: "#3B8BFF",
      },
      borderRadius: {
        DEFAULT: "8px",
      },
      keyframes: {
        // Purple glow pulse — reserved for the Card Rush banner.
        "rush-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(155,93,229,0)" },
          "50%": { boxShadow: "0 0 18px 1px rgba(155,93,229,0.35)" },
        },
      },
      animation: {
        "rush-pulse": "rush-pulse 2.4s ease-in-out infinite",
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
