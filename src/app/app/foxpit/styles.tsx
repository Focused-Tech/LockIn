import { ELEVATOR_STOP_PCT as S } from "@/lib/foxpit/rules";

/** Shared Fox Pit keyframes (client-injected so we don't touch globals.css). */
export function FoxPitStyles() {
  return (
    <style>{`
      @keyframes foxpitBob { 0%,100%{ transform: translateY(0);} 50%{ transform: translateY(-6px);} }
      @keyframes foxpitKeySpin { 0%{ transform: rotateY(0deg) translateY(0);} 50%{ transform: rotateY(180deg) translateY(-10px);} 100%{ transform: rotateY(360deg) translateY(0);} }
      @keyframes foxpitGlow { 0%,100%{ box-shadow: 0 0 24px rgba(252,62,1,.35);} 50%{ box-shadow: 0 0 54px rgba(252,62,1,.7);} }
      @keyframes foxpitAvatarUp { 0%{ transform: translateY(100%); opacity:.2;} 60%{ transform: translateY(0); opacity:1;} 100%{ transform: translateY(0); opacity:1;} }
      @keyframes foxpitDoorL { to { transform: translateX(-100%);} }
      @keyframes foxpitDoorR { to { transform: translateX(100%);} }
      @keyframes foxpitFadeUp { from{ opacity:0; transform: translateY(14px);} to{ opacity:1; transform: translateY(0);} }
      @keyframes foxpitTablePull { 0%{ opacity:0; transform: translateY(46%) scale(.55);} 70%{ opacity:1;} 100%{ opacity:1; transform: translateY(0) scale(1);} }
      /* Practice-Here: the card bounces + the down-arrow flashes once every 7s. */
      @keyframes foxpitPracticeBounce { 0%,80%,100%{ transform: translateY(0);} 86%{ transform: translateY(-11px);} 92%{ transform: translateY(-3px);} 96%{ transform: translateY(0);} }
      @keyframes foxpitArrowFlash { 0%,78%,100%{ opacity:.9;} 84%{ opacity:.12;} 90%{ opacity:1;} 95%{ opacity:.5;} }
      /* Coin drop on the winner announcement — coins fall onto the table and settle. */
      @keyframes foxpitCoinDrop {
        0%   { transform: translateY(-140%) scale(.7) rotate(0deg); opacity: 0; }
        12%  { opacity: 1; }
        70%  { transform: translateY(0) scale(1) rotate(180deg); }
        82%  { transform: translateY(-12%) scale(1) rotate(200deg); }
        100% { transform: translateY(0) scale(1) rotate(220deg); opacity: 1; }
      }
      /* The car's BOTTOM rests on each landing drawn into the tower art — the stop
         percentages are ELEVATOR_STOP_PCT (see rules.ts for how they were read).
         Ride order: Dojo → Lobby → Coliseum → High Table → Suite, then back down. */
      @keyframes foxpitElevatorStops {
        0%,5%    { top:${S.dojo}%; }
        11%,16%  { top:${S.lobby}%; }
        22%,29%  { top:${S.coliseum}%; }
        35%,40%  { top:${S.hightable}%; }
        46%,54%  { top:${S.suite}%; }
        60%,65%  { top:${S.hightable}%; }
        71%,78%  { top:${S.coliseum}%; }
        84%,89%  { top:${S.lobby}%; }
        95%,100% { top:${S.dojo}%; }
      }
    `}</style>
  );
}
