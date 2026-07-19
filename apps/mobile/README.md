# YappChat Mobile (Expo) — v1

Native iOS + Android app. **v1 scope:** sign in → list of **Chats** and **Contacts** → tap a
chat (or a contact) to open/initiate the conversation and send messages. It reuses the
existing YappChat backend APIs (the deployed Next.js app) — no new backend was added.

This is the first slice of **spec 008 (Mobile Shell & App Packaging)**. It deliberately
does **not** yet include: push notifications (spec 009), video calls, secure key storage,
deep linking, force-upgrade gate, or the device registry — those are later 008 slices.

## Stack

- **Expo** (SDK 52) + React Native 0.76, TypeScript (strict)
- **React Navigation** — native-stack + bottom-tabs
- Talks to the backend over `fetch` against `expo.extra.apiBaseUrl` (default
  `https://www.yappchatt.com`)

## Run it

```bash
cd apps/mobile
npm install            # already done once; re-run after pulling
npx expo install --fix # align native dep versions to the installed Expo SDK (recommended)
npx expo start         # opens the dev server; scan the QR with Expo Go, or press i / a
```

- **Expo Go** is enough for v1 (no custom native modules yet). Later 008 slices that add
  LiveKit / secure-store / push will require a **custom dev client** (`eas build --profile
  development`) instead of Expo Go — see spec 008 FR-001.
- Point at a different backend (e.g. local `http://<your-LAN-ip>:5175`) by editing
  `app.json → expo.extra.apiBaseUrl`. Use your machine's LAN IP, not `localhost`
  (the phone can't reach the laptop's `localhost`).

## Structure

```
App.tsx                     Navigation + auth gate (Login ↔ Tabs)
src/api/client.ts           fetch wrapper + typed endpoint helpers (auth/chats/contacts/messages)
src/auth/AuthContext.tsx    session state; bootstraps from GET /api/auth/me
src/navigation/types.ts     typed route params
src/screens/LoginScreen     email + password → POST /api/auth/login
src/screens/ChatsScreen     GET /api/chats → tap opens Chat
src/screens/ContactsScreen  GET /api/contacts → tap opens/creates the DM
src/screens/ChatScreen      GET/POST /api/engine/conversations/:id/messages (polls every 8s)
src/components/*            small shared UI (list rows, avatar, sign-out)
```

## Auth — bearer token + SSO (implemented)

- **Email + password** → `POST /api/auth/mobile/login` returns `{ user, org, token }`. The
  opaque session **token is stored in `expo-secure-store`** and sent as
  `Authorization: Bearer <token>` on every request. The backend accepts that header on all
  authenticated routes (`readSessionToken` in the web app). No cookie reliance.
- **SSO (Google + Microsoft)** → the app opens `/api/auth/sso/<provider>?mode=mobile` in an
  in-app auth browser; the backend completes the round-trip and redirects to
  `yappchat://auth?token=…`, which the app captures and stores. Errors come back as
  `yappchat://auth?error=…`.

> ⚠️ These use **backend changes that must be deployed to prod** before the mobile app can
> authenticate: the new `/api/auth/mobile/login` route, `Authorization: Bearer` support in
> session resolution, and the `mode=mobile` SSO deep-link. They're committed alongside this
> app but **not yet deployed**.

## ⚠️ Still needs Andy (accounts + confirmations)

1. **EAS account + identifiers (was Q3).** To build real device binaries we need an Expo/EAS
   account + Apple Developer ($99/yr) + Google Play ($25 one-time), and confirmation of the
   bundle id `com.wxperts.yappchat` (assumed for both platforms). Who owns these?
2. **SSO redirect URIs.** For mobile SSO to work with the providers, register the app's
   deep-link callback with each provider (Google Cloud console / Azure AD). The web callback
   `{SITE_URL}/api/auth/sso/<provider>/callback` is unchanged (the provider still calls the
   web); the app never talks to the provider directly, so **no new provider redirect URI is
   strictly required** — but confirm the existing Google/Microsoft SSO apps are live in prod.
3. **Deploy the backend auth changes** to prod (see the ⚠️ above) so the app can sign in.
4. **Realtime (was Q5).** v1 uses 8-second polling. Wiring the WebSocket engine
   (`ws.wxperts.com`, spec 003) for live delivery is a fast-follow.

## Status

- ✅ `npm run typecheck` (tsc, strict) passes.
- ⏳ **Not yet run on a device** — needs `npx expo start` + a phone/simulator, and the auth
  decision above confirmed. Build is structurally complete and compiles; runtime behaviour
  against prod is unverified.
