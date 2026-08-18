import "server-only";

/**
 * STORE COMPLIANCE STRIP — server-side "is this the native app" signal.
 *
 * The Capacitor app loads the SAME origin as the website (`capacitor.config.ts` `server.url`), so the
 * server has no other way to tell the app's WebView apart from a browser hitting the same URL. Capacitor
 * appends this marker to the WebView's User-Agent (`capacitor.config.ts` `appendUserAgent`) on both
 * platforms. A missing/spoofed header fails OPEN on the website (never blocks a real browser) and fails
 * CLOSED on the compliance gates below (a request that can't prove it's the website is treated as cash
 * entertainment-blocked wherever that gate applies) — see submitEntry / fetchSlate / fetchFeedSlates.
 */
export const MOBILE_APP_UA_MARKER = "LockInNativeApp";

export function isMobileClientUA(userAgent: string | null | undefined): boolean {
  return !!userAgent && userAgent.includes(MOBILE_APP_UA_MARKER);
}
