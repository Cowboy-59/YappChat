# Spec 010: E2E Key Backup & Recovery

**Spec Number**: 010
**Status**: `draft`
**Created**: 2026-05-10
**Depends On**: Spec 001 (Chat Engine — `userencryptionkeys`, E2E rules), Spec 003 (WebSocket Engine — pairing channel), Spec 008 (Mobile Shell — `SecureKeyStore`, `mobiledevices`)
**Source**: `specs/Project-Scope/010-e2e-key-backup-and-recovery.md`

---

## Overview

Spec 001 mandates end-to-end encryption for every YappChat-to-YappChat message and warns that "if a user loses their private key (clears browser storage, loses device), they cannot decrypt historical E2E messages." This spec closes that gap.

**The problem**: E2E privacy is only valuable if users can actually live with it. The first time a user replaces their phone, clears Safari data, or factory-resets a laptop, all their YappChat history becomes ciphertext they can never decrypt. Without recovery, E2E is a footgun.

**The approach**: a two-track recovery model.

1. **Cross-device handoff** (the everyday case) — when a user adds a second device while still owning their first, the existing device transfers the key bundle to the new device directly over an authenticated, server-relayed channel. The server only sees ciphertext.
2. **Encrypted backup with passphrase** (the disaster case) — the user encrypts their key bundle with a key derived from a passphrase or a generated recovery code (24-word BIP-39-style mnemonic). The ciphertext blob is stored on the server. If the user loses all devices, they can re-derive the key from the passphrase and decrypt their history.

The server NEVER sees the plaintext private keys, the passphrase, or the recovery code. All key derivation and decryption happens client-side. The server stores opaque blobs and enforces rate limits to prevent online brute-force attacks. The server cannot perform offline brute-force because it never holds plaintext.

This spec also covers group session keys (the sender keys used for group messaging) so a recovered user can read historical group conversations they were part of, not just 1-on-1 messages.

---

## Core Design

