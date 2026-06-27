import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor wrapper config. The app is server-rendered (server actions, dynamic
 * routes), so the native shells load the hosted site via `server.url` rather than
 * a static export. Set CAP_SERVER_URL to point at staging/prod.
 *
 * After `npm install`: `npx cap add ios` / `npx cap add android`, then
 * `npx cap sync`. Generate native icons + splash from the brand padlock with
 * `npx @capacitor/assets generate` (source: the /icon-512 output).
 */
const config: CapacitorConfig = {
  appId: "gg.lockin.app",
  appName: "LockIn",
  webDir: "public",
  server: {
    url: process.env.CAP_SERVER_URL ?? "https://lockin-three-zeta.vercel.app",
    androidScheme: "https",
  },
  plugins: {
    FirebaseAuthentication: {
      // We hold the session in the JS SDK (signInWithCredential), so the plugin
      // only needs to return the provider credential — not sign in natively.
      skipNativeAuth: true,
      providers: ["google.com"],
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    SplashScreen: {
      backgroundColor: "#0A0D12",
      launchAutoHide: true,
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
    },
  },
};

export default config;
