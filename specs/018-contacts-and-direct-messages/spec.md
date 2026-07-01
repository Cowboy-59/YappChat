# Spec 018: Contacts & Direct Messages

**Spec Number**: 018
**Status**: `implemented` (retro-scoped 2026-06-28 — built ahead of spec; this document reflects the shipped code and is the authoritative scope going forward)
**Created**: 2026-06-28
**Scope Source**: [`specs/Project-Scope/018-contacts-and-direct-messages.md`](../Project-Scope/018-contacts-and-direct-messages.md)
**Design**: [`specs/design/communication-model.md`](../design/communication-model.md) — the **Individuals** context (context 3 of three: Company / Groups / Individuals)
**Depends On**: Spec 001 (Common Chat Engine — `conversations`/`messages`/`conversationmembers`, `person`/`group` conversation kinds, `conversation:{id}` scope, `sendMessage`/`postSystemMessage`), Spec 003 (WebSocket engine — live delivery; **token-in-handshake auth**), Spec 011 (Auth — `users`, sessions, SES mailer, invite-token pattern)

## Overview

Direct Messages is YappChat's **Individuals** context — the WhatsApp/iMessage half of the product: person-to-person and small ad-hoc group conversations tied to a **personal relationship**, not an employer (Company, ctx 1) or a shared interest (Communities/Groups, ctx 2).

The defining shape is a **contacts social graph**: before two people can chat freely they must be **connected**. A connection is a **request → accept** ("friend request") relationship, surfaced to the recipient **as a private message** — the request opens a 1:1 conversation and posts a "wants to connect" notice with **Accept / Decline**. Accepting makes them mutual contacts and unlocks the DM; declining closes it. From an accepted contact set, a user can spin up an **ad-hoc group chat**. People you can't find by search can be pulled in by **email invite**: a non-user gets a link, signs up, and auto-connects.

DMs ride the spec 001 engine (`person`/`group` conversation kinds, shared `conversationmembers`) and the spec 003 transport unchanged — this spec adds the **contacts graph + the gating + the entry points**, not a new message bus.

## Business Problem

The org directory (spec 001) lets coworkers DM each other because they share a Company. But YappChat's Individuals context is for relationships that **cross org boundaries** — a person you met in a community, a friend, a customer. There is no employer to imply the relationship, so the product needs an explicit, consent-based **connection** primitive: you don't get unsolicited DMs; you get a *request*, and you choose. This is the standard social-graph guarantee (request/accept, no cold DMs) that makes a cross-org personal messenger safe to open up.

## Actors

- Primary: User — initiates a connection (via people-search, an email invite, or by clicking someone in a community) and chats once connected.
- Primary: Recipient — receives a connect request and accepts/declines it from the private message.
- Secondary: Non-user invitee — reached by email, connects on sign-up.

## Success Metrics

1. **No cold DMs — 100% gated** — a `person` conversation rejects 100% of user messages until an `accepted` contact row exists between the two members (enforced server-side in the engine send path); the connect request is a system message and is the only thing that flows pre-accept.
2. **Consent both ways — 100% addressee-only** — a contact is mutual only after the addressee accepts; decline closes the thread; 100% of respond actions are authorized server-side to the addressee alone (any other caller is rejected).
3. **Request is a message — 100% in-thread** — every connect request (100%, no hidden side-channel) appears in a real 1:1 conversation with Accept/Decline, reachable from the Chats inbox.
4. **Group = contacts only — 0 non-contacts** — an ad-hoc group chat admits 0 members who are not the creator's accepted contacts.
5. **Email reach — 0 manual re-requests** — inviting an email with no account sends a link that auto-connects the pair on sign-up, requiring 0 additional connect steps from either side.

## Scope Boundary

**IN:** the contacts graph (`contacts` M2M, request/accept/decline, mutual on accept); contact requests delivered **as a private message** (opens the 1:1 conversation + system notice + Accept/Decline); accepted-only DM send-gating; ad-hoc **group** DMs from accepted contacts; people **search** by name/email; **email invite** for non-users (`contactinvites` + SES) with auto-connect on sign-up; entry points — a **Chats** surface (`/chats`, icon in the rail) with a `+` new-chat modal, **and** "Ask to connect" by clicking a person in any community. New code: `src/lib/contacts/service.ts`, `src/lib/db/contacts-schema.ts`, `src/components/chats/ChatsApp.tsx`, `src/app/(authenticated)/chats/*`, `src/app/api/contacts/*`, `src/app/api/chats/*`, `src/app/invite/contact/[token]/*`. New tables: `contacts`, `contactinvites`. Touches spec 001 `sendMessage` (the DM gate).

