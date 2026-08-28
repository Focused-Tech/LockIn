"use client";

/**
 * SUBCATEGORY SEARCH (B) — the creator TYPES a show or league and gets matches from the live index
 * (Firestore over seed). It never dead-ends: a not-yet-indexed show resolves to a "Use …" fallback the
 * creator can pick. No show names live in this component — every result comes from the data index via
 * `searchSubcategoriesAction`. Uses the builder's own CSS classes so it renders native to the step.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { searchSubcategoriesAction } from "@/lib/subcategories/actions";
import type { Subcategory, QuestionDomain } from "@/lib/subcategories/types";

export function SubcategorySearch({
  onSelect,
  selected,
  domain,
}: {
  onSelect: (s: Subcategory) => void;
  selected?: Subcategory | null;
  /**
   * STORE COMPLIANCE STRIP — restrict results to one domain. Used by CreatorBuilder (app, cash) to
   * keep entertainment shows out of the app's cash-hosting search entirely — not hidden after a
   * pick, never offered. Omit for an unrestricted search (the website's builder).
   */
  domain?: QuestionDomain;
}) {
  const [q, setQ] = useState("");
  const [matches, setMatches] = useState<Subcategory[]>([]);
  const [fallback, setFallback] = useState<Subcategory | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const seq = useRef(0);

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setMatches([]);
      setFallback(null);
      setOpen(false);
      return;
    }
    const id = ++seq.current;
    const t = setTimeout(() => {
      start(async () => {
        const res = await searchSubcategoriesAction(query);
        if (id !== seq.current) return; // ignore out-of-order responses
        const inDomain = (s: Subcategory) => !domain || s.domain === domain;
        setMatches(res.matches.filter(inDomain));
        setFallback(res.fallback && inDomain(res.fallback) ? res.fallback : null);
        setOpen(true);
      });
    }, 180);
    return () => clearTimeout(t);
  }, [q, start, domain]);

  const pick = (s: Subcategory) => {
    onSelect(s);
    setQ(s.name);
    setOpen(false);
  };

  return (
    <div className="blk" style={{ position: "relative" }}>
      <div className="lb">Show or league <i></i></div>
      <input
        type="text"
        placeholder="Search a show or league — Basketball Wives, NBA, Top Chef…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => q.trim() && setOpen(true)}
        autoComplete="off"
      />
      {selected && !open && (
        <p className="hint" style={{ marginTop: 8 }}>
          Selected: <b style={{ color: "#fff" }}>{selected.name}</b> · {selected.category}
          {selected.subjectSource === "creator_cast" ? " · you'll add the cast" : " · live roster"}
        </p>
      )}
      {open && (matches.length > 0 || fallback) && (
        <div className="pool" id="subcatPool" style={{ marginTop: 10 }}>
          {matches.map((s) => (
            <button key={s.slug} type="button" className="ath" onClick={() => pick(s)}>
              <b>{s.name}</b>
              <span>
                {s.category}
                {s.source ? ` · ${s.source}` : ""}
              </span>
            </button>
          ))}
          {fallback && (
            <button key="__fallback" type="button" className="ath" onClick={() => pick(fallback)}>
              <b>Use “{fallback.name}”</b>
              <span>Not indexed yet · you&apos;ll add the cast</span>
            </button>
          )}
        </div>
      )}
      {pending && (
        <p className="hint" style={{ marginTop: 8 }}>
          Searching…
        </p>
      )}
    </div>
  );
}
