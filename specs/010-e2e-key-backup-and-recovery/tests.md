# Test Plan: E2E Key Backup and Recovery

**Spec Number**: 010
**Date Generated**: 2026-05-24
**Spec**: [spec.md](spec.md) | **Tasks**: [tasks.md](tasks.md)

---

## Test Strategy

| Layer | Framework | Coverage Target |
|-------|-----------|-----------------|
| Unit | Vitest | Core logic, services, utilities |
| Integration | Vitest + Supertest | API endpoints, DB operations |
| E2E | Playwright | User workflows, critical paths |

---

## Unit Tests

### UT-001 — Backup envelope format + storage APIs + audit log + database schema

**Linked Task**: T001
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Backup envelope format + storage APIs + audit log + database schema — happy path | Success response | pending |
| 2 | Backup envelope format + storage APIs + audit log + database schema — validation error | Error with details | pending |
| 3 | Backup envelope format + storage APIs + audit log + database schema — edge case | Graceful handling | pending |

### UT-002 — Client-side crypto primitives: Argon2id KDF + XChaCha20-Poly1305 + BIP-39 recovery code generation

**Linked Task**: T002
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Client-side crypto primitives: Argon2id KDF + XChaCha20-Poly1305 + BIP-39 recovery code generation — happy path | Success response | pending |
| 2 | Client-side crypto primitives: Argon2id KDF + XChaCha20-Poly1305 + BIP-39 recovery code generation — validation error | Error with details | pending |
| 3 | Client-side crypto primitives: Argon2id KDF + XChaCha20-Poly1305 + BIP-39 recovery code generation — edge case | Graceful handling | pending |

### UT-003 — Recovery flow with server-side rate limiting + lockouts + PA notifications

**Linked Task**: T003
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Recovery flow with server-side rate limiting + lockouts + PA notifications — happy path | Success response | pending |
| 2 | Recovery flow with server-side rate limiting + lockouts + PA notifications — validation error | Error with details | pending |
| 3 | Recovery flow with server-side rate limiting + lockouts + PA notifications — edge case | Graceful handling | pending |

### UT-004 — Cross-device handoff: QR-code pairing protocol with X25519 + HKDF + XChaCha20-Poly1305

**Linked Task**: T004
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Cross-device handoff: QR-code pairing protocol with X25519 + HKDF + XChaCha20-Poly1305 — happy path | Success response | pending |
| 2 | Cross-device handoff: QR-code pairing protocol with X25519 + HKDF + XChaCha20-Poly1305 — validation error | Error with details | pending |
| 3 | Cross-device handoff: QR-code pairing protocol with X25519 + HKDF + XChaCha20-Poly1305 — edge case | Graceful handling | pending |

### UT-005 — Group session key inclusion + debounced re-upload + 1MB-cap pruning

**Linked Task**: T005
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Group session key inclusion + debounced re-upload + 1MB-cap pruning — happy path | Success response | pending |
| 2 | Group session key inclusion + debounced re-upload + 1MB-cap pruning — validation error | Error with details | pending |
| 3 | Group session key inclusion + debounced re-upload + 1MB-cap pruning — edge case | Graceful handling | pending |

### UT-006 — Passphrase rotation + fresh-identity escape hatch + setup nudge banners

**Linked Task**: T006
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Passphrase rotation + fresh-identity escape hatch + setup nudge banners — happy path | Success response | pending |
| 2 | Passphrase rotation + fresh-identity escape hatch + setup nudge banners — validation error | Error with details | pending |
| 3 | Passphrase rotation + fresh-identity escape hatch + setup nudge banners — edge case | Graceful handling | pending |

### UT-007 — Frontend onboarding + setup surface: KeyBackupOnboarding, RecoveryCodeReveal, RecoveryCodeConfirmation, PassphraseSetup, banners

**Linked Task**: T007
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Frontend onboarding + setup surface: KeyBackupOnboarding, RecoveryCodeReveal, RecoveryCodeConfirmation, PassphraseSetup, banners — happy path | Success response | pending |
| 2 | Frontend onboarding + setup surface: KeyBackupOnboarding, RecoveryCodeReveal, RecoveryCodeConfirmation, PassphraseSetup, banners — validation error | Error with details | pending |
| 3 | Frontend onboarding + setup surface: KeyBackupOnboarding, RecoveryCodeReveal, RecoveryCodeConfirmation, PassphraseSetup, banners — edge case | Graceful handling | pending |

### UT-008 — Frontend recovery + pairing + settings surface: KeyRecoveryFlow, pairing UIs, settings, audit view

**Linked Task**: T008
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Frontend recovery + pairing + settings surface: KeyRecoveryFlow, pairing UIs, settings, audit view — happy path | Success response | pending |
| 2 | Frontend recovery + pairing + settings surface: KeyRecoveryFlow, pairing UIs, settings, audit view — validation error | Error with details | pending |
| 3 | Frontend recovery + pairing + settings surface: KeyRecoveryFlow, pairing UIs, settings, audit view — edge case | Graceful handling | pending |

## Integration Tests

| # | Scenario | Endpoint/Flow | Expected | Status |
|---|----------|--------------|----------|--------|
| 1 | Full E2E Key Backup and Recovery workflow | End-to-end | All steps succeed | pending |
| 2 | Error handling | Error paths | Proper error responses | pending |
| 3 | Auth/permissions | Protected routes | 401/403 as expected | pending |

## E2E Tests

| # | User Story | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 1 | Primary flow | User completes E2E Key Backup and Recovery | Success | pending |
| 2 | Error recovery | User encounters and recovers from error | Guided recovery | pending |

## Test Automation

```bash
# Run unit tests
npm run test

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e
```

## Coverage Requirements

- Unit test coverage: >= 80%
- All acceptance criteria from spec must have at least one test
- All API endpoints must have integration tests
- Critical user flows must have E2E tests
