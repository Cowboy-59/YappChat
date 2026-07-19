# Building & distributing YappChat Mobile

How to turn this Expo project into installable apps for members. `eas.json` (build
profiles) and npm scripts are already set up — you just need the accounts below.

## Accounts you need (one-time)

| For | Account | Cost |
| --- | --- | --- |
| Any EAS build / OTA update | **Expo** account (expo.dev) | Free |
| iOS TestFlight / App Store | **Apple Developer Program** | $99 / year |
| Android Play (internal test / store) | **Google Play Developer** | $25 once |
| Android **sideload APK** (fastest) | — (none) | Free |

Bundle id is `com.wxperts.yappchat` (iOS + Android) — set in `app.json`.

## First-time setup

```bash
cd apps/mobile
npm install -g eas-cli
eas login                 # sign in to your Expo account
eas init                  # links this app to an Expo project; writes extra.eas.projectId into app.json
```

`eas init` will prompt to create the project — accept. Commit the `projectId` it adds.

## Fastest path: Android APK for members (no store, no Google account)

```bash
npm run build:apk         # == eas build --profile preview --platform android
```

- Builds in the cloud (~10–15 min). When done, EAS prints a **build page URL** with a
  **Download** button for the `.apk`.
- Share that link (or the downloaded `.apk`) with members. On their Android phone they
  open it, allow **"Install unknown apps"** for their browser/files app, and install.
- Local notifications and Google/Microsoft **SSO work in this build** (unlike Expo Go).

## iOS testers: TestFlight (needs Apple Developer)

```bash
npm run build:ios         # eas build --profile production --platform ios
npm run submit:ios        # eas submit --profile production --platform ios  → App Store Connect / TestFlight
```

EAS manages the signing certificate + provisioning profile for you (it prompts on first
build). Add testers by email in App Store Connect → TestFlight. First review can take a
few days; TestFlight builds after that clear in ~24h.

## Android testers: Play internal testing (needs Google Play)

```bash
npm run build:android     # eas build --profile production --platform android  → .aab
npm run submit:android    # eas submit --profile production --platform android → Play Console
```

Add testers in Play Console → Internal testing → testers list; share the opt-in link.

## OTA updates (JS-only changes, no rebuild)

After a build is installed, pure-JS fixes ship without another store/APK cycle:

```bash
npx eas update --branch preview --message "fix: …"    # matches the preview build channel
```

Native changes (new native module, SDK bump, icon) still need a fresh `eas build`.

## Notes / gotchas

- **App icon / splash:** none set yet → the build uses Expo's default placeholder. Add
  `icon` + `splash` in `app.json` before a public/store build (fine for internal testing).
- **SSO redirect:** the app returns from SSO via the `yappchat://auth` deep link — this
  works in real builds (the `scheme` is set in `app.json`). It does **not** complete in
  Expo Go.
- **Push when the app is closed:** not in these builds. Local (foreground) notifications
  work; true background/closed push needs FCM/APNs credentials + server push (spec 009).
- **Backend:** the app talks to `https://www.yappchatt.com` (see `app.json → extra.apiBaseUrl`).
  The mobile auth endpoints it needs are already deployed to prod.
- **Versioning:** `eas.json` uses `appVersionSource: local` — the app version comes from
  `app.json → expo.version`; the `production` profile auto-increments the build number.
