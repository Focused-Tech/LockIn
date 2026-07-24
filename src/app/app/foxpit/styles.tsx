import { ELEVATOR_STOP_BY_ID as S } from "@/lib/foxpit/rules";

/** Shared Fox Pit keyframes (client-injected so we don't touch globals.css). */
export function FoxPitStyles() {
  return (
    <style>{`
      @keyframes foxpitBob { 0%,100%{ transform: translateY(0);} 50%{ transform: translateY(-6px);} }
      /* Stair-climb bob — the single walk pose bobs while moving between waypoints. */
      @keyframes foxpitClimberBob { 0%,100%{ transform: translateY(0);} 50%{ transform: translateY(-2.2%);} }
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
      /* Winner pot (item 7): stake coins slide in from BOTH sides to the middle to form the
         pot, then the whole pile PUSHES to the right as a digital stack. */
      @keyframes foxpitGatherL { 0%{ transform: translate(-130px,-22px) scale(.7); opacity:0; } 45%{ opacity:1; } 100%{ transform: translate(0,0) scale(1); opacity:1; } }
      @keyframes foxpitGatherR { 0%{ transform: translate(130px,-22px) scale(.7); opacity:0; } 45%{ opacity:1; } 100%{ transform: translate(0,0) scale(1); opacity:1; } }
      @keyframes foxpitPotPush { 0%,58%{ transform: translateX(0); } 100%{ transform: translateX(64px); } }
      /* Coin drop on the winner announcement — coins fall onto the table and settle. */
      @keyframes foxpitCoinDrop {
        0%   { transform: translateY(-140%) scale(.7) rotate(0deg); opacity: 0; }
        12%  { opacity: 1; }
        70%  { transform: translateY(0) scale(1) rotate(180deg); }
        82%  { transform: translateY(-12%) scale(1) rotate(200deg); }
        100% { transform: translateY(0) scale(1) rotate(220deg); opacity: 1; }
      }
      /* The car's BOTTOM edge parks on each landing. 'top' is the car's bottom-edge
         position (the car element carries translateY(-100%)), so 'top' === the stop
         pct straight from ELEVATOR_STOPS (rules.ts). SEVEN stops: the double-height
         Coliseum has two (upper + lower). Full-height climb to STOP_1 and back.
         Ride order up: Dojo → Lobby → Coliseum(lower) → Coliseum(upper) → High Table
         → Suite → Winner's Lounge, then back down. */
      @keyframes foxpitElevatorStops {
        0%,4%    { top:${S.dojo}%; }
        9%,13%   { top:${S.lobby}%; }
        18%,22%  { top:${S.coliseumLower}%; }
        27%,31%  { top:${S.coliseumUpper}%; }
        36%,40%  { top:${S.hightable}%; }
        45%,49%  { top:${S.suite}%; }
        54%,62%  { top:${S.winners}%; }
        67%,71%  { top:${S.suite}%; }
        76%,80%  { top:${S.hightable}%; }
        84%,87%  { top:${S.coliseumUpper}%; }
        90%,92%  { top:${S.coliseumLower}%; }
        95%,97%  { top:${S.lobby}%; }
        100%     { top:${S.dojo}%; }
      }
    `}</style>
  );
}
