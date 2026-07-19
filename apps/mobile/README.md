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

## ⚠️ Open questions for the morning (need Andy's call)

1. **Auth transport — the big one.** The backend uses an **HttpOnly session cookie**
   (`POST /api/auth/login` sets it; no token is returned in the body). This app relies on
   React Native's native cookie jar to carry that cookie on subsequent requests to the same
   host. That *usually* works but is not guaranteed across iOS/Android/OTA, and cookie
   attributes (`Secure`, `SameSite`) can bite.
   **Recommended:** add a small **mobile token endpoint** (e.g. `POST /api/auth/login`
   returning the session token, or a dedicated `/api/mobile/session`) and store it in
   `expo-secure-store`, then send `Authorization: Bearer <token>`. This is a ~1-file change
   in `src/api/client.ts` plus a backend endpoint. **Do we add the token endpoint, or ship
   cookie-based for v1?**
2. **SSO logins (Google/Microsoft).** v1 login is email+password only. Do you want SSO in
   the mobile v1 (needs an in-app browser / `expo-auth-session` redirect flow), or is
   email+password enough to start?
3. **EAS account + identifiers.** To build real device binaries we need an Expo/EAS account,
   Apple Developer + Google Play accounts, and confirmation of the bundle ids
   (`com.wxperts.yappchat` assumed for both). Who owns these?
4. **Backend base URL.** Assumed prod `https://www.yappchatt.com`. Correct? Any staging URL
   you'd rather test against first?
5. **Realtime.** v1 uses 8-second polling for new messages (simple + reliable). Wiring the
   WebSocket engine (`ws.wxperts.com`, spec 003) for live delivery is a fast-follow — want it
   in v1 or next?

## Status

- ✅ `npm run typecheck` (tsc, strict) passes.
- ⏳ **Not yet run on a device** — needs `npx expo start` + a phone/simulator, and the auth
  decision above confirmed. Build is structurally complete and compiles; runtime behaviour
  against prod is unverified.
