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
      /* NOTE: foxpitElevatorStops lives in map/Map.tsx — it is GENERATED from the
         canonical landing coords (FOXPIT_ROOMS[].mapY + LOBBY_MAP_Y) so the car can
         never drift off the plaques the way a hand-written keyframe list did. */
    `}</style>
  );
}
