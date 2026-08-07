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

The Xcode project now **exists** (`ios/App/App.xcodeproj`). Capacitor 8 uses **Swift Package Manager**,
not CocoaPods — there is no Podfile. Already wired (cross-platform):

- bundle id `gg.lockin.app`, deployment target **iOS 15.0**, marketing version **2.5.2**
- `NSMicrophoneUsageDescription` for the Locksmith mic; portrait-locked to match Android
- branded app icon + splash generated from `assets/` (`LaunchScreen` shows the **splash**, not the icon)

Everything below **requires a Mac with Xcode + an Apple Developer Program membership** — none of it can
run on Windows, and Apple does not allow sideloading (TestFlight is the only tester path).

### Build & push to TestFlight (on a Mac)

```bash
npx cap sync ios         # copy web assets + resolve the SPM plugins
npx cap open ios         # opens App.xcodeproj in Xcode
```

Then, in Xcode:
1. **Signing & Capabilities** → pick your **Team**; let Xcode auto-manage signing for `gg.lockin.app`.
2. Register the App ID `gg.lockin.app` in the Apple Developer portal and create the app record in
   **App Store Connect**.
3. If push ships: add the **Push Notifications** capability + **Background Modes → Remote notifications**,
   and upload the APNs key/`GoogleService-Info.plist` for FCM. (Otherwise omit — an unused entitlement
   is a rejection risk.)
4. Bump the build number (`CURRENT_PROJECT_VERSION`) — must increase on every upload.
5. **Product → Archive → Distribute App → TestFlight & App Store Connect → Upload**.
6. In App Store Connect → **TestFlight**, add internal/external testers.

Because the shell loads the live site, once a tester is on any TestFlight build they receive every
**web** change automatically; a new TestFlight build is only needed for **native** changes.
