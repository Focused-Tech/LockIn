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
    `}</style>
  );
}
