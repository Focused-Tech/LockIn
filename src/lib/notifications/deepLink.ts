/**
 * Deep-link URL → in-app route mapping. Pure and dependency-free so it can be
 * unit-tested and reused without importing the native bridge.
 *
 * Custom scheme (registered in android/app/src/main/AndroidManifest.xml):
 *   lockin://slate/<slateId>  -> /app/slate/<slateId>
 *   lockin://beginner         -> /app/beginner
 *   lockin://<path...>        -> /app/<path...>        (generic fallback)
 *
 * https universal/app link (the public share landing):
 *   https://<host>/s/<slateId> -> /app/slate/<slateId>
 *   https://<host>/<path>      -> /<path>              (pass-through)
 *
 * Returns null when the URL can't be parsed.
 */
export function deepLinkToInAppPath(rawUrl: string): string | null {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return null; // malformed url
  }

  if (u.protocol === "lockin:") {
    // For `lockin://slate/<id>` the WHATWG parser puts "slate" in `hostname`
    // and "/<id>" in `pathname` — recombine into clean path segments.
    const segments = `${u.hostname}${u.pathname}`.split("/").filter(Boolean);
    if (segments[0] === "slate" && segments[1]) {
      return `/app/slate/${segments[1]}`;
    }
    return segments.length ? `/app/${segments.join("/")}` : "/app";
  }

  // https app/universal link: the `/s/<slateId>` share landing opens the
  // in-app slate screen; anything else passes through as its own path.
  const parts = u.pathname.split("/").filter(Boolean);
  if (parts[0] === "s" && parts[1]) {
    return `/app/slate/${parts[1]}`;
  }
  return u.pathname + u.search;
}
