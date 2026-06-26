"use client";

import { storeDeviceToken } from "./tokenActions";
import { deepLinkToInAppPath } from "./deepLink";

export { deepLinkToInAppPath };

/**
 * True only inside the Capacitor native webview. We detect this via the
 * `window.Capacitor` global that the native runtime injects, deliberately
 * WITHOUT importing `@capacitor/core` — so the web/dev bundle never pulls in
 * any `@capacitor/*` package. (Eagerly importing the native plugin packages
 * into this "use client" module put them in the web client chunk graph as
 * `vendor-chunks/@capacitor.js`, which failed to load in the browser and
 * cascaded into a "Cannot read properties of undefined (reading 'call')"
 * runtime error across every /app route.)
 *
 * The actual plugin packages are loaded lazily, only after this guard passes,
 * so they exist solely in the APK webview where the bridge is present.
 */
function isNativeRuntime(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean };
  }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

/**
 * Master switch for native push. Push is DEFERRED until FCM is configured, so
 * this is OFF by default. While off, {@link initPush} returns before it ever
 * touches the native PushNotifications plugin.
 *
 * WHY: on Android, `PushNotifications.register()` calls
 * `FirebaseMessaging.getInstance()`, which throws
 * `IllegalStateException: Default FirebaseApp is not initialized` and crashes
 * the whole process when `android/app/google-services.json` is absent (the
 * `com.google.gms.google-services` Gradle plugin never applies, so no default
 * FirebaseApp exists). The crash hit on the first authenticated screen because
 * NativeBridge mounts there and calls initPush().
 *
 * TO ENABLE PUSH LATER (the on-switch):
 *   1. Add `android/app/google-services.json` (and iOS APNs config).
 *   2. Set `NEXT_PUBLIC_PUSH_ENABLED=true` (or flip the default below to true).
 */
export const PUSH_ENABLED = process.env.NEXT_PUBLIC_PUSH_ENABLED === "true";

/**
 * Register for push on the native app: request permission, get the FCM/APNs
 * token, persist it on the user doc, and route taps to their deep link. No-ops
 * on web (the PWA path). Safe to call once on mount.
 */
export async function initPush(): Promise<void> {
  if (!PUSH_ENABLED) {
    // Visible, greppable disabled-state marker (no silent failure). Surfaces in
    // Android logcat under the `chromium` CONSOLE tag from the WebView.
    console.info("[push] disabled — FCM not configured");
    return;
  }
  if (!isNativeRuntime()) return;
  const { PushNotifications } = await import("@capacitor/push-notifications");

  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === "prompt") {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== "granted") return;

  await PushNotifications.addListener("registration", (token) => {
    void storeDeviceToken(token.value);
  });
  await PushNotifications.addListener(
    "pushNotificationActionPerformed",
    (action) => {
      const link = action.notification.data?.link as string | undefined;
      if (link) window.location.assign(link);
    },
  );
  await PushNotifications.register();
}

// A deep link that cold-starts the app is delivered once via getLaunchUrl();
// guard so it's consumed a single time per process (NativeBridge can remount).
let launchUrlConsumed = false;

/**
 * Handle deep links opened into the native app — both the custom `lockin://`
 * scheme and https app links — by routing to the in-app path. Covers a warm app
 * (appUrlOpen) and a cold start (getLaunchUrl). No-ops on web.
 */
export async function initDeepLinks(
  navigate: (path: string) => void,
): Promise<void> {
  if (!isNativeRuntime()) return;
  const { App } = await import("@capacitor/app");

  const route = (rawUrl: string, source: string) => {
    const path = deepLinkToInAppPath(rawUrl);
    // Greppable in Android logcat under the `chromium` CONSOLE tag (WebView).
    console.info(`[deeplink] ${source} url=${rawUrl} -> path=${path ?? "(none)"}`);
    if (path) navigate(path);
  };

  // Warm app: an incoming VIEW intent (e.g. lockin://slate/<id>) fires this.
  await App.addListener("appUrlOpen", (event) => route(event.url, "appUrlOpen"));

  // Cold start: the launch intent's URL isn't replayed through appUrlOpen.
  if (!launchUrlConsumed) {
    launchUrlConsumed = true;
    try {
      const launch = await App.getLaunchUrl();
      if (launch?.url) route(launch.url, "launchUrl");
    } catch {
      /* no launch url */
    }
  }
}
