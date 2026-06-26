/**
 * Brand padlock mark, composed from divs so it renders via `next/og`
 * (ImageResponse / satori) for PWA icons and the native splash screen.
 * Cayenne lock on the #0A0D12 background.
 */
export function PadlockMark({
  size,
  padding = 0,
}: {
  size: number;
  padding?: number;
}) {
  const s = size - padding * 2;
  const stroke = s * 0.09;

  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0A0D12",
      }}
    >
      <div
        style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
      >
        {/* Shackle (open-bottom arch) */}
        <div
          style={{
            width: s * 0.42,
            height: s * 0.3,
            borderStyle: "solid",
            borderColor: "#FF3B00",
            borderTopWidth: stroke,
            borderLeftWidth: stroke,
            borderRightWidth: stroke,
            borderBottomWidth: 0,
            borderTopLeftRadius: s * 0.25,
            borderTopRightRadius: s * 0.25,
            marginBottom: -stroke,
          }}
        />
        {/* Body */}
        <div
          style={{
            width: s * 0.6,
            height: s * 0.42,
            backgroundColor: "#FF3B00",
            borderRadius: s * 0.09,
          }}
        />
      </div>
    </div>
  );
}
