# LockIn — build & release

LockIn is a Next.js app wrapped by **Capacitor**. The native shells (Android now, iOS later) load
the **live hosted site** (`server.url` in `capacitor.config.ts`), so a **Vercel production deploy IS
the over-the-air update** — a tester installs the app once and then receives every web change
automatically. A new native build is only required when **native config** changes (a permission, the
splash, the app version for a store).

## Web (the OTA)

```bash
npm run build          # production build
npx vercel --prod --yes   # deploy → advances the lockin-three-zeta alias the app loads
```

## Android

Prereqs: Android Studio (its bundled JDK) + the Android SDK. `android/local.properties` must point at
the SDK (`sdk.dir=...`).

**Debug APK — sideload to a phone (no signing needed):**

```bash
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk  (~12 MB)
```

Share that file with testers (Drive/email/link) or push it to **Firebase App Distribution**; they
install it directly. No Play Store review required.

**Release AAB — for the Play Store (needs signing):**

1. Create a release keystore (once — back it up; losing it means you can never update the app under
   the same identity):
   ```bash
   keytool -genkey -v -keystore lockin-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias lockin
   ```
2. Copy `android/keystore.properties.example` → `android/keystore.properties` and fill in the four
   values (this file is **git-ignored** — never commit it). CI alternative: set `LOCKIN_KEYSTORE_FILE`,
   `LOCKIN_KEYSTORE_PASSWORD`, `LOCKIN_KEY_ALIAS`, `LOCKIN_KEY_PASSWORD`.
3. Build the signed bundle:
   ```bash
   cd android && ./gradlew bundleRelease
   # → android/app/build/outputs/bundle/release/app-release.aab
   ```

`android/app/build.gradle` reads the signing config from `keystore.properties` (or the env vars) and
applies it to the `release` build type only when the credentials are present; otherwise `release`
stays unsigned and only the debug APK is usable.

## iOS

**Not yet buildable.** The `ios/` folder is a stub — there is no Xcode project, workspace, Podfile, or
`Info.plist`. To create it (on a Mac):

```bash
npx cap add ios
npx cap sync ios
npx cap open ios     # opens Xcode; set the team + signing there
```

The intended bundle id is `gg.lockin.app`. iOS distribution requires an Apple Developer account and
goes through **TestFlight** (Apple does not allow sideloading). When the project exists, add
`NSMicrophoneUsageDescription` to `Info.plist` for the Locksmith microphone.