**OUT:** Company directory DMs (spec 001's directory-driven Person DM) and Communities (spec 017) — separate contexts; presence/typing internals (spec 003); E2E for DMs (deferred — see Open Questions); blocking/reporting/spam controls; contact groups/labels; bridging to external platforms.

## Out of Scope

Block/report/mute; contact organization (labels, favorites); read receipts beyond the engine default; DM E2E encryption; presence (reuses spec 003); video calls (spec 001 T7); email-bound invites (current invite is bearer-token — see Open Questions).

## Open Questions

1. ~~**Invite binding**~~ — **RESOLVED 2026-07-01 (delta §3):** email invites are now **email-bound + verified-email-required + consume-first atomic** (see revised FR-006). Bearer-token semantics removed.
2. **E2E for DMs** — the Individuals context is personal/cross-org and a natural candidate for E2E (spec 010), unlike communities. Deferred; not yet wired. NOTE: **escrow (at-rest, KMS-envelope, lawful-access — explicitly NOT E2E)** was designed in `PROPOSED-DELTA.md` §7 and is **deferred to a delta revision + Legal** (see Deferred below).
3. **Outgoing-request visibility** — the sender's UI shows "waiting for accept" heuristically (conv is neither an accepted contact nor a group); a dedicated outgoing-pending list is not yet modeled.
4. **Opposite-direction re-conversation (delta §2 OQ-D)** — a re-request reuses the pair's single conversation, so a repeat approach is visible in-thread to the addressee. Accepted for v1 (declined rows post no visible system message); revisit if the no-decline-disclosure guarantee is tightened.
5. **Cross-node rate limits (delta §5/§10 OQ-S1)** — the in-memory limiter is per-node; the durable `contactfreezes` table is the real flood guard, but search-throttle and flood-trip *detection* multiply by node count until a shared store (Redis) lands. Tracked cross-cutting alongside the spec 011 limiter.

## Functional Requirements

### FR-001 — Contacts graph (M2M, request/accept) — **REVISED 2026-07-01 (delta §2)**
`contacts(requesterid, addresseeid, status pending|accepted|declined, conversationid, usera, userb, createdat, respondedat)`. Each request is an **immutable event row**; a row moves `pending → (accepted|declined)` exactly once and is then terminal (no in-place resurrection of a `declined` row back to `pending`). **"Connected" is derived** — two users are connected iff an `accepted` row exists between them (either direction), not from "the pair's single row." Only the **addressee** may accept/decline. See the approved delta below (FR-018-2.x) for the full rework: dropped ordered-pair unique index, canonical `usera=LEAST/userb=GREATEST` columns + **partial unique index** enforcing at-most-one-active row per unordered pair, 24h declined-row retention, immediate plain re-request, idempotent duplicate suppression, and opposite-direction auto-accept. Implemented: `requestContact`, `respondToContact`, `listContacts`, `listIncomingRequests`, `areContacts` in `lib/contacts/service.ts`.

### FR-002 — Connect request delivered as a private message
`requestContact(a,b)` get-or-creates the 1:1 `person` conversation (both as members) and posts a `postSystemMessage` "wants to connect" notice. The recipient sees it in their Chats inbox with **Accept / Decline**; accept posts a "you're now connected" notice. Entry points: people-search (`+`), email, or clicking a person in a community.

### FR-003 — Accepted-only DM send-gating
In `lib/engine/service.ts` `sendMessage`, a `person` conversation rejects a user message (`EngineError("not_connected", 403)`) unless an `accepted` `contacts` row exists between its two members. System messages (`postSystemMessage`) bypass — so the request/accept notices flow, but no free-text chat does, until accepted.

### FR-004 — Ad-hoc group chats
`createGroupChat(creator, memberIds)` creates a `group` conversation with the creator + members; every member must be an `accepted` contact of the creator (else `not_a_contact` 403). Surfaced in the Chats inbox under "Group chats." `POST /api/chats`; `GET /api/chats` lists the caller's `person`+`group` conversations (`listMyChats`).

### FR-005 — People search
`GET /api/contacts/search?q=` (`searchUsers`) matches `users.displayname`/`email` (ILIKE, ≥2 chars, excludes self, limit 10) for the new-chat picker.

### FR-006 — Email invite for non-users — **REVISED 2026-07-01 (delta §3)**
`inviteContactByEmail(inviter, email)`: if a user with that email exists → `requestContact`; else create a `contactinvites` row (hashed token, 7-day expiry) and send an SES invite linking `/invite/contact/{token}`. The **accept** step (`acceptContactInvite`) is hardened (was bearer-token + check-then-act):

- **Email-bound** — the accept is rejected unless the accepting account's email equals the invite's `email` (case-insensitive, both normalized). A mismatch does **not** consume the invite and creates no contact/conversation; it is logged (`authauditlog`) as a rejected invite-accept.
- **Verified-email required** (delta finding #22) — the accepting account's email MUST be verified (`emailverifiedat` set); an unverified-email account cannot consume an invite (else the email-bind is defeatable by claiming any address at signup).
- **Consume-first atomic** — a single conditional `UPDATE … WHERE id=? AND consumedat IS NULL` claims the invite; only the caller whose update affects exactly one row proceeds to create the **accepted** contact + DM. Concurrent double-accepts yield exactly one contact.
- Self-invite, expiry, and single-use guards remain. `invite`/`contact` paths stay in the return-url allow-list.

### FR-007 — Chats surface + entry points
`/chats` (authenticated) renders `ChatsApp`: left rail = incoming **Requests** (Accept/Decline) + **Contacts** + **Group chats**; right = the active conversation reusing the engine message/WS stack (subscribe `conversation:{id}`, live `message.inbound/outbound`, gated composer). A **Chats** icon (MessageCircle) sits in the icon rail. The `+` opens the new-chat modal (search → Connect / Chat / multi-select group / email-invite). In `CommunitiesApp`, a message author's name is a button → "Ask to connect."

## Delta — Approved 2026-07-01 (Safe Fixes)

This delta ships the **low-risk hardening** carved out of the large access/privacy/safety design in [`PROPOSED-DELTA.md`](./PROPOSED-DELTA.md). It is scoped to correctness + abuse/DoS hardening on the contacts graph and invites; the **heavy features are deferred** (see below). Blocking adversarial-review findings that touch these sections are resolved as decisions here.

### Already shipped (2026-06-30, security fixes)

- **FR-018-A1 — Engine-route membership gate.** `GET/POST /api/engine/conversations/[id]/messages` is membership-gated via `isConversationMember` (before: any signed-in user could read/post any conversation by id, including private DMs).
- **FR-018-A2 — WS private-tier scope isolation** (resolves PROPOSED-DELTA finding #15). `publishMessageEvent` publishes private/native kinds (`person`/`group`/`space`/`support`) **only** to the membership-checked `conversation:{id}` scope; the open `channel:` scope is reserved for legacy bridged channels. Before: all DMs shared one `direct` channel and `channel:` subscribe was unconditionally authorized → any signed-in user could subscribe and read all DMs live.

### FR-018-2.x — Contacts graph rework (revises FR-001)

- **FR-018-2.1 Immutable request records.** Each request is a new immutable `contacts` row; `status` transitions at most once (`pending`→terminal) with a single `respondedat`. No in-place resurrection of a `declined` row.
- **FR-018-2.2 Drop ordered-pair unique index.** `contacts_pair_key` on `(requesterid, addresseeid)` is dropped; multiple rows per unordered pair over time are expected.
- **FR-018-2.3 At-most-one-active invariant (MUST, index-enforced).** Canonical `usera=LEAST(requesterid,addresseeid)`, `userb=GREATEST(...)` columns (computed at insert) + **partial unique index** `contacts_active_pair_key` on `(usera,userb) WHERE status IN ('pending','accepted')`. Resolves OQ-A → **index is mandatory**; `requestContact` also transaction-wraps read-then-insert (belt-and-suspenders).
- **FR-018-2.4 "Connected" derived from an accepted record.** `areContacts`/gate reads "an accepted row exists," never a single pair row's status.
- **FR-018-2.5 Declined rows are 24h purgeable history.** Retained then purgeable 24h after `respondedat`; purge is **lazy-on-access to the pair** (+ opportunistic); excluded from the active invariant; purge never touches an active row or the conversation.
- **FR-018-2.6 Immediate, plain re-request.** After a decline either user may re-request immediately (no cooldown, no "declined-before" wording); a new `pending` row + standard "wants to connect" message. Prior `declined` row untouched.
- **FR-018-2.7 Idempotent duplicate suppression.** Existing same-direction pending → return it, no second row/message. Existing accepted → return the connection, no new row.
- **FR-018-2.8 Opposite-direction auto-accept (resolves OQ-B, finding #13).** If an active pending row exists in the **opposite** direction when B requests A, `requestContact` transitions **that** row to `accepted` (a legal addressee-initiated pending→accepted) rather than inserting a competing row — so the unique index never trips and FR-2.8 accept-authority is honored.

### FR-018-3.x — Contact-invite hardening (revises FR-006)

Covered in revised FR-006 above: **email-bound + verified-email-required + consume-first atomic accept.** Precise contact-write (resolves finding #4): accepted row → no-op; pending row (either direction) → transition to `accepted`; only declined/none → insert new `accepted` row (never resurrect a declined row).

### FR-018-70.x — Contact-request flood guard (renumbered to avoid the §4/§5 collision, finding #1)

- **FR-018-70 Rolling-rate trip.** Count each accepted `requestContact` attempt (and each new-user email invite that creates an outbound "wants to connect") per user in a rolling window. **Default 20 requests / 60 s** (raised from 10 per finding #18 — address-book imports must not instantly trip), tunable via `CONTACT_FLOOD_LIMIT` / `CONTACT_FLOOD_WINDOW_MS`. Counted at exactly one seam (finding #7): the existing-user invite branch delegates to `requestContact` and is counted once, not twice.
- **FR-018-71 Freeze on trip — contact requests only.** A durable `contactfreezes` row blocks *only* sending new contact requests; all other capability (read, post to member conversations, respond to inbound requests, sign-in) keeps working. Survives restarts and window resets.
- **FR-018-72 Frozen check first + authoritative.** `requestContact` checks the freeze before any other work; rejects with `CONTACT_REQUESTS_FROZEN` (429). The tripping request's own response IS the at-trip user notification (finding #14); no threshold leak.
- **FR-018-73 Audit on trip.** One `authauditlog` row `eventtype='contact_flood'` (count/limit/window/timestamp); best-effort, never blocks the freeze. `AuthEventType` union **MUST** add `contact_flood` + `contact_unfreeze` (finding #14).
- **FR-018-74 Sysadmin notify — digest, not per-trip (finding #28).** On trip notify `issystemadmin` users via SES, but **throttled/deduped** (a global cool-down so trips can't be weaponized as an admin mail-bomb); the in-app review surface is the durable source of truth, so a suppressed email never hides a freeze. SES failure logged, never rolls back the freeze.
- **FR-018-75 Single active freeze per user.** Partial unique index on `contactfreezes(userid) WHERE clearedat IS NULL`; a re-trip does not stack a second active row.
- **FR-018-76 Held until manually cleared.** No auto-expiry; only a sysadmin unfreeze lifts it.
- **FR-018-77 Sysadmin review + unfreeze surface (named endpoints).** `GET /api/admin/contact-freezes` (list active) and `POST /api/admin/contact-freezes/[id]/unfreeze`, both re-verifying `issystemadmin` server-side (403 otherwise); no self-unfreeze. Unfreeze sets `clearedat`/`clearedby`, writes `authauditlog` `eventtype='contact_unfreeze'`, and resets the stale in-memory window so it doesn't instantly re-trip. Rendered in the `/admin` console.

### FR-018-G — Group-chat atomicity (delta §9)

`createGroupChat` performs member validation + conversation creation + all member inserts inside a **single DB transaction** (all-or-nothing; no partial group). Note: full row-lock/`SERIALIZABLE` TOCTOU protection is only *needed* once contact removal (block/unfriend, §4) ships and is **deferred with §4**; today accepted contacts cannot be revoked, so the transaction (atomicity) is the complete safe fix now.

### FR-018-S — People-search rate-limit (delta §10)

`GET /api/contacts/search` is rate-limited per authenticated user (`contacts:search:{userid}`), **default ~30 / 60 s**, returning **429 + `retryAfterSec`** on trip. The existing 2-char minimum, self-exclusion, and 10-row cap are retained unchanged. A search-throttle trip does **not** freeze contact requests and does **not** emit a `contact_flood` event.

## Deferred to a Delta Revision + Legal (NOT in this delta)

The following heavy features from `PROPOSED-DELTA.md` are **out of this safe-fix delta** and require a follow-up spec revision, several with **blocking Legal sign-off**:

- **§1 public/private access tiers** (public-space non-member read + join-to-post) — beyond the two shipped route/WS gates.
- **§4 Block / Unfriend** — contact removal; also the prerequisite that makes the group-chat TOCTOU exploitable (hence FR-018-G ships atomicity now, locking later).
- **§6 @mention → private DM** from a public space — carries a block-probing/enumeration oracle (finding #19) to resolve first.
- **§7 Escrow encryption** (at-rest, per-conversation AES-256-GCM DEK, AWS-KMS envelope, `conversationkeys`, sysadmin-only audited lawful-access export — **explicitly NOT E2E**). BLOCKING findings: "sysadmin-only" overclaim vs routine server unwrap (#16), derived-tier flip mis-encryption (#20), crypto-shred vs legal-hold (#21).
- **§8 Illegal-activity monitoring** (AI classifier + serious-crime taxonomy + sysadmin review queue, human-in-loop). **BLOCKING: Legal sign-off + enforced disclosure gate** (#17); third-party AI sub-processor/residency disclosure (#29); plaintext-excerpt store undercutting escrow (#24).

## Implementation Status (retro)

Built and verified (tsc + eslint clean) 2026-06-28; migration `0018` applied (`contacts`, `contactinvites`). The **2026-07-01 safe-fix delta** adds migration `0020` (contacts `usera`/`userb` + index rework, `contactfreezes`). **Not yet exercised live end-to-end by the user.** See [`plan.md`](./plan.md) for the file map and [`tasks.md`](./tasks.md) for task state.
