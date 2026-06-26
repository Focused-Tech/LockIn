"use client";

import { useState } from "react";
import { toggleFollowCreator } from "./followActions";

/** Follow/unfollow toggle for a creator. Optimistic, reverts on failure. */
export function FollowButton({
  creatorId,
  initialFollowing,
}: {
  creatorId: string;
  initialFollowing: boolean;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, setPending] = useState(false);

  async function toggle() {
    const next = !following;
    setFollowing(next);
    setPending(true);
    const res = await toggleFollowCreator(creatorId, next);
    if (!res.ok) setFollowing(!next); // revert
    setPending(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={
        "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors " +
        (following
          ? "border-border text-muted hover:text-foreground"
          : "border-accent-border bg-accent-soft text-accent")
      }
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}