| Element | Value |
| --- | --- |
| **Primary Actor** | YappChat user — adding a device, recovering after loss, or proactively setting up backup |
| **Secondary Actors** | Existing trusted devices (handoff source), passphrase / recovery code (the user's possession factor) |
| **Key Value** | E2E privacy without the user-hostile cliff. Users can replace devices, clear browsers, and factory-reset phones without losing their YappChat history. Recovery is offline-attack-proof: only the user with the passphrase can decrypt the backup. |
| **Scope Boundary** | IN SCOPE: encrypted key backup envelope format; passphrase-based key derivation (Argon2id); 24-word recovery code generation; cross-device handoff via QR-code-initiated authenticated channel; group session key inclusion; anti-bruteforce rate limiting; recovery UI flow; passphrase rotation; printable recovery code one-time display; lost-passphrase contingency policy. OUT OF SCOPE: identity verification across devices that don't share a key (would require auth spec — separate); social/Shamir-style multi-party recovery (deferred); HSM-based server-side key escrow (deliberately rejected — undermines E2E); push-notification-driven new-device approval (deferred); deletion of backups (covered by user retention policy in spec 001). |

---

## User Scenarios & Testing

### US1 — User sets up a backup on first launch

**Actor**: YappChat user (first-time)

**Scenario**:

1. After signing in for the first time on a fresh device, the shell generates the X25519 identity keypair (spec 001 FR-011) and stores the private key in `SecureKeyStore` (spec 008 FR-004 / web IndexedDB).
2. A `KeyBackupOnboarding` modal appears: "Set up recovery so you don't lose your messages if you lose this device."
3. User chooses **Generate recovery code** (recommended) or **Set a passphrase**.
4. **Recovery code path**: client generates 24 words from a BIP-39 wordlist (256 bits of entropy). Words are displayed once on a `RecoveryCodeReveal` screen. User must type 4 random words back into a confirmation grid before the code is accepted as "memorised". A printable PDF download is offered.
5. **Passphrase path**: user types a passphrase (≥ 12 characters, zxcvbn score ≥ 3 enforced client-side). Re-typed for confirmation. A warning notes "If you forget this, your history cannot be recovered."
6. Client derives a 32-byte symmetric key from the chosen secret using Argon2id (memory: 64MB, iterations: 3, parallelism: 1). Encrypts the user's key bundle (identity private key + any existing group session keys) with XChaCha20-Poly1305. Posts the ciphertext blob to `POST /api/keybackup`.
7. Server stores the blob. Server learns nothing about the key, passphrase, or message history.

**Expected outcome**: backup setup completes within 2 minutes including the user typing/printing their recovery code. Onboarding flow is skippable but reminds the user every 7 days until completed.

### US2 — User adds their phone while their laptop is still working

**Actor**: YappChat user (cross-device handoff)

**Scenario**:

1. User installs the YappChat iOS app from spec 008. After auth, the shell detects no E2E key on the device and prompts: "Bring across your existing key, or set up a fresh one?"
2. User chooses **Bring across**. The phone displays a QR code containing an ephemeral X25519 public key, a server-issued pairing nonce, and the WS scope path the laptop should publish to.
3. On the laptop, user opens YappChat → settings → Devices → **Pair a new device**, points the camera at the QR code (or types the 8-digit fallback code).
4. The laptop validates the pairing nonce with the server, derives a shared secret using the phone's ephemeral public key + its own ephemeral private key (X25519), and encrypts the key bundle with that shared secret using XChaCha20-Poly1305.
5. The laptop publishes the ciphertext over a one-time WS channel scoped to the pairing nonce. The phone is subscribed to that scope (FR-005).
6. The phone receives the ciphertext, decrypts it with its half of the shared secret, writes the keys into `SecureKeyStore`, and registers a new device entry in `userencryptionkeys` (spec 001 FR-011) — as a NEW device, not a copy.
7. The laptop signs a "trust" certificate over the new device's public key and posts it to the server. Other YappChat clients querying `userencryptionkeys` see the new device as trusted because it was vouched for by an existing trusted device.

**Expected outcome**: end-to-end pairing completes within 30 seconds. The phone can immediately read all historical 1-on-1 and group messages addressed to the user.

### US3 — User lost their phone, has the recovery code

**Actor**: YappChat user (disaster recovery)

**Scenario**:

1. User installs YappChat on a new phone. After auth, the shell finds no key on the device and no other trusted device exists (the lost phone is the only one). The prompt: "Recover from a backup — you'll need your recovery code or passphrase."
2. User chooses **Recover with code**. They enter their 24 words.
3. Client calls `POST /api/keybackup/begin-recovery` to fetch the encrypted blob. Server returns the blob and increments a `keyrecoveryattempts` counter for that user.
4. Client derives the key from the 24 words via Argon2id (same parameters as backup) and attempts to decrypt the blob. Decryption succeeds.
5. Client extracts the identity private key + group session keys, writes them to `SecureKeyStore`, and registers the new device in `userencryptionkeys`.
6. Server is informed of the successful recovery via `POST /api/keybackup/recovery-succeeded` (which does NOT carry any key material — just an authenticated "I'm in" signal). Server resets the attempt counter.

**Expected outcome**: full recovery within 1 minute. The new device can decrypt all historical messages encrypted to the user's identity key. Group conversations from before the loss are also readable.

### US4 — Attacker tries to brute-force a passphrase

**Actor**: Attacker (not the legitimate user)

**Scenario**:

1. Attacker compromises the user's auth credentials (out-of-scope for this spec — assumed possible). They install YappChat and try to recover.
2. They guess a passphrase. Wrong. `keyrecoveryattempts` ticks to 1.
3. They guess again. Wrong. Counter is 2.
4. After 5 wrong attempts within 24 hours, the server returns HTTP 429 with `{ error: "recovery_locked", retryafterseconds: 86400 }` and refuses to serve the backup blob for 24 hours.
5. The PA channel of the legitimate user receives a notification: "Someone tried 5 incorrect recovery attempts on your account. If this wasn't you, change your auth credentials."
6. After 24 hours, the lockout expires and 5 more attempts are allowed. With Argon2id + 256-bit entropy recovery codes, even unlimited online attempts are computationally infeasible — the rate limit is defence-in-depth.

**Expected outcome**: brute force is impossible online (server rate limit) and infeasible offline (server never holds plaintext). The user is alerted to attempts. Legitimate users with the correct code are unaffected.

### US5 — User wants to rotate their passphrase

**Actor**: YappChat user

**Scenario**:

1. User opens settings → Recovery → **Change passphrase or recovery code**.
2. They enter their current passphrase (verified by trying to decrypt the existing blob client-side — never sent to server).
3. They choose a new passphrase or generate a new recovery code.
4. Client re-encrypts the key bundle with the new derived key and posts the new blob to `POST /api/keybackup` (replaces the existing one).
5. Old blob is overwritten. The old passphrase no longer works.

**Expected outcome**: passphrase rotation completes in under 30 seconds. The user's actual identity keys are unchanged — only the wrapper key changed.

### US6 — User forgets passphrase, has no other device

**Actor**: YappChat user (worst case)

**Scenario**:

1. User installs YappChat on a new device after losing all old devices, attempts recovery, but cannot remember the passphrase or recovery code.
2. After several failed attempts, they click **I can't recover** in the recovery UI.
3. The shell shows an honest dialog: "Without your passphrase or recovery code, your message history cannot be decrypted. You can start a fresh identity — new keys, no history. Existing contacts will see this as a new identity until they re-trust it."
4. User confirms. Client generates a fresh keypair, registers it as a new device with no trust certificate (other devices will warn contacts the next time they message), and the user's old encrypted history remains on the server but is permanently inaccessible.

**Expected outcome**: the failure mode is honest and irreversible — never silently "recovers" with a fake key. The user understands what they're trading away.

---

## Functional Requirements

### FR-001 — Backup envelope format

Every backup is a single opaque blob the server stores verbatim. The format is fixed and versioned so future migrations are clean.

**Blob structure** (all binary, base64-encoded for storage):

```
[1 byte version]    // currently 0x01
[16 bytes salt]     // random per backup, used in Argon2id
[8 bytes argon2 cost params: memory_kib (4 bytes) + iterations (2 bytes) + parallelism (2 bytes)]
[24 bytes nonce]    // XChaCha20-Poly1305 nonce
[N bytes ciphertext + 16 byte Poly1305 tag]
```

The plaintext payload (encrypted as the ciphertext) is JSON:

```json
{
  "version": 1,
  "userid": "...",
  "createdat": "2026-05-10T18:00:00Z",
  "identitykeys": [
    { "deviceid": "...", "privatekey": "<base64>", "publickey": "<base64>", "createdat": "..." }
  ],
  "groupsessionkeys": [
    { "groupid": "...", "key": "<base64>", "rotation": 7 }
  ]
}
```

**Acceptance Criteria**:

- [ ] The blob is binary; base64 encoding is used only for transport. Storage may be raw bytes
- [ ] Version byte 0x01 is the current format. The blob parser MUST refuse unknown versions and emit a clear error so future migrations are detectable
- [ ] Argon2id parameters are stored IN the blob — not assumed — so the same blob remains decryptable even if defaults change in a later version
- [ ] All identity keys for the user (one per device that the user has registered) are included so a recovered device can decrypt messages encrypted to any of their historical keys
- [ ] All group session keys the user knows are included so historical group messages remain decryptable
- [ ] The plaintext payload includes `userid` so a decryption that succeeds against a blob from a different user is detectably wrong (defence against blob-swapping at the storage layer)
- [ ] No metadata about message content, channel names, or contacts is included in the blob. The blob is purely about cryptographic key material

### FR-002 — Passphrase / recovery code generation

The user picks ONE of two recovery secrets at backup time. The two paths produce equivalent security only if the passphrase has high entropy; the recovery code path is therefore the recommended default.

**Acceptance Criteria**:

- [ ] Recovery code: 24 words from the BIP-39 English wordlist (2048 words → 11 bits per word → 264 bits of entropy, of which 256 are key material and 8 are checksum). Generated using `crypto.getRandomValues` (Web Crypto) — never `Math.random`
- [ ] Passphrase path: minimum 12 characters; client computes `zxcvbn` score and rejects scores below 3 with a strength meter showing why. The server is not involved in strength validation
- [ ] Passphrase path shows a clear warning: "If you forget this, your history cannot be recovered. We recommend the recovery code instead."
- [ ] Recovery code: shown ONCE on a dedicated `RecoveryCodeReveal` screen. The screen blocks screenshots on mobile (`FLAG_SECURE` on Android, screen-recording detection on iOS via `UIScreen.main.isCaptured`). Web cannot block screenshots; instead the screen warns "Don't screenshot — write down or print"
- [ ] The user must confirm memorisation by typing 4 randomly selected words from their 24 into a `RecoveryCodeConfirmation` grid before backup is finalised. If they fail twice, they are offered the chance to print/download a PDF copy of the code
- [ ] PDF download includes: the 24 words in a readable grid, the date generated, a brief instruction on what to do with it, and a friendly reminder ("Store this where you store other important documents. YappChat cannot recover this for you")
- [ ] Both paths derive the encryption key via Argon2id with parameters: memory 64MB (`m_cost: 65536` KiB), iterations 3 (`t_cost: 3`), parallelism 1 (`p_cost: 1`). Output: 32 bytes
- [ ] Argon2id is implemented client-side via `argon2-browser` (web) and `react-native-argon2` (mobile, via Expo plugin). Both are well-audited libraries

### FR-003 — Backup upload and storage

The server stores backup blobs and tracks attempts. It NEVER sees plaintext.

**Acceptance Criteria**:

- [ ] `POST /api/keybackup` body `{ blob: "<base64>", clientversion }` — replaces the user's existing backup blob. One blob per user (latest wins). Returns `{ acknowledgedat, blobsizebytes }`
- [ ] Maximum blob size: 1MB. Larger blobs return HTTP 413. In practice blobs are < 16KB (a few keys + a few thousand group session keys); the cap is a safety rail
- [ ] `GET /api/keybackup/exists` — returns `{ exists: boolean, lastbackupat?, blobsizebytes? }` so the UI can show "you have a backup from May 9". Does NOT return the blob
- [ ] `DELETE /api/keybackup` — removes the user's backup. The user MUST acknowledge a confirmation dialog ("If you delete this and lose your devices, your messages cannot be recovered"). Used when the user wants to disable backup or has migrated to a key-management service
- [ ] Backup blobs are stored in PostgreSQL (`userkeybackups`), NOT in object storage. The blob is small and the access pattern is rare
- [ ] Server logs every read and write of backup blobs in `keybackupauditlog` (FR-006) — userid, action, ip, useragent, timestamp. The audit log is retained 90 days

### FR-004 — Recovery flow with rate limiting

The recovery flow protects against online brute force and alerts the legitimate user when attempts happen.

**Acceptance Criteria**:

- [ ] `POST /api/keybackup/begin-recovery` body `{}` — returns the user's backup blob. Increments `keyrecoveryattempts.failedcount` for that user (set to 0 on success). Returns HTTP 429 if `failedcount >= 5` within the last 24 hours, with `{ error: "recovery_locked", retryafterseconds }`
- [ ] Decryption is performed client-side. The server has no way to know whether decryption succeeded or failed UNTIL the client reports back
- [ ] `POST /api/keybackup/recovery-succeeded` body `{}` — authenticated call from the client after successful decryption. Resets `failedcount` to 0. Server records the recovery in `keybackupauditlog`
- [ ] `POST /api/keybackup/recovery-failed` body `{}` — authenticated call from the client when a decryption attempt fails. Increments `failedcount`. The client MUST send this even when offline retries happen, so the rate limit reflects reality. (A malicious client could omit it; the server's hard rate limit on `begin-recovery` is the actual defence — the failed-call is for accuracy of telemetry.)
- [ ] After 3 failed attempts within 1 hour, the server calls spec 002 FR-017's `postPANotification` with `bypassQuietHours: true`, `callerscope: "keybackup-recovery"`, type `"keybackup_recovery_alert"`, and previewtext `"3 incorrect recovery attempts on your account. If this wasn't you, change your auth credentials."`
- [ ] After 5 failed attempts within 24 hours, recovery is locked for 24 hours. After 10 failed attempts in 7 days, recovery is locked for 7 days and a stronger PA notification is posted (same SDK, same urgency): `"Recovery locked due to repeated failures. Possible attack — review your account."`
- [ ] Lockout periods are absolute server-side decisions; clients cannot override. The user receiving a lockout has the option to wait, or to start a fresh identity (US6) which clears the backup and resets state

### FR-005 — Cross-device handoff via QR-code pairing

When a user has an existing trusted device, the everyday way to bring a new device online is direct device-to-device transfer of the key bundle. No passphrase needed; no plaintext on the server.

**Pairing protocol** (overview):

1. New device generates an ephemeral X25519 keypair `(eph_pub_new, eph_priv_new)`
2. New device requests a pairing nonce from the server: `POST /api/keybackup/pairing/start` returns `{ pairingid, nonce, wsscopepath: "pairing:{pairingid}", expiresin: 300 }`
3. New device displays a QR code encoding `{ pairingid, nonce, eph_pub_new, wsscopepath }` plus an 8-digit fallback code (HOTP-derived from `nonce`) in case the QR can't be scanned
4. Existing device scans the QR (or user types the fallback code into existing-device settings → Pair)
5. Existing device generates its own ephemeral keypair `(eph_pub_old, eph_priv_old)`, computes shared secret `K = X25519(eph_priv_old, eph_pub_new)`, derives an encryption key from `K` via HKDF-SHA256
6. Existing device encrypts the full key bundle (same JSON as FR-001 plaintext) with that derived key + a fresh nonce using XChaCha20-Poly1305
7. Existing device publishes `{ eph_pub_old, ciphertext, nonce }` to the WS scope `pairing:{pairingid}` via `POST /api/keybackup/pairing/:id/deliver`
8. New device receives the message over WS (it's subscribed to the scope), computes `K = X25519(eph_priv_new, eph_pub_old)`, derives the same key via HKDF, decrypts
9. New device writes keys to `SecureKeyStore`, generates its own NEW identity keypair, publishes the new public key to `userencryptionkeys` with `trustedby: existingdeviceid`
10. Existing device signs a trust certificate over the new device's public key and posts to `POST /api/keybackup/devicetrust`. The signature is verifiable by other YappChat clients via the existing device's public key

**Acceptance Criteria**:

- [ ] `POST /api/keybackup/pairing/start` returns `{ pairingid, nonce, wsscopepath, expiresin: 300 }`. The pairing is single-use and expires in 5 minutes
- [ ] The 8-digit fallback code is HOTP-style — derived from the nonce so the existing device can compute it without re-fetching anything. Eight digits is a balance between usability and resistance to typo guessing within the 5-minute window
- [ ] `POST /api/keybackup/pairing/:id/deliver` body `{ eph_pub_old, ciphertext, nonce }` — server forwards over WS scope `pairing:{pairingid}` to the subscribed new device. Server stores nothing — fire-and-forget. If the new device is not subscribed, the call returns HTTP 404 `{ error: "new_device_not_listening" }`
- [ ] WS subscription to `pairing:{id}` is restricted to the userid + pairing-nonce that started the flow. Spec 003's subscription authorization (FR-002) extends to recognise this scope pattern
- [ ] After successful key transfer, both devices publish updated trust state to `userencryptionkeys` and `devicetrust` tables. Other YappChat clients retrieve trust info on next message-decrypt to validate signatures
- [ ] Pairing fails gracefully if either device drops off — the new device shows a "Pairing timed out" error and offers to restart. No partial state is left on the server
- [ ] The pairing channel is end-to-end encrypted between the two devices. Server sees only ciphertext + ephemeral public keys. Even if the server is fully compromised, an attacker cannot extract the transferred key bundle from this flow

### FR-006 — Audit log

Every meaningful event in the backup / recovery / pairing flow is logged so users (and operators investigating incidents) can see what happened.

**Acceptance Criteria**:

- [ ] `keybackupauditlog` table records: `userid`, `event` (`backup_created` | `backup_replaced` | `backup_deleted` | `recovery_started` | `recovery_succeeded` | `recovery_failed` | `recovery_locked` | `pairing_started` | `pairing_completed` | `pairing_expired` | `pairing_failed`), `ipaddress`, `useragent`, `deviceid` (when known), `createdat`
- [ ] Audit log entries are retained 90 days, then deleted by a daily cleanup job
- [ ] `GET /api/keybackup/audit` returns the caller's recent audit entries (last 90 days). Used by the user-facing "Activity on your account" screen
- [ ] Audit entries are written even on failure paths (rate limit, expired pairing, etc.) so abuse patterns are observable
- [ ] `ipaddress` is anonymised before storage — last octet zeroed for IPv4, last 80 bits zeroed for IPv6 — to balance forensic value with privacy

### FR-007 — Group session key recovery

Group conversations use a session key shared among members (per spec 001 risks: "Group E2E key distribution"). When a user recovers, they need their copy of those session keys to read historical group messages.

**Acceptance Criteria**:

- [ ] When the user is added to a group OR a group session key is rotated, the user's client immediately re-encrypts and re-uploads the backup blob. This keeps the server-stored backup current
- [ ] The backup blob's `groupsessionkeys` array contains one entry per group the user is currently a member of — `groupid`, the session key value, the rotation generation, and the `effectivefromat` timestamp (the time after which messages were encrypted with this key)
- [ ] Multiple historical session keys per group are retained — when a key rotates, the OLD key is kept in the bundle until messages encrypted with it have all been purged per the user's retention policy (spec 001 FR-012)
- [ ] On recovery, the client extracts every group session key and stores them in the local key store. Historical group messages decrypt successfully with the correct generation key
- [ ] Rotation policy on backup re-upload: a debounce of 60 seconds prevents thrashing if many group operations happen at once. The blob is re-uploaded at most once per minute
- [ ] If a user has > 1000 group session keys, the blob may exceed the 1MB cap. In that case, the client prunes oldest-rotation keys from groups where the user no longer holds membership and emits a warning. Acknowledged as a capacity edge case for v1

### FR-008 — Passphrase / recovery code rotation

Users MUST be able to change their recovery secret without affecting their identity keys.

**Acceptance Criteria**:

- [ ] `KeyBackupSettings` UI offers **Change passphrase** and **Generate new recovery code** actions
- [ ] To rotate, the client requires the CURRENT secret first (validated by attempting to decrypt the existing blob locally). Server is not involved in this validation
- [ ] After validation, the client derives a new key from the new secret, re-encrypts the existing key bundle, and posts the new blob via `POST /api/keybackup`
- [ ] The old blob is overwritten — there is no version history. The old passphrase no longer works
- [ ] An audit entry `backup_replaced` is written
- [ ] The user's identity keys are NOT changed during rotation — only the wrapper key. Other YappChat clients see no change

### FR-009 — Lost-passphrase contingency: fresh identity

A user who has lost ALL devices AND lost the passphrase has no recovery path — by design. Server-side recovery would mean the server holds the plaintext. The honest answer is: start fresh.

**Acceptance Criteria**:

- [ ] After 5 failed recovery attempts (or proactively at any time during recovery), the UI offers **Start a fresh identity**. The dialog is explicit: "Your old messages will remain encrypted. They will never be readable. Your contacts will see this as a new identity."
- [ ] On confirmation, the client generates a new identity keypair, registers it in `userencryptionkeys` WITHOUT a trust certificate (since no existing device vouches for it), and deletes the user's backup blob via `DELETE /api/keybackup`
- [ ] Other YappChat clients on next message-send to this user check `userencryptionkeys` and see an untrusted new key. They surface a warning: "{name}'s security key changed. This may mean they re-installed YappChat, but it could also mean someone is impersonating them. Verify out-of-band before sending sensitive info."
- [ ] The fresh-identity flow is irreversible. Old encrypted messages remain on the server, take up storage, and will eventually be purged per the user's retention policy
- [ ] `keybackupauditlog` records the event `fresh_identity_started` so a future investigation can see what happened

### FR-010 — Backup setup nudge and reminders

Users who skip backup setup at first run MUST be reminded — politely and not too often — until they complete it.

**Acceptance Criteria**:

- [ ] If `userkeybackups` has no row for the user, a `KeyBackupReminder` banner appears in the app once every 7 days. Dismissing it sets `lastreminderdismissedat`; the next reminder is exactly 7 days later
- [ ] A user who has set up backup AND whose stored blob is older than 14 days AND who has joined ≥ 1 new group OR rotated keys since the last backup is shown a separate `KeyBackupOutOfDate` banner. The action is one click — the client re-uploads the current bundle
- [ ] Reminders are suppressed during onboarding and during active conversations to avoid being intrusive
- [ ] Users can disable reminders entirely in settings (the banner is replaced with a passive "Set up recovery" link in the settings → security screen)

---

## Data Requirements

| Table | Purpose |
| --- | --- |
| `userkeybackups` | One blob per user — opaque ciphertext, server cannot decrypt |
| `keyrecoveryattempts` | Per-user recovery-attempt counter — drives rate limiting |
| `keybackupauditlog` | Append-only event log for backup, recovery, pairing actions |
| `devicetrust` | Trust certificates linking new devices to existing trusted devices |
| `keypairings` | Live (non-expired) device pairing sessions |

### `userkeybackups`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `userid` | text | UNIQUE — one backup per user |
| `blob` | bytea | Opaque ciphertext (FR-001 envelope) |
| `blobsizebytes` | integer | Cached for `GET /api/keybackup/exists` |
| `clientversion` | text | App version that wrote the blob — informational |
| `createdat` | timestamptz | First backup ever |
| `updatedat` | timestamptz | Last replacement |

### `keyrecoveryattempts`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `userid` | text | UNIQUE |
| `failedcount` | integer | Consecutive failures within the rate-limit window |
| `lastfailedat` | timestamptz | Nullable |
| `lockeduntil` | timestamptz | Nullable — server refuses recovery until this time |
| `windowstartedat` | timestamptz | Sliding-window start; resets on success or window expiry |

### `keybackupauditlog`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `userid` | text | |
| `event` | text | See FR-006 enumeration |
| `ipaddress` | text | Anonymised — last octet (v4) or last 80 bits (v6) zeroed |
| `useragent` | text | |
| `deviceid` | text | Nullable |
| `createdat` | timestamptz | |
| `expiresat` | timestamptz | `createdat + 90 days` |

### `devicetrust`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `userid` | text | |
| `newdeviceid` | text | The device whose key is being trusted |
| `newdevicepublickey` | text | Base64 X25519 public key |
| `signingdeviceid` | text | The existing trusted device that vouched |
| `signature` | text | Base64 Ed25519 signature over `newdevicepublickey` |
| `createdat` | timestamptz | |

UNIQUE constraint on `(userid, newdeviceid)`.

### `keypairings`

Short-lived pairing sessions — purged after expiry by a per-minute cleanup job.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK — the `pairingid` |
| `userid` | text | |
| `nonce` | text | Random 16-byte challenge |
| `wsscopepath` | text | e.g., `pairing:{id}` |
| `status` | text | `"awaiting_existing"` \| `"completed"` \| `"expired"` |
| `expiresat` | timestamptz | `createdat + 5 minutes` |
| `createdat` | timestamptz | |

---

## API Routes

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/keybackup` | Upload (or replace) backup blob — body `{ blob, clientversion }` |
| GET | `/api/keybackup/exists` | `{ exists, lastbackupat?, blobsizebytes? }` — used to drive UI without leaking the blob |
| DELETE | `/api/keybackup` | Remove backup blob (irreversible) |
| POST | `/api/keybackup/begin-recovery` | Returns the encrypted blob; rate-limited |
| POST | `/api/keybackup/recovery-succeeded` | Client reports successful recovery — resets attempt counter |
| POST | `/api/keybackup/recovery-failed` | Client reports failed decryption — increments counter |
| POST | `/api/keybackup/pairing/start` | Begin a cross-device pairing — returns `{ pairingid, nonce, wsscopepath }` |
| POST | `/api/keybackup/pairing/:id/deliver` | Existing device posts encrypted bundle for forwarding to new device |
| POST | `/api/keybackup/devicetrust` | Sign a trust cert for a newly paired device |
| GET | `/api/keybackup/devicetrust` | List trust certs for the caller's devices |
| GET | `/api/keybackup/audit` | Caller's last 90 days of backup events |

---

## Frontend Components

### Onboarding & setup

| Component | Path | Description |
| --- | --- | --- |
| `KeyBackupOnboarding` | `packages/ui/src/keybackup/KeyBackupOnboarding.tsx` | Multi-step modal — explainer, choose recovery code or passphrase, confirm, store. |
| `RecoveryCodeReveal` | `packages/ui/src/keybackup/RecoveryCodeReveal.tsx` | Displays the 24 words once on a screenshot-blocked surface. Print and download buttons. |
| `RecoveryCodeConfirmation` | `packages/ui/src/keybackup/RecoveryCodeConfirmation.tsx` | Grid prompting for 4 randomly chosen words from the 24 to confirm memorisation. |
| `PassphraseSetup` | `packages/ui/src/keybackup/PassphraseSetup.tsx` | Passphrase input with `zxcvbn`-driven strength meter. |
| `KeyBackupReminder` | `packages/ui/src/keybackup/KeyBackupReminder.tsx` | Top-of-app banner — "Set up recovery so you don't lose your messages." Dismissible; reappears every 7 days. |
| `KeyBackupOutOfDate` | `packages/ui/src/keybackup/KeyBackupOutOfDate.tsx` | One-click banner when the stored blob is stale relative to current key state. |

### Recovery flow

| Component | Path | Description |
| --- | --- | --- |
| `KeyRecoveryFlow` | `packages/ui/src/keybackup/KeyRecoveryFlow.tsx` | Driven by the shell on launch when no key is present. Shows recovery method picker (recovery code vs passphrase), input grid, decryption attempt, error states (wrong code, locked, no backup). |
| `RecoveryLockedScreen` | `packages/ui/src/keybackup/RecoveryLockedScreen.tsx` | Shown when server returns 429 — explains the lock duration and the "fresh identity" alternative. |
| `FreshIdentityConfirm` | `packages/ui/src/keybackup/FreshIdentityConfirm.tsx` | Final-step modal before destroying access — explicit, irreversible. |

### Cross-device pairing

| Component | Path | Description |
| --- | --- | --- |
| `PairNewDeviceQR` | `packages/ui/src/keybackup/PairNewDeviceQR.tsx` | Shown on the new device — generates the QR + 8-digit fallback code, watches the WS for delivery. |
| `PairExistingDeviceScanner` | `packages/ui/src/keybackup/PairExistingDeviceScanner.tsx` | Shown on the existing device — camera scanner (mobile) or 8-digit-code input (web), launches the encryption + delivery flow on success. |
| `PairingProgress` | `packages/ui/src/keybackup/PairingProgress.tsx` | Both devices show a live status: "Waiting for partner device", "Encrypting", "Transferring", "Verifying", "Done". |

### Settings

| Component | Path | Description |
| --- | --- | --- |
| `KeyBackupSettings` | `packages/ui/src/keybackup/KeyBackupSettings.tsx` | Status of current backup, change passphrase / regenerate recovery code, view audit log, delete backup, disable reminders. |
| `DeviceTrustList` | `packages/ui/src/keybackup/DeviceTrustList.tsx` | Lists the caller's trusted devices with last-seen, signing relationship, and a revoke action. |
| `KeyBackupAuditView` | `packages/ui/src/keybackup/KeyBackupAuditView.tsx` | Recent backup-related events with anonymised IPs and friendly descriptions. |

---

## Success Criteria

1. A first-time user completes backup setup with a recovery code in under 2 minutes including memorisation confirmation.
2. Cross-device pairing transfers a key bundle from an existing device to a new device in under 30 seconds end-to-end.
3. A user with the correct recovery code recovers their full message history (including group conversations) in under 1 minute on a brand-new device with no other trusted device available.
4. The server CANNOT decrypt any backup blob, regardless of access — verified by an architecture review and a penetration test before v1 ship.
5. After 5 wrong recovery attempts in 24 hours, the server refuses recovery for 24 hours and the user is alerted via the PA channel within 60 seconds of the third failed attempt.
6. The encrypted blob remains current — no more than 60 seconds of staleness — when group memberships change or session keys rotate, except during the 60-second debounce window.
7. A user choosing the fresh-identity path has a clear, irreversible confirmation step. Other YappChat clients see the new key as untrusted and warn their users on next interaction.
8. Backup blobs over 1MB are rejected with a clear error and a guidance message about pruning historical group keys.
9. The client-side Argon2id key derivation completes in 500ms–2s on a mid-range mobile device (calibrated to deter offline brute force without making interactive use painful).
10. Audit log entries are written for every backup, recovery, pairing, and fresh-identity event, retained 90 days, and accessible to the user via `GET /api/keybackup/audit`.

---

## Key Entities

| Entity | Location | Description |
| --- | --- | --- |
| `KeyBackup` | `userkeybackups` | A single user's encrypted key bundle. One row per user. Server cannot decrypt. |
| `KeyRecoveryAttempts` | `keyrecoveryattempts` | Per-user attempt counter — drives the rate-limit and lockout policy. |
| `KeyBackupAuditEntry` | `keybackupauditlog` | One row per significant event in the backup / recovery / pairing flow. 90-day retention. |
| `DeviceTrust` | `devicetrust` | A signed certificate linking a new device's public key to an existing trusted device's signature. Verifiable by other YappChat clients. |
| `KeyPairing` | `keypairings` | A live device-pairing session. 5-minute TTL. |

---

## Constraints

- The server MUST NEVER hold the plaintext of a key backup, the user's passphrase, the user's recovery code, or anything that would enable offline decryption. Architecture reviews MUST verify this property.
- Argon2id parameters are stored in the blob itself; future spec versions can adjust defaults without breaking older blobs.
- The recovery code MUST be generated using a cryptographically secure RNG (`crypto.getRandomValues` or platform equivalent). `Math.random` is a hard violation.
- The pairing channel between two devices is end-to-end encrypted — even a fully compromised server cannot extract the key bundle from this flow.
- Recovery-attempt rate limits are server-side and not bypassable by the client. The client-reported `recovery-failed` call exists for telemetry accuracy, not as the gate.
- A user choosing the fresh-identity path is performing an irreversible action. The UI MUST require explicit acknowledgement of what is being lost.
- Backup blobs are stored in PostgreSQL, not object storage. Access patterns are rare and the size is small.
- `expo-secure-store` (mobile, spec 008 FR-004) and IndexedDB-with-WebCrypto-wrapping (web) are the ONLY approved local key stores. Storing keys in `localStorage`, plain IndexedDB without wrapping, or `AsyncStorage` is a hard violation.
- The pairing nonce is single-use and 5-minute TTL. Reusing a nonce on the server is a hard violation that fails closed (the second attempt is rejected).
- Group session keys included in the backup are limited to keys for groups the user is currently a member of, plus any historical keys still needed to decrypt unpurged messages. Keys for groups the user has left and whose history has been purged are NOT carried forward.

---

## Notes

### Linking with spec 011 (Auth)

**Pairing requires an authenticated new device** — formalised by spec 011 FR-016. `POST /api/keybackup/pairing/start` returns HTTP 401 if the caller is unauthenticated. The `pairing:{pairingid}` WS scope subscription auth (spec 003 FR-002) checks both the pairing nonce AND `keypairings.userid = currentuserid` AND a valid session — the new device must complete signup or login before its subscription is accepted.

The pairing nonce in the QR code is signed with the server's auth secret so the existing device verifies the QR was issued by this server (prevents pairing-QR spoofing across deployments).

Cross-spec `deviceid` contract: the value written into `keypairings.id` (and the new device's own `userencryptionkeys.deviceid` after pairing completes) matches `mobiledevices.deviceid` (spec 008) ↔ `pushtokens.deviceid` (spec 009) ↔ `userencryptionkeys.deviceid` (spec 001) ↔ `devicesessions.deviceid` (spec 011 FR-014).

This closes the D3 gap noted in the v1 cross-scope analysis.

### Why not server-side key escrow

A simpler-looking design is "the server holds an escrow copy of every user's key, encrypted with a key the server holds in an HSM". This trades real E2E for the appearance of E2E. An attacker who compromises the server (or the HSM, or a single privileged operator with HSM access) decrypts everything. Spec 001 FR-011 commits to no plaintext on the server; this spec honours that commitment by making the user's possession of the passphrase / recovery code / existing-device the only path to plaintext.

### Why 24-word recovery codes over passwords as default

Memorability and entropy are in tension. A typical user's password has 30–50 bits of entropy at best — well within offline brute-force range if the server were ever compromised (which the architecture forbids, but defence in depth matters). 24 BIP-39 words deliver 256 bits and are paradoxically easier to write down accurately than a password. The passphrase path remains for users who have a strong password manager and prefer a single secret, but the UI defaults to the recovery code.

### Why no Shamir / social recovery in v1

Shamir Secret Sharing distributes shares of the recovery key to N trusted contacts; reconstruction needs K of N. It's a strong design but has a complex UX (choose contacts, share QR codes, have those contacts approve recovery requests). It also leaks identity information about who your trust circle is. Worth considering in v2; out of scope for v1.

### Why no biometric-only recovery

Biometrics are an unlock factor for the secure store on the device itself (handled by spec 008 optional Face ID / Touch ID), not a recovery factor for a lost device. Apple's Advanced Data Protection uses iCloud Keychain for biometric-tied recovery; that's tied to the Apple ecosystem and not portable to a self-hosted YappChat deployment.

### Forward secrecy considerations

True forward secrecy (the property that compromising current keys does NOT expose past messages) is in tension with backup recovery — by definition, recovery means the user's old messages remain decryptable. YappChat's E2E model is "long-lived identity keys", not "ephemeral session keys with forward secrecy". This is a deliberate trade-off favouring usability. Users who require forward secrecy should not enable backup; the documentation of this trade-off must be explicit in the recovery setup UI.

### Risks

- **Argon2id calibration drift**: the recommended cost parameters (64MB memory, 3 iterations) are appropriate for 2026-era mobile devices. Future faster hardware may require parameter increases. The blob format already supports this (parameters stored in the blob); v2 will migrate stored blobs lazily on next replacement.
- **Mobile background interruption during pairing**: if the existing device's app is backgrounded mid-transfer, iOS/Android may suspend the WS. The pairing flow tolerates this — the new device shows "Waiting for sender to come back" and resumes when the sender's app foregrounds. If the 5-minute window expires, both ends restart from the QR.
- **QR-code phishing**: a malicious actor could trick a user into scanning a QR generated for a different account. The 8-digit fallback code is bound to the legitimate user's `userid`; on the existing device, the pairing initiation always shows "Pair {target user}'s device" so the user verifies. A QR for a different user's account fails server-side authorization on the existing device's side.
- **Group session key explosion in large deployments**: a power user in 200 active groups with frequent rotation could push backup size past 1MB. The pruning policy (drop keys for groups where messages have been purged) handles steady state but is acknowledged as a potential pain point.
- **Recovery-locked user with legitimate need**: a legitimate user who fat-fingers their code 5 times in a row is locked out for 24 hours. This is intentional (defence against attackers) but is a poor experience. The fresh-identity escape hatch (FR-009) is the only path during a lockout. v2 may consider an out-of-band identity-verification path for support cases — but only if it can be done without re-introducing a server escrow.
- **Pairing replay attacks**: a captured pairing message replayed against a different new-device subscription must fail. The new device's ephemeral private key is only on that device — replaying the ciphertext to a different device cannot decrypt it. Verified.
- **Time-of-check / time-of-use on rate limits**: the server enforces the 5-attempts limit at request time. Concurrent recovery requests (rare but possible) MUST be serialised at the database level via row-locking on `keyrecoveryattempts.userid`, otherwise an attacker could fire 100 parallel requests and exceed the count.

---

## Clarifications

### Session 2026-05-10

| # | Question | Decision |
| --- | --- | --- |
| 1 | Server-side escrow vs client-only encryption? | Client-only. Server NEVER sees plaintext. Server provides storage, rate limits, and pairing relay only. |
| 2 | Default recovery secret type? | 24-word BIP-39 mnemonic. Passphrase path retained for users who prefer it, but discouraged via UI. |
| 3 | KDF? | Argon2id, 64MB memory, 3 iterations, parallelism 1. Parameters stored in the blob for forward compatibility. |
| 4 | Symmetric cipher? | XChaCha20-Poly1305 via libsodium. AES-GCM is acceptable but less ergonomic with random nonces. |
| 5 | How many backups per user? | One. Latest replaces previous. No version history. |
| 6 | Recovery rate limit? | 5 wrong attempts in 24h → 24h lockout. 10 wrong in 7 days → 7-day lockout. PA notification after 3 failed attempts in 1 hour. |
| 7 | Cross-device handoff — needs server? | Server only relays opaque ciphertext over a 5-minute pairing channel. Server cannot decrypt. |
| 8 | What if the user loses everything? | Fresh identity. Old messages stay encrypted forever. Other users see the new key as untrusted and are warned. No "support recovery" path that would require server-side escrow. |
| 9 | Group session keys included? | Yes. The backup blob carries every group session key the user knows. Pruned when messages encrypted with a key are purged from the user's retention window. |
| 10 | Forward secrecy? | Out of scope. YappChat's E2E uses long-lived identity keys; backup recovery requires this. Users who need forward secrecy should not enable backup. |
| 11 | Shamir / social recovery? | Out of scope for v1. Considered for v2. |
| 12 | Biometric-tied recovery? | Out of scope. Biometrics unlock the local secure store (spec 008); they do not recover a lost device. |
