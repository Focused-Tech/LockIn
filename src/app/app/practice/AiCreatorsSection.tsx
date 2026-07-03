"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { AiBadge } from "@/components/practice/AiBadge";
import { AI_CREATORS, type AiCreator } from "@/lib/practice/creators";
import { playstyleTint } from "@/lib/practice/tints";
import { PRACTICE_CONFIG } from "@/lib/practice/config";
import { playSound } from "@/lib/practice/sound";
import { createPracticeContest, toggleFollowAiCreator } from "./actions";

/**
 * AI TRAINING OPPONENTS — follow simulated creators and play their styled
 * practice slates. Honest framing (clear AI labels), play-money only. Followed
 * creators surface at the top as the player's training feed; everyone else sits
 * under "Discover". Tapping Play generates a slate in the creator's style and
 * jumps straight into it (same instant simulated settlement as any practice slate).
 */
export function AiCreatorsSection({ following }: { following: string[] }) {
  const router = useRouter();
  const [followed, setFollowed] = useState<Set<string>>(new Set(following));
  const [busy, setBusy] = useState<string | null>(null); // creatorId being played
  const [error, setError] = useState<string | null>(null);
  const [, startFollow] = useTransition();
  const [, startPlay] = useTransition();

  const toggle = (c: AiCreator) => {
    const next = new Set(followed);
    const willFollow = !next.has(c.id);
    if (willFollow) next.add(c.id);
    else next.delete(c.id);
    setFollowed(next); // optimistic
    playSound("tick");
    startFollow(async () => {
      const res = await toggleFollowAiCreator(c.id);
      if (!res.ok) {
        // revert on failure
        setFollowed((s) => {
          const r = new Set(s);
          if (willFollow) r.delete(c.id);
          else r.add(c.id);
          return r;
        });
      }
    });
  };

  const play = (c: AiCreator) => {
    setError(null);
    setBusy(c.id);
    playSound("locking");
    startPlay(async () => {
      const res = await createPracticeContest({
        category: c.categories[0]!,
        mode: "ai",
        creatorId: c.id,
      });
      if (res.ok) router.push(`/app/practice/${res.contestId}`);
      else {
        setError(res.error);
        setBusy(null);
      }
    });
  };

  const followedList = AI_CREATORS.filter((c) => followed.has(c.id));
  const discoverList = AI_CREATORS.filter((c) => !followed.has(c.id));

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold">Train vs AI creators</h2>
        <p className="text-xs text-muted">{PRACTICE_CONFIG.aiCreators.tagline}</p>
      </div>

      {error && (
        <p className="rounded border border-loss-border bg-loss-soft px-3 py-2 text-sm text-loss">
          {error}
        </p>
      )}

      {followedList.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Following · your training feed
          </p>
          {followedList.map((c) => (
            <CreatorCard
              key={c.id}
              creator={c}
              following
              playing={busy === c.id}
              onToggle={() => toggle(c)}
              onPlay={() => play(c)}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {followedList.length > 0 && (
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Discover
          </p>
        )}
        {discoverList.map((c) => (
          <CreatorCard
            key={c.id}
            creator={c}
            following={false}
            playing={busy === c.id}
            onToggle={() => toggle(c)}
            onPlay={() => play(c)}
          />
        ))}
      </div>
    </section>
  );
}

function CreatorCard({
  creator: c,
  following,
  playing,
  onToggle,
  onPlay,
}: {
  creator: AiCreator;
  following: boolean;
  playing: boolean;
  onToggle: () => void;
  onPlay: () => void;
}) {
  // Outline tinted by PLAYSTYLE lean (favorites=teal / balanced=amber /
  // underdog=red) — carries the creator's style as information, not brand orange.
  const tint = playstyleTint(c.difficulty);
  return (
    <Card
      className="flex flex-col gap-2.5 border-l-4"
      style={{ borderColor: tint.border, borderLeftColor: tint.color }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl"
            style={{
              backgroundColor: `${c.accent}1F`,
              border: `1px solid ${c.accent}66`,
            }}
          >
            {c.avatar}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold">{c.name}</span>
              <AiBadge />
            </div>
            <p className="truncate text-xs text-muted">
              @{c.handle} · {c.persona}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={following}
          className={
            "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition active:scale-95 " +
            (following
              ? "border-[rgba(34,197,94,0.35)] bg-[rgba(34,197,94,0.10)] text-win"
              : "border-border bg-transparent text-foreground hover:bg-surface-card")
          }
        >
          {following ? "Following ✓" : "Follow"}
        </button>
      </div>

      <p className="text-xs text-muted">{c.blurb}</p>

      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{ backgroundColor: tint.soft, color: tint.color }}
        >
          {c.styleNote}
        </span>
        {c.categories.slice(0, 3).map((cat) => (
          <span
            key={cat}
            className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted"
          >
            {cat}
          </span>
        ))}
      </div>

      <Button
        variant="win"
        size="sm"
        className="w-full"
        disabled={playing}
        onClick={onPlay}
      >
        {playing ? "Dealing slate…" : `Play ${c.name.split(" ")[0]}'s slate →`}
      </Button>
    </Card>
  );
}
