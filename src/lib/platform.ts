/**
 * True only inside the Capacitor native WebView, detected via the
 * `window.Capacitor` global the native runtime injects. Deliberately does NOT
 * import `@capacitor/*`, so it never pulls a native package into the web bundle
 * (same approach as notifications/native.ts).
 */
export function isNativePlatform(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean };
  }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}
