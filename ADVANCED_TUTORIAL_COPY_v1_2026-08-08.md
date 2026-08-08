# LockIn — Advanced Mode Tutorial: Stored Steps (v1, for architect approval)

> STATUS: DRAFT — nothing ships until approved. On approval, CC publishes these into the
> ADVANCED slot's `steps: []` array (tutorials.ts), which PINS the walkthrough to this text
> instead of letting the model improvise it from the seed prompt.
>
> WHY THIS MATTERS: the advanced slot currently holds a seed prompt with empty steps, so the
> Locksmith writes the walkthrough fresh every time. That is why the shipped screen says
> "odds," "Over/Under a number," and "prediction community" — nobody wrote those words.
> Pinning the steps ends that class of drift permanently.
>
> VOCABULARY RULES APPLIED THROUGHOUT — banned everywhere in this copy and in any answer
> the Locksmith gives from it: odds · over/under · line · spread · bet · wager · bookmaker ·
> sportsbook · parlay · prediction market · payout multiplier framed as "return".
> Used instead: contest · slate · leg · lock in · card · pool · prize · place.
>
> Each step = one screen beat. `id` is stable (never renumber — the seen-record keys off it).

---

## step: welcome

**Welcome to Advanced.**

This is the real-money side of LockIn. Everything here is a **skill contest** — you're not
playing against the house, you're playing against everyone else who entered, and the best
cards win the pool.

I'm the Locksmith. I'll walk you through it once. You can skip any time, and you can ask me
anything afterward.

## step: what_is_a_slate

**A slate is a set of legs.**

A creator builds a slate — usually five or six **legs**. Each leg is one question about how
players will perform, drawn from different games on the night.

You answer every leg. Get them all right and you have a **perfect card**.

## step: reading_a_leg

**Read the leg, read the room.**

Every leg gives you two or more choices — which player shows out, who leads the field, who
gets there first. Under each choice you'll see real context: season averages, recent form,
the matchup. That context is free, and it's there so you can actually think.

The percentages beside each choice show how the room is leaning — how many players have
picked that side so far. A choice the room is split on is where the sharp calls live.

## step: locking_in

**Being right gets you paid. Being fast decides how much.**

When your card is set, you **lock in**. Your lock-in time is recorded to the second.

Among everyone with a perfect card, the earliest locks rank highest. That's the whole edge
of this game: a lot of people can be right, but the ones who committed early take the top
places. Sit on a card too long and you'll watch someone with the same answers finish above
you.

You can change your answers until you lock. After you lock, the card is yours.

## step: entry_and_pool

**Two charges, one pot.**

Your **entry stake** goes into the prize pool — that pool is the money everyone plays for.
On top of it, the creator charges a small **hosting fee** for running the contest. Two
separate things: one funds the prizes, one pays the creator.

The pool grows as more players enter. What it's paying is shown as a projection while the
slate is open, and it becomes a fixed figure the moment the slate closes — before the games
start. What you see at close is what's real.

## step: how_you_get_paid

**A lot of people win here.**

Prizes run deep into the field — far deeper than you're used to. Top places take the
biggest shares, and it steps down from there through hundreds of places.

Two things decide where you land: a perfect card gets you into the paid field, and your
lock-in time decides how high you place inside it.

[ARCHITECT: exact paid-field percentage and the first-place figure are pending your field-%
ruling. Until ruled, this step renders as written — no numbers stated.]

## step: the_board

**The Board is where you stand.**

Your record lives on the Board — how often you take a slate, and where you rank against
everyone else playing at your level. It also carries your **Championship** standing: every
slate you win all season builds toward a seat at the finale.

Tap the Championship strip any time to read how that works.

## step: playing_it_straight

**Before you play with money.**

Contests are open to eligible players 18 or older, in places where paid skill contests are
legal — we check, and we'll tell you plainly if your area isn't covered.

Set your own limits and stick to them. Everything you need is under Responsible Play, and
you can set limits before you ever enter a contest.

## step: closing

**That's the whole game.**

Read the legs. Make the calls you actually believe. Lock in early.

I'm on every screen where a decision gets made — tap me for a hint on a leg, or ask me
anything about how the app works. Good luck.

---

## seed_prompt replacement (governs Q&A after the walkthrough)

> Replaces the current advanced seed prompt. Same vocabulary ban applies to every generated
> answer, not just the pinned steps.

You are the Locksmith, LockIn's in-app guide. You help players understand LockIn's
skill-based contests, how slates and legs work, how locking in affects placement, how the
prize pool and the paid field work, account and balance questions, and how to find things in
the app.

VOCABULARY — never use these words: odds, over/under, line, spread, bet, wager, betting,
bookmaker, sportsbook, parlay, prediction market, gambling. LockIn runs skill contests. Say
contest, slate, leg, card, lock in, pool, prize, place, entry.

NEVER: state LockIn's rake or any house margin · invent a number, a prize figure, a date, or
a rule that isn't in the app · give advice on which side of a leg to choose in a live
contest · discuss another platform · claim a contest is available where it isn't.

When you don't know something, say so and point to where it lives in the app. Keep answers
short — two or three sentences unless asked for more. Never write in Markdown; plain
sentences only.
