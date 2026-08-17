"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isSfxOn, setSfxOn } from "@/lib/practice/sound";
import { isMusicOn, setMusicOn, startMusic } from "@/lib/practice/music";
import { DownloadMyDataRow, DeleteAccountRow } from "./AccountDataRows";

/** A local (device) preference toggle backed by localStorage. Honest local prefs —
 *  notifications/privacy have no server yet, so they persist on-device only. */
function useLocalPref(key: string, dflt: boolean): [boolean, (v: boolean) => void] {
  const [on, setOn] = useState(dflt);
  useEffect(() => {
    try {
      const v = localStorage.getItem(key);
      if (v != null) setOn(v === "1");
    } catch {
      /* ignore */
    }
  }, [key]);
  const set = (v: boolean) => {
    setOn(v);
    try {
      localStorage.setItem(key, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  };
  return [on, set];
}

function Toggle({ on, onFlip }: { on: boolean; onFlip: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      className={"tg" + (on ? " on" : "")}
      onClick={onFlip}
    />
  );
}

function TgRow({
  title,
  hint,
  on,
  onFlip,
}: {
  title: string;
  hint?: string;
  on: boolean;
  onFlip: () => void;
}) {
  return (
    <div className="row static">
      <span className="n">
        <b>{title}</b>
        {hint && <span>{hint}</span>}
      </span>
      <Toggle on={on} onFlip={onFlip} />
    </div>
  );
}

function LinkRow({
  title,
  hint,
  value,
  valueMuted,
  href,
}: {
  title: string;
  hint?: string;
  value?: string;
  valueMuted?: boolean;
  href?: string;
}) {
  const body = (
    <>
      <span className="n">
        <b>{title}</b>
        {hint && <span>{hint}</span>}
      </span>
      {value ? (
        <span className={"val" + (valueMuted ? " muted" : "")}>{value}</span>
      ) : (
        <span className="cv">›</span>
      )}
    </>
  );
  return href ? (
    <Link href={href} className="row">
      {body}
    </Link>
  ) : (
    <button type="button" className="row">
      {body}
    </button>
  );
}

/**
 * SETTINGS — the audio toggles' PERMANENT HOME. SFX/Music write the SAME fields the
 * practice landing control writes (lockin.practice.sfxOff / lockin.practice.musicOn),
 * so the two controls share ONE source of truth — flipping here changes it everywhere.
 */
export function SettingsView({
  email,
  location,
  verified,
}: {
  email: string;
  location: string | null;
  verified: boolean;
}) {
  // Audio — the shared source of truth (NOT a fork).
  const [sfx, setSfx] = useState(true);
  const [music, setMusic] = useState(false);
  useEffect(() => {
    setSfx(isSfxOn());
    setMusic(isMusicOn());
  }, []);

  // Notifications + privacy — on-device prefs (no server yet).
  const [nLock, setNLock] = useLocalPref("lockin.notif.lock", true);
  const [nRes, setNRes] = useLocalPref("lockin.notif.results", true);
  const [nCre, setNCre] = useLocalPref("lockin.notif.creators", false);
  const [nRef, setNRef] = useLocalPref("lockin.notif.referrals", false);
  const [pName, setPName] = useLocalPref("lockin.privacy.showHandle", true);
  const [pFol, setPFol] = useLocalPref("lockin.privacy.allowFollow", true);

  return (
    <div className="lk-acct flex flex-col gap-4 p-4 pb-24">
      <div className="blk">
        <div className="lb">Sound <i></i></div>
        <TgRow
          title="Sound effects"
          hint="Locks, reveals and card deals"
          on={sfx}
          onFlip={() => {
            const next = !sfx;
            setSfx(next);
            setSfxOn(next);
          }}
        />
        <TgRow
          title="Music"
          hint="Background track in the arena"
          on={music}
          onFlip={() => {
            const next = !music;
            setMusic(next);
            setMusicOn(next);
            if (next) startMusic("solo");
          }}
        />
        <p className="hint mt-3">
          These follow you everywhere in the app, not just the arena.
        </p>
      </div>

      <div className="blk">
        <div className="lb">Notifications <i></i></div>
        <TgRow title="Locking soon" hint="15 minutes before a slate you entered locks" on={nLock} onFlip={() => setNLock(!nLock)} />
        <TgRow title="Results" hint="When a contest you entered settles" on={nRes} onFlip={() => setNRes(!nRes)} />
        <TgRow title="From creators you follow" hint="New slates as they go live" on={nCre} onFlip={() => setNCre(!nCre)} />
        <TgRow title="Referrals" hint="When a friend you invited plays" on={nRef} onFlip={() => setNRef(!nRef)} />
      </div>

      <div className="blk">
        <div className="lb">Account <i></i></div>
        <LinkRow title="Email" hint={email} />
        <LinkRow title="Password" hint="Change your password" />
        <LinkRow
          title="Verification"
          hint="Confirm your identity to withdraw"
          value={verified ? "Verified" : "Unverified"}
          valueMuted={!verified}
        />
        <LinkRow
          title="Location"
          hint="Used to check your state is eligible"
          value={location ?? "Not set"}
          valueMuted={!location}
        />
      </div>

      <div className="blk">
        <div className="lb">Privacy <i></i></div>
        <TgRow title="Show my handle on the board" hint="Off means you appear as Anonymous" on={pName} onFlip={() => setPName(!pName)} />
        <TgRow title="Let others follow me" on={pFol} onFlip={() => setPFol(!pFol)} />
        <DownloadMyDataRow />
      </div>

      <div className="blk">
        <div className="lb">Legal <i></i></div>
        <LinkRow title="Terms of service" />
        <LinkRow title="Privacy policy" />
        <LinkRow title="Contest rules" hint="How scoring and payouts work" />
      </div>

      <div className="blk warn">
        <div className="lb">Danger zone <i></i></div>
        <DeleteAccountRow />
      </div>

      <p className="legal">
        Skill-based prediction contest platform. Not gambling. Not sports betting. 18+.
      </p>
    </div>
  );
}
