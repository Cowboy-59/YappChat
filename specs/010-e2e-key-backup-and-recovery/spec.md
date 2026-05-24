# Spec 010: E2E Key Backup and Recovery

## Overview

Spec 001 mandates end-to-end encryption for every YappChat-to-YappChat message and warns that "if a user loses their private key (clears browser storage, loses device), they cannot decrypt historical E2E messages." This spec closes that gap.

**The problem**: E2E privacy is only valuable if users can actually live with it. The first time a user replaces their phone, clears Safari data, or factory-resets a laptop, all their YappChat history becomes ciphertext they can never decrypt. Without recovery, E2E is a footgun.

**The approach** — a two-track recovery model:

1. **Cross-device handoff** (the everyday case) — when a user adds a second device while still owning their first, the existing device transfers the key bundle to the new device directly over an authenticated, server-relayed channel. The server only sees ciphertext.
2. **Encrypted backup with passphrase** (the disaster case) — the user encrypts their key bundle with a key derived from a passphrase or a generated recovery code (24-word BIP-39 mnemonic). The ciphertext blob is stored on the server. If the user loses all devices, they can re-derive the key from the passphrase and decrypt their history.

The server NEVER sees the plaintext private keys, the passphrase, or the recovery code. All key derivation and decryption happens client-side. The server stores opaque blobs and enforces rate limits to prevent online brute-force attacks. The server cannot perform offline brute-force because it never holds plaintext.

This spec also covers group session keys (the sender keys used for group messaging) so a recovered user can read historical group conversations they were part of, not just 1-on-1 messages.

**Scope Boundary** — IN SCOPE: encrypted key backup envelope format (versioned, parameters in blob); passphrase-based key derivation (Argon2id 64MB / 3 iter / parallelism 1); 24-word BIP-39 recovery code generation; cross-device handoff via QR-code-initiated authenticated channel with X25519 + HKDF-SHA256 + XChaCha20-Poly1305; group session key inclusion + debounced re-upload; anti-bruteforce rate limiting (5/24h → 24h lock, 10/7d → 7d lock, PA alert after 3/1h); recovery UI flow; passphrase rotation; printable recovery code one-time display; fresh-identity escape hatch; backup-setup nudge + out-of-date banners. OUT OF SCOPE: identity verification across devices that don't share a key (auth spec 011); Shamir / social recovery (deferred to v2); HSM-based server-side key escrow (deliberately rejected — undermines E2E); push-notification-driven new-device approval (deferred); deletion of backups as part of retention policy (spec 001).

**Depends On**: Spec 001 (`userencryptionkeys`, E2E rules, retention policy), Spec 002 (`postPANotification` for recovery alerts), Spec 003 (WebSocket pairing scope), Spec 008 (`SecureKeyStore`, `mobiledevices.deviceid`), Spec 011 (auth required for pairing start + WS subscription).

## Phase

**Current Phase**: design
**Priority**: high

## Status

- **Date**: 2026-05-24
- **Phase**: design
