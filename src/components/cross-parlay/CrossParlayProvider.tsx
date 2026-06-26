"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { CROSS_PARLAY_MAX_PICKS } from "@/lib/constants";

export interface ParlayCartPick {
  slateId: string;
  slateTitle: string;
  predictionId: string;
  question: string;
  pickValue: "a" | "b";
  pickLabel: string;
  lockTimeMs: number;
}

interface CrossParlayContextValue {
  picks: ParlayCartPick[];
  /** Distinct slate count in the cart. */
  slateCount: number;
  add: (pick: ParlayCartPick) => void;
  remove: (slateId: string, predictionId: string) => void;
  clear: () => void;
  has: (slateId: string, predictionId: string) => boolean;
  open: boolean;
  setOpen: (v: boolean) => void;
}

const Ctx = createContext<CrossParlayContextValue | null>(null);
const STORAGE_KEY = "lockin:parlay";

/** Cart for in-progress cross-slate parlay picks, persisted to localStorage so it
 *  survives navigation across slates and reloads. */
export function CrossParlayProvider({ children }: { children: React.ReactNode }) {
  const [picks, setPicks] = useState<ParlayCartPick[]>([]);
  const [open, setOpen] = useState(false);

  // Hydrate from localStorage on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPicks(JSON.parse(raw) as ParlayCartPick[]);
    } catch {
      /* ignore malformed cart */
    }
  }, []);

  // Persist on change.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(picks));
    } catch {
      /* storage full / unavailable — cart is best-effort */
    }
  }, [picks]);

  const add = useCallback((pick: ParlayCartPick) => {
    setPicks((cur) => {
      const without = cur.filter(
        (p) =>
          !(p.slateId === pick.slateId && p.predictionId === pick.predictionId),
      );
      if (without.length >= CROSS_PARLAY_MAX_PICKS) return cur; // at the cap
      return [...without, pick];
    });
  }, []);

  const remove = useCallback((slateId: string, predictionId: string) => {
    setPicks((cur) =>
      cur.filter(
        (p) => !(p.slateId === slateId && p.predictionId === predictionId),
      ),
    );
  }, []);

  const clear = useCallback(() => setPicks([]), []);

  const has = useCallback(
    (slateId: string, predictionId: string) =>
      picks.some(
        (p) => p.slateId === slateId && p.predictionId === predictionId,
      ),
    [picks],
  );

  const slateCount = useMemo(
    () => new Set(picks.map((p) => p.slateId)).size,
    [picks],
  );

  const value = useMemo(
    () => ({ picks, slateCount, add, remove, clear, has, open, setOpen }),
    [picks, slateCount, add, remove, clear, has, open],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Access the parlay cart. Returns null outside the provider (safe no-op callers). */
export function useCrossParlay(): CrossParlayContextValue | null {
  return useContext(Ctx);
}
