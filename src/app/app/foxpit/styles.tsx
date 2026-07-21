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
      /* the elevator car dwells at each floor's LANDING (floor level, not room centre):
         Dojo 95 → Lobby 81 → Coliseum 65 → High Table 32 → Suite 14, then back down.
         Reaches true top + bottom so the stops can be verified floor-for-floor. */
      @keyframes foxpitElevatorStops {
        0%,5%    { top:100%; }
        11%,16%  { top:90%; }
        22%,29%  { top:71%; }
        35%,40%  { top:32%; }
        46%,54%  { top:14%; }
        60%,65%  { top:32%; }
        71%,78%  { top:71%; }
        84%,89%  { top:90%; }
        95%,100% { top:100%; }
      }
    `}</style>
  );
}
