# PROPOSED Spec Delta — 018 (Contacts & DMs) + 017 (Communities)

**STATUS: PROPOSAL — awaiting product-owner approval. NO code until approved.**

Generated 2026-06-30 from the agreed access/privacy/safety model (contacts rework, public/private tiers, block/unfriend, flood guard, @mention-PM, escrow encryption, illegal-activity monitoring).



---

## [spec both] Access & Privacy Tiers: Public-Read Spaces vs Private Conversations, and Engine-Route Membership Gating with Join-to-Post

## Section 1 — Access & Privacy Tiers (public vs private; engine-route gating; join-to-post)

**Spans specs 017 (Communities) and 001 (Common Chat Engine) / 018 (Contacts & DMs).**
Proposal only — describes target behavior, not implementation.

This section defines the two-tier access-and-privacy model that all conversation-scoped reads and writes are governed by, and the exact place that model is enforced: the engine message route `GET`/`POST /api/engine/conversations/[id]/messages`. The members-only gate on both verbs is **already implemented** as the security baseline (see `apps/web/src/app/api/engine/conversations/[id]/messages/route.ts` — both handlers already call `isConversationMember` and return `403 forbidden`). This section adds exactly two behaviors on top of that baseline: (a) a **public-space READ exception** so non-members may read a genuinely public community space, and (b) an explicit **join-to-post** rule so posting to any space **always** requires membership. No other tier changes are proposed here.

### 1.1 The tier model

Every conversation resolves to exactly one of two access/privacy tiers. A conversation's `kind` (spec 001: `channel | group | person | agent | space | support`) plus, for `space` kind, its community/space policy, determines the tier.

| Tier | Which conversations | READ | POST | At-rest storage | Monitoring |
|---|---|---|---|---|---|
| **PUBLIC** | A `space` conversation whose parent community `discoverability = public` **AND** the space's effective discoverability is not stricter than the community **AND** the space is **not** an admin space (`adminonly = false`) **AND** the space is **not** corporate-restricted (`corponly = false`) | Any signed-in user, **without joining** | **Members only** — a non-member must **join first** (become a member → a `conversationmembers` row) | **Plaintext** (server-stored as today) | Standard community moderation only (no private-content classifier) |
| **PRIVATE / CLOSED** | All `person` DMs; all `group` DMs; every `space` that fails the PUBLIC test above (community not public, space overrides stricter, admin space, or corp-only space); and any `channel`/`agent`/`support` conversation as today | **Members only** | **Members only** (`person` DMs additionally gated on an accepted `contacts` row inside `sendMessage`, per spec 018 FR-003 — unchanged) | Encrypted at rest (escrow; specified in Section 7) | Illegal-activity classifier over decrypted content (specified in Section 8) |

Notes:
- The at-rest-encryption and monitoring columns are stated here to fix which tier each conversation lands in; the mechanisms themselves are specified in Sections 7 and 8 and are **not** in scope for this section's acceptance criteria.
- "Signed-in user" means an authenticated session (spec 011). Unauthenticated visitors get nothing conversation-scoped; they see only public community **landing** info (spec 017 FR-008), never message content.

### 1.2 How "public space" is determined

A `space` conversation is **PUBLIC** if and only if **all** of the following hold. Any failure ⇒ the conversation is **PRIVATE/CLOSED**.

1. The space's parent community has `communities.discoverability = 'public'`.
2. The space does not override to a stricter discoverability — i.e. `effectiveDiscoverability(community.discoverability, space.discoverability)` (spec 017 `policy.ts`) resolves to `'public'`. A space with `discoverability = NULL` inherits the community; a space set to `unlisted` fails this test.
3. The space is **not** an admin space: `spaces.adminonly = false`.
4. The space is **not** corporate-restricted: `spaces.corponly = false`.

A conversation that is not of `kind = 'space'` (i.e. `person`, `group`, `channel`, `agent`, `support`) is **never** PUBLIC by this rule and is always evaluated in the PRIVATE/CLOSED tier for the purposes of the read gate.

### 1.3 Functional Requirements

#### FR-A1 (spec 001 / 018) — Members-only baseline is retained on both verbs [NO CHANGE]
The engine message route MUST continue to gate `GET` and `POST /api/engine/conversations/[id]/messages` on conversation membership (`isConversationMember`), returning `403` for a non-member, as the default for **every** conversation. This is the existing security baseline and MUST NOT be weakened by the exceptions below. This mirrors the WS `conversation:{id}` subscribe authz (`server/ws.ts`).

**Acceptance Criteria**:
- [ ] A signed-in non-member `POST` to any conversation returns `403 forbidden`.
- [ ] A signed-in non-member `GET` on any **non-public** conversation (any `person`/`group`, or any private/closed/admin/corp space) returns `403 forbidden`.
- [ ] The WS subscribe predicate for `conversation:{id}` is unchanged (membership-checked); a non-member cannot subscribe to any conversation, including a public space (live delivery still requires joining).

#### FR-A2 (spec 001, refines spec 017 FR-004/FR-010) — Public-space READ exception on GET
`GET /api/engine/conversations/[id]/messages` MUST additionally allow a **non-member, signed-in** user to read history when the target conversation is a **PUBLIC space** per §1.2. The route MUST resolve the conversation's tier server-side before returning content; it MUST NOT rely on any client-supplied tier hint.

**Acceptance Criteria**:
- [ ] A signed-in user who is not a member of a PUBLIC space can `GET` that space's message history (`200`, messages returned).
- [ ] The same user gets `403` on a space that is `unlisted`-overridden, `adminonly`, or `corponly`, or whose community is not `public`.
- [ ] The public-read decision is computed entirely server-side from `communities.discoverability`, `spaces.discoverability`, `spaces.adminonly`, and `spaces.corponly` (via the `effectiveDiscoverability` helper), joined from `conversations.id` → `spaces.conversationid`.
- [ ] An unauthenticated request (no session) still returns the auth error (never message content), even for a public space.

#### FR-A3 (spec 017, refines FR-004) — Join-to-post (POST always requires membership)
`POST /api/engine/conversations/[id]/messages` MUST require membership for **all** tiers, including PUBLIC spaces. Reading a public space MUST NOT confer the ability to post. To post, a non-member MUST first **join** the space (become a member — a `conversationmembers` row is created via the community join flow, spec 017 FR-004, subject to the community/space effective join policy). The post gate MUST NOT be satisfiable by the public-read exception.

**Acceptance Criteria**:
- [ ] A non-member `POST` to a PUBLIC space returns `403 forbidden` (identical to any other non-member post).
- [ ] After the user joins the space (member row exists) and satisfies join policy, a subsequent `POST` succeeds (`201`).
- [ ] For an `open`-policy public community/space, the join is instant and a single join → post round-trip succeeds without moderator action (per spec 017 FR-004 `open` = instant).
- [ ] For an `approval`/`invite` effective policy, the user cannot post until the join is granted; the public-read exception does not bypass this.

#### FR-A4 (spec 001) — Enforcement is single-point and tier-driven
The public-read exception (FR-A2) and the join-to-post rule (FR-A3) MUST be enforced **only** at the engine message route (and its WS analogue for subscribe), reusing the existing `isConversationMember` predicate plus a single server-side "is this a public space?" resolver. No route may grant read/post access by a bespoke, per-caller check that diverges from §1.2. The `person`-DM accepted-contact gate inside `sendMessage` (spec 018 FR-003) is unaffected and continues to apply on top of the membership check for `person` conversations.

**Acceptance Criteria**:
- [ ] There is exactly one server-side resolver that classifies a conversation id as PUBLIC vs PRIVATE/CLOSED for the read gate; both the route and any test harness use it.
- [ ] Removing/altering the public-space resolver cannot silently open a private conversation (default-deny: unknown/unclassifiable ⇒ PRIVATE/CLOSED ⇒ members-only).
- [ ] The `sendMessage` accepted-contact gate for `person` conversations is unchanged and still rejects non-connected DMs with `not_connected` (403).

### 1.4 Data-model changes

**None required for this section.** The determinants already exist under the project DB conventions (tables lowercase+plural, PK `id` uuid v7, FK = parentname+`id`, columns lowercase):

- `communities.discoverability` (`public | unlisted`) — existing.
- `spaces.conversationid` (FK → `conversations.id`), `spaces.communityid` (FK → `communities.id`), `spaces.discoverability` (nullable; NULL = inherit), `spaces.joinpolicy` (nullable; NULL = inherit), `spaces.adminonly` (boolean), `spaces.corponly` (boolean) — existing.
- `conversationmembers` (spec 001) — existing; membership is the join-to-post gate.
- `contacts` (spec 018) — existing; the `person`-DM accepted gate.

The tier of a conversation is **derived**, not stored, so no schema migration is proposed. (If profiling later shows the public-space resolution join is hot on the read path, a denormalized `conversations.accesstier` cache column could be considered — recorded as an Open Question, not proposed here.)

### 1.5 Security & privacy notes

- **Default-deny.** Every conversation is members-only unless it affirmatively passes the §1.2 PUBLIC test. Any ambiguity (missing space row, unknown kind, null-resolution edge) MUST resolve to PRIVATE/CLOSED. The baseline gate already returns `403` on the fall-through path; the exception is purely additive and MUST NOT convert a `403` into a `200` for anything failing §1.2.
- **Read ≠ write ≠ subscribe.** Three distinct capabilities: non-members may READ a public space (REST GET), but POST and live WS subscribe **both** require membership. This is deliberate — public read is a low-friction "browse before you join," while posting and receiving live traffic require the user to be an accountable, joined member (enabling moderation, notifications, and presence).
- **No plaintext leak from private tiers.** Because private/closed conversations are escrow-encrypted (Section 7) and monitored (Section 8), it is essential the public-read exception can never match a private conversation; the enumerated four-part test (§1.2) is intentionally conjunctive (all must hold) and `adminonly`/`corponly` are explicit disqualifiers so an admin or corporate space is never publicly readable even inside a public community.
- **Corp spaces stay private.** A `corponly` space (corporate-members-only, per the 017 delta) is PRIVATE/CLOSED regardless of community discoverability, so org-restricted discussion is never exposed to arbitrary signed-in users.

**Open questions:**
- Public-space READ scope: does the public-read exception cover ONLY history via REST GET /api/engine/conversations/[id]/messages, or also any other read surface (e.g. a public space's member directory / space metadata)? Section 1 scopes it to message history only; confirm no other non-member read surface is intended.
- Should the public-read GET be paginated/rate-limited differently for non-members than for members (anti-scrape), given non-members can enumerate public-space history without joining?
- Do we want a denormalized conversations.accesstier cache column (public|private) to avoid the community+space join on every read-gate check, or is deriving the tier per-request acceptable for v1?
- Is a public space's history readable by non-members retroactively without limit (full backlog), or should non-member reads be capped to a recent window until they join? Section 1 currently implies full history read.
- Broadcast spaces (spec 017 FR-011): in a PUBLIC broadcast space, non-members may READ per this section, but posting is already owner/mod-only even for members — confirm join-to-post + broadcast-posting-role compose as expected (join grants read/live, but only owner/mod may post).


---

## [spec 018] Spec 018 delta — Contacts graph rework: immutable request records, one-active-per-pair, 24h decline retention, immediate re-request

## Section 2 — Contacts graph rework (spec 018)

**Spec:** 018 — Contacts & Direct Messages
**Status:** PROPOSAL (approve before code)
**Supersedes:** the pair-unique / mutate-in-place model of current FR-001.

### Rationale

The current `contacts` table enforces a **unique index on the ordered pair** `(requesterid, addresseeid)` and, on re-request, **mutates the existing row in place** (`requestContact` flips a `declined` row back to `pending`; `contactBetween` treats any row in either direction as *the* relationship). This makes the relationship a single mutable cell rather than an auditable event log, loses decline history, and couples "who is connected" to "which single row exists." This section reworks the graph so that **each contact request is a unique, immutable record**, connection is derived from the presence of an accepted record, and re-requesting after a decline is a first-class, immediate, benign action rather than an in-place status flip.

This is a **schema and behavior change** to FR-001 and the `contacts` table. It does not change the request-as-private-message delivery (FR-002), the DM send-gate (FR-003), group chat (FR-004), or email invites (FR-006), except where those read the contact relationship (which now reads "an accepted record exists" instead of "the row's status").

---

### Revised data model — `contacts` table

Per project DB conventions (lowercase plural table; PK `id` uuid v7; FK = parent name + `id`; lowercase columns; no separators). The row is now an **immutable request event**; its *lifecycle* is captured by `status` + `respondedat`, but a row is never resurrected from `declined` back to `pending` — a new decline/re-request produces a **new row**.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` (v7) PK | One per request event. |
| `requesterid` | `uuid` NOT NULL → `users.id` (on delete cascade) | Who asked. |
| `addresseeid` | `uuid` NOT NULL → `users.id` (on delete cascade) | Who was asked; the only one who may accept/decline. |
| `status` | enum `contactstatus` (`pending` \| `accepted` \| `declined`) NOT NULL default `pending` | A row moves `pending` → (`accepted` \| `declined`) exactly once and is then terminal. |
| `conversationid` | `uuid` NULL | The 1:1 conversation carrying the connect request + DM thread (unchanged semantics). |
| `createdat` | `timestamptz` NOT NULL default now() | Request time. |
| `respondedat` | `timestamptz` NULL | Accept/decline time; also the anchor for the 24h decline purge. |

**Index changes (MUST):**

- **DROP** `uniqueIndex("contacts_pair_key").on(requesterid, addresseeid)` — the ordered-pair unique index. Multiple immutable rows per pair are now expected (e.g. a declined row + a later pending row).
- **KEEP** `contacts_addressee_idx` on `addresseeid` and `contacts_requester_idx` on `requesterid`.
- **ADD** a **partial unique index** enforcing at-most-one-active row per **unordered** pair. Because Postgres cannot directly index an unordered pair, the table MUST carry a derived, canonical unordered-pair key and index it:
  - Add columns `usera uuid NOT NULL` and `userb uuid NOT NULL` where `usera = LEAST(requesterid, addresseeid)` and `userb = GREATEST(requesterid, addresseeid)` (canonical ordering, computed at insert; direction still preserved via `requesterid`/`addresseeid`).
  - Add `uniqueIndex("contacts_active_pair_key").on(usera, userb).where(sql`status IN ('pending','accepted')`)` — a **partial** unique index whose predicate matches only active rows. `declined` rows are excluded and may therefore accumulate as history.
  - **Alternative (Open Question OQ-A):** enforce the invariant in application code inside a transaction instead of a partial unique index. The index is the recommended belt-and-suspenders; either way the invariant is normative.

**Enum change:** none — `contactstatus` (`pending`,`accepted`,`declined`) is unchanged.

**Backfill (migration):** for every existing row, set `usera = LEAST(requesterid, addresseeid)`, `userb = GREATEST(...)`. If any pair currently holds more than one active row after backfill (should not, given today's unique index), the migration MUST fail loudly for manual reconciliation rather than silently dropping data.

---

### Functional Requirements

Fresh FR numbers within this section; all belong to **spec 018** and **revise FR-001**.

**FR-2.1 (018) — Immutable request records.**
Each contact request MUST be persisted as a new, immutable `contacts` row. The system MUST NOT mutate `requesterid`, `addresseeid`, or `createdat` of an existing row to represent a new request. A row's `status` MUST transition at most once, from `pending` to exactly one terminal value (`accepted` or `declined`), together with a single `respondedat` write; after that the row is immutable. (Replaces today's behavior where `requestContact` flips a `declined` row back to `pending` and rewrites its `conversationid`.)

**FR-2.2 (018) — Drop the ordered-pair unique constraint.**
The unique index `contacts_pair_key` on `(requesterid, addresseeid)` MUST be dropped. The schema MUST permit multiple `contacts` rows for the same unordered pair over time (e.g. one `declined` history row plus one newer `pending` row).

**FR-2.3 (018) — At-most-one-active invariant.**
For any unordered pair of users, at most **one** row with `status IN (pending, accepted)` MUST exist at any instant. This invariant MUST be enforced by the `contacts_active_pair_key` partial unique index (or an equivalent transactional guard per OQ-A). A write that would create a second active row for a pair MUST fail (and, per FR-2.7, be treated idempotently rather than surfaced as a hard error to the user).

**FR-2.4 (018) — "Connected" is derived from an accepted record.**
Two users MUST be considered **connected** if and only if a `contacts` row exists between them (either direction) with `status = accepted`. All relationship reads — `areContacts`, `contactBetween`, the DM send-gate (FR-003), the group-chat contact check (FR-004), and reachable-set/search filters — MUST derive connection from "an accepted row exists," not from "the single pair row's current status." A pending or declined row MUST NOT imply connection.

**FR-2.5 (018) — Declined rows are short-term, purgeable history.**
A `declined` row MUST be retained as history and MUST become purgeable **24 hours** after its `respondedat`. The system MUST purge eligible declined rows via either (a) a scheduled cleanup pass or (b) lazy purge on next access to that pair — implementer's choice; both are acceptable. Declined rows MUST NOT count toward the at-most-one-active invariant (they are excluded from the active-pair index). Purging a declined row MUST NOT affect any active (`pending`/`accepted`) row for the same pair, nor delete the underlying conversation or its messages.

**FR-2.6 (018) — Re-request after decline is immediate and plain.**
After a request is declined, either user MUST be able to send a **new** contact request to the other **immediately** — no cooldown, no re-request flag, and no special "they declined you before" phrasing. A re-request MUST create a **new** `pending` row (with a fresh `id`, fresh `createdat`, and its own `conversationid` resolution) and MUST deliver the standard plain "wants to connect" private message (FR-002). The prior `declined` row MUST remain untouched as 24h history. The system MUST NOT expose, to either party, whether a prior decline occurred.

**FR-2.7 (018) — Idempotent duplicate suppression.**
If an **active pending** row already exists for the pair in the same direction (requester → addressee) when a request is issued, the system MUST NOT create a duplicate row and MUST NOT post a second "wants to connect" message; it MUST return the existing pending request idempotently. If an **accepted** row already exists for the pair, a request MUST be a no-op that returns the existing connection (and its conversation), never a new pending row (preserving today's `existing.status === "accepted"` short-circuit). If an active pending row exists in the **opposite** direction (the other user already asked first), the system MUST treat this as the addressee attempting to connect back and SHOULD surface/accept the incoming request rather than creating a competing pending row (see OQ-B).

**FR-2.8 (018) — Accept/decline authority unchanged (no-change, restated).**
Only the `addresseeid` of a `pending` row MAY accept or decline it (verified non-bug from `respondToContact`). Accepting sets that row's `status = accepted` + `respondedat`; declining sets `status = declined` + `respondedat`. Neither transition may occur on a row that is not `pending`.

---

### Acceptance Criteria

- [ ] The migration drops `contacts_pair_key`, adds `usera`/`userb` (canonical `LEAST`/`GREATEST`), backfills existing rows, and adds the partial unique index `contacts_active_pair_key` on `(usera, userb) WHERE status IN ('pending','accepted')`. Migration is generated as SQL (not auto-applied) per project convention.
- [ ] Two distinct rows can coexist for one pair: one `declined` and one later `pending`. Attempting to insert a **second active** (`pending`/`accepted`) row for the same unordered pair fails at the DB (or transactional guard).
- [ ] `requestContact` on a pair with **no active row** creates exactly one new `pending` row and posts exactly one "wants to connect" private message.
- [ ] `requestContact` on a pair with an **existing pending** row (same direction) returns the existing request, creates **no** new row, and posts **no** second message (idempotent).
- [ ] `requestContact` on a pair with an **accepted** row returns the existing connection + conversation and creates no new row.
- [ ] Decline sets `status='declined'` + `respondedat` on that row only; the row is not deleted immediately.
- [ ] Immediately after a decline (0-second wait), the same requester can re-request; a **new** `pending` row is created, the old `declined` row is unchanged, and the message body is the plain "wants to connect" text (no re-request/declined-before wording).
- [ ] 24h+ after `respondedat`, a `declined` row is eligible for purge and is removed by the cleanup pass or on next lazy access; a `declined` row younger than 24h is retained.
- [ ] Purging a declined row leaves any active row for the same pair, and the pair's conversation + messages, intact.
- [ ] `areContacts(a,b)` returns true iff an `accepted` row exists between them (either direction); it returns false when only `pending` or `declined` rows exist. The DM send-gate (FR-003) and group-chat check (FR-004) behave accordingly.
- [ ] No code path resurrects a `declined` row to `pending` (in-place status flip is removed).

---

### Security / Privacy notes

- **No decline disclosure.** The re-request path (FR-2.6) and duplicate-suppression path (FR-2.7) MUST NOT leak whether a prior decline exists, to either party. Both a first request and a re-request produce the identical plain "wants to connect" experience; the presence/absence of a `declined` history row is never observable by users via API responses, message text, timing, or error codes.
- **History minimization.** Declined rows are deliberately **short-lived** (24h) to limit retained data about rejected connection attempts; the purge is a privacy control, not merely cleanup, and MUST run.
- **Invariant is a safety gate, not just correctness.** The at-most-one-active constraint prevents duplicate pending rows that could be exploited to flood a target with repeated "wants to connect" notices; it composes with the contact-request flood guard (section 5). Duplicate suppression (FR-2.7) MUST return idempotently rather than erroring, so the flood guard — not a raw DB error — remains the mechanism that throttles abusive senders.
- **Directional data retained for audit.** Even though "connected" is symmetric, `requesterid`/`addresseeid` (and thus "who asked whom") are preserved on every immutable row, supporting later moderation/audit review without inferring direction from a mutated cell.
- **Block interaction (forward reference).** When section 4's `contactblocks` is added, re-request (FR-2.6) MUST be checked against an active block first: a blocked user MUST NOT be able to create a new pending row toward the blocker (fails generically, no "blocked" signal). This section assumes that check is layered in `requestContact` per section 4.

**Open questions:**
- OQ-A (018 §2): Enforce the at-most-one-active invariant via a Postgres partial unique index on a canonical (usera,userb) pair key, or via an application-level transactional guard only? Proposal recommends the partial unique index as the authoritative guard, with the transaction wrapping the read-then-insert as belt-and-suspenders. Product owner to confirm the extra usera/userb columns are acceptable.
- OQ-B (018 §2): When user A has an active pending request to B and B then initiates a request to A (opposite direction), what is the exact behavior? Options: (i) auto-accept A's pending request (mutual intent → connect immediately), or (ii) surface B's pending as an incoming acceptance prompt, or (iii) reject B's new request as a duplicate-in-opposite-direction. Proposal leans toward (i) auto-accept as mutual intent, but this changes the accept-authority model (FR-2.8 says only the addressee accepts) and needs an explicit decision.
- OQ-C (018 §2): Decline retention is fixed at 24h. Should this be env-tunable like the flood-guard window (section 5), or is 24h a hard product/privacy commitment? Also: should the purge be a scheduled cleanup pass, lazy-on-access, or both — and does the product owner want the purge cadence surfaced anywhere (e.g. privacy policy)?
- OQ-D (018 §2): Does each new re-request row get a fresh 1:1 conversation, or does it reuse the pair's existing conversationid (which may already hold prior request/decline system messages)? Current getOrCreateDirectConversation reuses one conversation per pair; reusing it means a re-request's 'wants to connect' notice appears in a thread that may show the earlier declined notice — confirm that is acceptable given the no-decline-disclosure privacy note.


---

## [spec 018] Spec 018 Delta — Contact Invites: Email-Bound + Consume-First Atomic Accept (revised FR-006)

## Section 3 — Contact invites: email-bound + consume-first atomic accept (spec 018)

Revises **spec 018 FR-006** ("Email invite for non-users"). The `contactinvites` table and the invite-send path (`inviteContactByEmail`) are unchanged in intent; the change is to the **accept** path (`acceptContactInvite`), which today (a) does **not** verify that the accepting user owns the invited email — any signed-in user who obtains the link becomes an accepted contact of the inviter (bearer-token semantics), and (b) performs a **check-then-act** consume (read row → test `consumedat` in app code → write `consumedat` at the end), which lets two concurrent accepts of the same token both pass the check and both create a contact / claim the invite.

This section resolves spec 018 **Open Question OQ-1** ("Invite binding — bearer token vs. bound to exact email") in favor of **email-binding**, and hardens the accept against the concurrent double-accept race with a **consume-first atomic** claim.

### Functional Requirements

**FR-006 (spec 018) — Email invite for non-users (REVISED)**
`inviteContactByEmail(inviter, email)` is unchanged: if a user with that (normalized) email exists → `requestContact`; otherwise create a `contactinvites` row (hashed token, 7-day expiry) and send an SES invite linking `/invite/contact/{token}`. The **accept** step (`acceptContactInvite`) MUST enforce the two new invariants defined in FR-006a and FR-006b below. On successful accept the system creates (or upgrades to) an **accepted** contact row between inviter and accepter and get-or-creates the 1:1 DM conversation, exactly as today.

**FR-006a (spec 018) — Invite is email-bound; only the invited email may accept**
1. The system MUST reject `acceptContactInvite` when the accepting user's account email does **not** equal the invite's `email`, compared **case-insensitively** (both sides normalized: trimmed + lowercased). The rejection MUST return a distinct, user-facing reason — "this invite was sent to a different email" — separable in the API layer from other failure modes (expired, already-used, not-found, self-invite).
2. The system MUST NOT create, upgrade, or otherwise mutate any `contacts` row, and MUST NOT create or attach a DM conversation, when the email does not match.
3. The system MUST NOT consume (set `consumedat` on) the invite when the email does not match — a mismatched attempt leaves the invite still claimable by the correct recipient. (An email-mismatch attempt SHOULD be recorded to `authauditlog` as a rejected-invite-accept event for abuse visibility; see Security & Privacy.)
4. The self-invite guard MUST remain: an inviter cannot accept their own invite (`inv.inviterid === userid` → reject). This is retained from the existing implementation and is independent of the email check.
5. The pre-existing expiry and single-use guards MUST remain: an invite whose `expiresat` is in the past MUST reject as expired; an invite already consumed MUST reject as already-used (see FR-006b for how "already consumed" is determined atomically).
6. Because acceptance is now bound to the invited email, sign-up MUST route through the invited email for the auto-connect to succeed: a user who signs up with (or is signed in under) a **different** email and opens the link is rejected per FR-006a.1 and is NOT connected. (See Open Question OQ-A for the "wrong email while signed in" UX.)

**FR-006b (spec 018) — Consume-first atomic accept (concurrent double-accept safety)**
1. `acceptContactInvite` MUST claim the invite with a single **conditional, atomic** update that both consumes and guards single-use in one statement — semantically: `UPDATE contactinvites SET consumedat = now() WHERE id = :id AND consumedat IS NULL` — and MUST branch on the number of rows actually affected.
2. Only the caller whose conditional update affected **exactly one row** ("the winner") MAY proceed to create/upgrade the `contacts` row and create/attach the DM conversation. A caller whose update affected **zero rows** ("the loser", i.e. the invite was already consumed) MUST return the already-used result and MUST NOT create or mutate any contact or conversation.
3. The email-match check (FR-006a) MUST be evaluated **before** the consuming update is attempted, so a mismatched accept never consumes the invite (satisfying FR-006a.3). Ordering: load invite → not-found/expired/self-invite/email-mismatch checks → conditional consume → winner-only contact + conversation creation.
4. The contact upsert performed by the winner MUST remain idempotent with the rest of the graph: if an active row already exists between the pair it is upgraded to `accepted`; otherwise a new `accepted` row is inserted (consistent with the contacts-graph invariant of at most one active row per unordered pair — cross-referenced to Section 2 of this delta).
5. The consume and the contact/conversation creation SHOULD execute within a single database transaction so that a failure after consuming does not strand a consumed-but-unconnected invite. If a post-consume failure is nevertheless possible, the invite is treated as spent (fail-closed); the accepter may be re-invited. (See Open Question OQ-B.)

### Data-model changes

**No schema change is required for FR-006/006a/006b.** The existing `yappchat.contactinvites` table already carries the columns the revised behavior needs:

`yappchat.contactinvites`
- `id` uuid PK (uuid v7)
- `inviterid` uuid NOT NULL → `users.id` (ON DELETE cascade)
- `email` text NOT NULL — the invited email; **now load-bearing** as the binding target for accept (compared case-insensitively against the accepter's `users.email`). Values MUST continue to be stored normalized (trimmed + lowercased) on insert, as they are today.
- `tokenhash` text NOT NULL — unique index `contactinvites_tokenhash_key`
- `expiresat` timestamptz NOT NULL — 7-day TTL
- `consumedat` timestamptz NULL — the single-use / atomic-claim guard; the conditional consume keys on `consumedat IS NULL`
- `createdat` timestamptz NOT NULL default now()
- Indexes: unique(`tokenhash`), index(`inviterid`) — unchanged.

Notes on conventions (per project DB rules — tables lowercase+plural, PK `id` uuid v7, FK = parentname+`id`, columns lowercase): the table already conforms. `consumedat IS NULL` is a partial-uniqueness-free guard enforced by the conditional UPDATE rather than a constraint; no new index is required because lookups are by `tokenhash` (already unique-indexed) and the claim is a single-row conditional update on the PK.

Optional (non-blocking) hardening, deferred to an Open Question: a `consumedby` uuid NULL → `users.id` column recording which account claimed the invite, for audit/forensics. Not required for FR-006a/006b. See OQ-C.

### Acceptance Criteria

Email-binding (FR-006a):
- [ ] Accepting an invite while signed in as the **invited** email (case-insensitive: e.g. invite to `Jane@X.com`, account email `jane@x.com`) succeeds and creates an `accepted` contact + the 1:1 DM.
- [ ] Accepting an invite while signed in as a **different** email is rejected with the reason "this invite was sent to a different email", distinct from expired/already-used/not-found.
- [ ] A mismatched accept leaves `consumedat` NULL and creates **no** `contacts` row and **no** conversation; the correct recipient can subsequently accept the same still-valid invite successfully.
- [ ] The inviter accepting their own invite is still rejected (self-invite guard).
- [ ] An expired invite (`expiresat` in the past) is rejected as expired even when the email matches.
- [ ] A rejected email-mismatch accept writes an `authauditlog` entry (rejected invite-accept) capturing the attempting user and the invite id.

Consume-first atomic (FR-006b):
- [ ] Two concurrent `acceptContactInvite` calls for the same token, both by the correctly-invited email, result in **exactly one** `accepted` contact row (no duplicate contact, no duplicate DM conversation); one call returns success and the other returns already-used.
- [ ] A single sequential re-accept of an already-consumed invite returns already-used and mutates nothing.
- [ ] The consuming update is a single conditional statement (`... WHERE id=? AND consumedat IS NULL`); the loser's update affects zero rows and it does not proceed to create a contact/conversation.
- [ ] The email-match check runs **before** the consume, verified by the "mismatch leaves invite claimable" criterion above.
- [ ] Under concurrency where one caller has the wrong email and one has the right email, only the correctly-invited caller wins; the invite is consumed exactly once and the wrong-email caller is rejected with the email-mismatch reason.
- [ ] (If transaction-wrapped) A simulated failure after consume but before contact creation does not leave an `accepted` contact without its consume, nor a consumed invite with a partial contact — the pair is all-or-nothing.

### Security & Privacy notes

- **Closes an unsolicited-connection vector.** Today's bearer-token accept means anyone who obtains the link (forwarded email, shared inbox, leaked URL) can force a connection to the inviter. Email-binding ensures only the intended recipient can act on the invite, upholding the spec 018 "no cold connections / consent-based graph" guarantee end-to-end (the invite path was the gap).
- **Closes a double-accept / duplicate-graph race.** The consume-first conditional UPDATE removes the check-then-act window that could produce duplicate accepted contacts or duplicate DM conversations from concurrent link clicks (double-submit, retries, prefetch).
- **Minimal disclosure on failure.** The email-mismatch message states only that the invite was sent to a different address; it MUST NOT reveal the invited email or the inviter's identity to a non-matching accepter.
- **Audit.** Mismatched-accept attempts SHOULD be logged to `authauditlog` (attempting user + invite id, not the target email in plaintext beyond what policy allows) to surface link-harvesting or enumeration attempts to sysadmins.
- **Consistency with the flood/abuse posture.** Because a leaked link can no longer be redeemed by an arbitrary account, this reduces the invite surface available to the contact-request flood/abuse paths described elsewhere in this delta (Section 5).

**Open questions:**
- OQ-A (FR-006a) — Wrong-email-while-signed-in UX: when a user opens an invite link while signed in under an email that does not match, do we (a) hard-reject with the mismatch message only, (b) offer a sign-out + sign-in-as-invited-email flow, or (c) allow the invited email to be added/verified on the current account before accepting? Proposal defaults to (a) hard-reject; (b)/(c) are UX enhancements needing product sign-off.
- OQ-B (FR-006b) — Post-consume failure semantics: if the atomic consume succeeds but the subsequent contact/conversation creation fails and is NOT transaction-wrapped, the invite is spent (fail-closed) and the accepter must be re-invited. Confirm transaction-wrapping is in scope (preferred) vs. accepting fail-closed re-invite as the recovery path.
- OQ-C (data model) — Add an optional `consumedby` uuid (→ users.id) column to `contactinvites` recording which account claimed the invite, for audit/forensics? Not required by FR-006a/006b; purely additive hardening.
- OQ-D — Should an invite sent to an email that LATER becomes a registered account under a different-cased or aliased address (plus-addressing, dotted Gmail) be considered a match? Proposal compares exact normalized (trim+lowercase) equality only; provider-specific alias normalization is explicitly out of scope unless product wants it.


---

## [spec 018] Block / Unfriend (spec 018 §4)

## 4. Block / Unfriend (spec 018 — Contacts & Direct Messages)

Two distinct relationship-severing actions on the contacts graph:

- **Block** — one-directional, silent, defensive. A blocks B. B gets no signal; B's reach into A collapses. Also removes any active contact between them.
- **Unfriend** — symmetric, mutual. Closes an accepted contact row. Neither side is now a contact; DM send-gating re-applies. The initiator is prompted to KEEP or DELETE the shared DM history (KEEP is the guided default for legal/records reasons).

These build on the §2 contacts-graph rework (unique-immutable rows, at-most-one-active-per-pair invariant) and the §5 flood guard. Block and unfriend are the first features that can *remove* an active contact, which is why §9 (transaction-wrap `createGroupChat`) becomes load-bearing.

### 4.1 Data model changes

#### New table: `contactblocks` (spec 018)

One-directional block records. A row `(blockerid → blockedid)` means the blocker has blocked the blocked user. Reciprocal blocks are two separate rows.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, uuid v7 | Per DB conventions |
| `blockerid` | `uuid` | NOT NULL, FK → `users.id` ON DELETE CASCADE | The user who blocked |
| `blockedid` | `uuid` | NOT NULL, FK → `users.id` ON DELETE CASCADE | The user who was blocked (never notified) |
| `createdat` | `timestamptz` | NOT NULL, default now() | When the block was placed |

Indexes / constraints:
- `uniqueIndex contactblocks_pair_key on (blockerid, blockedid)` — at most one active block per ordered pair; makes block idempotent.
- `index contactblocks_blocker_idx on (blockerid)` — list "who I've blocked".
- `index contactblocks_blocked_idx on (blockedid)` — reverse lookup used by gates (is caller blocked BY the target).
- CHECK / service-level guard: `blockerid <> blockedid` (no self-block).

No new columns are added to `contacts` for block; a block is an independent record and unblock is a hard DELETE of the row (§4.5). Unblocking leaves no residue.

#### `contacts` — reuse existing `declined` status for unfriend + keep-history

Unfriend closes the accepted row rather than deleting it, so the pair's history/audit trail survives even when history is kept. To keep the model minimal:

- Unfriend sets the accepted row's `status` from `accepted` → `declined` and stamps `respondedat = now()`. This satisfies the §2 invariant ("at most ONE active — pending OR accepted — row per unordered pair"): a `declined` row is inactive, so either party may immediately re-request (creating a NEW pending row per §2), and the closed row is a §2-purgeable 24h history record.
- No dedicated `unfriended` enum value is required; `declined` already means "inactive, purgeable history." (Open Question OQ-018-B: whether a distinct status is wanted for analytics.)

The DM conversation itself is NOT closed by a status change — its lifecycle is governed by the KEEP/DELETE choice (§4.4), applied to the `conversations` row + its `messages`.

### 4.2 Functional Requirements — BLOCK

- **FR-018-40 (spec 018) — MUST provide a one-directional block.** The system MUST expose `blockContact(blockerid, blockedid)`. It MUST insert a `contactblocks` row `(blockerid, blockedid)` if none exists, and MUST be idempotent (a second block of the same target MUST NOT create a duplicate row and MUST NOT error). It MUST reject a self-block (`blockerid === blockedid`) with `cannot_self_block` (400).

- **FR-018-41 (spec 018) — Block MUST remove any active contact.** On block, if an active (`pending` or `accepted`) `contacts` row exists between the pair (either direction), the system MUST close it in the SAME transaction as the `contactblocks` insert (set `status = 'declined'`, `respondedat = now()`). After block, the pair MUST NOT be "connected" and DM send-gating MUST re-apply. The blocker's DM history with the blocked user MUST be handled per FR-018-42 (block does NOT auto-prompt KEEP/DELETE — see that FR).

- **FR-018-42 (spec 018) — Block MUST default to retaining DM history.** Unlike unfriend, block MUST NOT surface a KEEP/DELETE prompt to the blocker (blocking is a defensive action that must not be gated on a records decision). The existing DM conversation and its messages MUST be retained by default (read-only for both parties, sending re-gated by FR-018-41). The blocker MAY separately delete the conversation via the standard delete-history affordance (§4.4 mechanics), which MUST still honor any legal-hold constraint.

- **FR-018-43 (spec 018) — Block MUST be SILENT to the blocked user.** The system MUST NOT emit any signal, notification, system message, WS event, or distinguishable error that reveals to B that A has blocked them. All B-side failures caused by the block (FR-018-44 through FR-018-48) MUST return the SAME generic outcome B would see for an ordinary "not connected / not reachable" condition — the block MUST NOT be distinguishable from A simply not being a contact or not existing in B's reachable set.

- **FR-018-44 (spec 018) — Block MUST gate contact requests (`requestContact`).** While a block `(A → B)` is active, `requestContact(B, A)` MUST fail generically (treated as if A is not reachable — reuse the existing `cannot_self_contact`/not-reachable class of generic error, NOT a block-specific code) and MUST NOT create a `contacts` row, MUST NOT open/reuse a conversation, and MUST NOT post a "wants to connect" system message. A's inbound request path toward B is unaffected by *A's own* block (a blocker may still, if they choose, be limited — see FR-018-49).

- **FR-018-45 (spec 018) — Block MUST gate direct messages (`sendMessage`, `kind === 'person'`).** The existing `person`-conversation DM gate in `sendMessage` (currently: require an `accepted` contacts row, else `not_connected` 403) MUST additionally reject when a block exists in EITHER direction between the two conversation members. Because FR-018-41 already downgrades the contact to `declined` on block, the standard `not_connected` (403) generic error already fires for the ordinary send path; the block check MUST ALSO cover any residual/edge path so that B can never message A. The returned error for B MUST be the generic `not_connected` (403) — never a block-specific code (FR-018-43).

- **FR-018-46 (spec 018) — Block MUST gate group pull-in (`createGroupChat`).** A blocked user MUST NOT be able to pull the blocker into a group. `createGroupChat(blockerid_or_blockedid, memberIds)` MUST reject if any prospective member has an active block in EITHER direction with the creator. Combined with §9 (transaction-wrap validate-then-add), the block+contact check and the member-add MUST be atomic. Rejection MUST use the existing generic `not_a_contact` (403) class (a block removes the accepted contact per FR-018-41, so this is naturally covered; the explicit block check closes the case where a group is attempted against a still-`accepted` stale read).

- **FR-018-47 (spec 018) — Block MUST hide the blocker from the blocked user's reachable set (`searchUsers`).** People-search MUST exclude any user who has an active block against the caller. `searchUsers(q, selfId)` MUST filter out every `users` row `u` where a `contactblocks (u.id → selfId)` row exists. The existing 2-char minimum + self-exclusion (§10 / §11) MUST be preserved. The blocker MUST simply not appear in B's results — indistinguishable from "no such user."

- **FR-018-48 (spec 018) — Block MUST be checked by the flood guard.** The §5 contact-request flood guard MUST treat a block-gated `requestContact` attempt consistently: a blocked user's rejected requests toward the blocker MUST still count against that user's rolling contact-request rate (a block is not a free pass to hammer the endpoint). The block check runs after the §5 frozen-flag check (frozen check is FIRST per §5), so a frozen user is rejected for the freeze regardless of block state.

- **FR-018-49 (spec 018) — Block enforcement point set (normative enumeration).** The active-block predicate (a `contactblocks` row exists between the pair in the *relevant* direction) MUST be evaluated at ALL of the following points, and nowhere may a private-tier interaction between a blocked pair succeed:
  1. `requestContact` — reject B→A request (FR-018-44). Direction: block by A→B blocks B's request to A.
  2. `sendMessage` (`person` kind) — reject a DM in either direction between the pair (FR-018-45). Direction: block in EITHER direction blocks both directions of DM.
  3. `createGroupChat` — reject pulling a blocked-pair member in (FR-018-46). Direction: block in EITHER direction.
  4. `searchUsers` — exclude the blocker from the blocked user's results (FR-018-47). Direction: block by A→B hides A from B.
  5. §5 flood guard — a blocked request still counts toward the rate (FR-018-48).
  Each new private-tier reachability path added later MUST also consult this predicate; §6 (@mention→PM) MUST route through `requestContact`/`sendMessage` and therefore inherits gates (1) and (2).

### 4.3 Functional Requirements — UNBLOCK

- **FR-018-50 (spec 018) — MUST allow unblock.** The system MUST expose `unblockContact(blockerid, blockedid)`, which MUST hard-DELETE the `contactblocks (blockerid, blockedid)` row. Unblock MUST be idempotent (deleting a non-existent block MUST NOT error). Only the blocker MAY unblock their own block (the caller MUST equal `blockerid`); a request to unblock a row the caller does not own MUST fail `forbidden` (403).

- **FR-018-51 (spec 018) — Unblock MUST NOT auto-restore the contact.** Removing the block MUST NOT recreate or re-accept any previously-closed `contacts` row. The pair returns to a neutral, unconnected state; re-connecting requires a fresh `requestContact` per §2 (new pending row). Unblock MUST NOT notify the previously-blocked user.

### 4.4 Functional Requirements — UNFRIEND

- **FR-018-52 (spec 018) — MUST provide symmetric unfriend.** The system MUST expose `unfriendContact(userid, otherid, historyChoice)`. Either party of an `accepted` pair MAY unfriend (the caller MUST be `requesterid` OR `addresseeid` of the accepted row; otherwise `forbidden` 403). If no `accepted` row exists between the pair, unfriend MUST fail `not_a_contact` (404/403). Unfriend MUST set the accepted row `status = 'declined'`, `respondedat = now()`. After unfriend the pair MUST NOT be "connected," and DM send-gating MUST re-apply to their `person` conversation.

- **FR-018-53 (spec 018) — Unfriend MUST prompt KEEP or DELETE of DM history, KEEP as the guided default.** The initiator MUST be prompted to choose KEEP or DELETE for the shared DM conversation, and the UI MUST present KEEP as the pre-selected/default option. `historyChoice` MUST be one of `keep` | `delete` and MUST be required (the service MUST NOT silently pick). Where a legal-hold / records-retention constraint applies (Open Question OQ-018-A), DELETE MUST be disabled and KEEP MUST be forced.

- **FR-018-54 (spec 018) — KEEP MUST make the conversation read-only.** On `historyChoice = 'keep'`, the `person` conversation and its messages MUST be retained. The conversation MUST become read-only: send-gating (already re-applied via the `declined` status, FR-018-52) MUST prevent new messages, and the client MUST render the thread as archived/read-only. Both parties retain read access to the retained history unless/until a subsequent delete or block-driven action changes it. KEEP MUST be the option chosen when records/legal retention is required.

- **FR-018-55 (spec 018) — DELETE MUST remove the conversation and its messages.** On `historyChoice = 'delete'`, the system MUST delete the `person` conversation (cascading its `messages`, `messagedeliveries`, and `conversationmembers`) via the existing `deleteConversation` path, and MUST clear/null the `conversationid` on the closed `contacts` row so no dangling reference remains. DELETE MUST be refused (falling back to KEEP) when a legal-hold applies (OQ-018-A). Deletion is irreversible.

- **FR-018-56 (spec 018) — Unfriend/decline MUST NOT block re-request.** After unfriend (row now `declined`), either party MAY immediately `requestContact` the other per §2 (no cooldown, plain "wants to connect" message, NEW pending row; the closed row remains as 24h-purgeable history). Re-request MUST be gated only by an active `contactblocks` row (FR-018-44) — unfriend alone MUST NOT prevent reconnection.

### 4.5 Interaction / precedence rules

- **FR-018-57 (spec 018) — Block supersedes contact state.** If a pair is simultaneously subject to a block and a (stale) contact row, the block MUST win at every gate in FR-018-49. A user MUST NOT be able to send DMs, request contact, be pulled into a group, or discover the other via search while any block between them is active, regardless of contact status.

- **FR-018-58 (spec 018) — Mutual block is allowed.** Both `(A → B)` and `(B → A)` block rows MAY coexist. Unblocking one direction MUST NOT remove the other. DM/group gates that check "either direction" (FR-018-45, FR-018-46) MUST remain blocked while at least one direction's block is active.

### 4.6 Acceptance Criteria

Block:
- [ ] `blockContact(A, B)` inserts exactly one `contactblocks (A→B)` row; calling it again is a no-op (no duplicate, no error).
- [ ] `blockContact(A, A)` is rejected `cannot_self_block` (400).
- [ ] Blocking B when A–B are accepted contacts closes the `contacts` row to `declined` in the same transaction; A–B are no longer "connected."
- [ ] Block does NOT prompt A for KEEP/DELETE; the DM history is retained (read-only) by default.
- [ ] B receives NO notification, system message, or WS event when A blocks B.
- [ ] With `(A→B)` active, `requestContact(B, A)` fails with the generic not-reachable error, creates no `contacts` row, opens no conversation, posts no "wants to connect" message.
- [ ] With a block active in either direction, `sendMessage` on the A–B `person` conversation is rejected `not_connected` (403) for both A and B; the error is indistinguishable from an ordinary unconnected pair.
- [ ] `createGroupChat` refuses to include a member who has an active block (either direction) with the creator; the validate-and-add is atomic (§9) — a concurrent unfriend/block cannot slip a blocked member in.
- [ ] `searchUsers(q, B)` never returns A while `(A→B)` block is active; the 2-char minimum and self-exclusion still hold.
- [ ] A blocked user's rejected `requestContact` attempts still count toward the §5 flood-guard rate; a frozen user is rejected for the freeze first, regardless of block.

Unblock:
- [ ] `unblockContact(A, B)` deletes the `(A→B)` row; a second call is a no-op (no error).
- [ ] A non-owner cannot unblock a block they do not own (`forbidden` 403).
- [ ] Unblock does NOT restore/re-accept any previous contact and does NOT notify B; reconnecting requires a fresh `requestContact`.
- [ ] With mutual blocks, unblocking one direction leaves the other active; DM/group gates stay blocked.

Unfriend:
- [ ] Either party of an accepted pair can unfriend; a non-party is `forbidden` (403); unfriending a non-accepted pair fails.
- [ ] Unfriend sets the accepted row to `declined` + `respondedat`; the pair is no longer connected; DM send-gating re-applies.
- [ ] The unfriend UI presents KEEP pre-selected as the default; `historyChoice` is required (no silent default in the service).
- [ ] KEEP retains the conversation + messages read-only; neither party can send; both can still read.
- [ ] DELETE removes the conversation + its messages/deliveries/members and nulls `conversationid` on the closed contact row.
- [ ] DELETE is disabled/forced-to-KEEP when a legal-hold applies (per OQ-018-A resolution).
- [ ] After unfriend, either party can immediately re-request (new pending row, plain "wants to connect", no cooldown); re-request is blocked ONLY if an active `contactblocks` row exists.

### 4.7 Security / privacy notes

- **Silence is a security property, not just UX.** The generic-error requirement (FR-018-43) exists so a harasser cannot use error differentials to confirm they've been blocked and then evade it (e.g., via a second account). Every B-side failure MUST collapse to the pre-existing "not connected / not found" outcomes. Tests MUST assert error-code and timing parity between "blocked" and "merely unconnected/nonexistent" cases; introducing a distinct status code or message for the block path is a defect.
- **KEEP-history + at-rest encryption.** Retained (KEEP) `person` conversations remain private-tier and therefore stay escrow-encrypted at rest (§7) and subject to illegal-activity monitoring (§8) for their retained content; making a conversation read-only does NOT change its tier or its lawful-access exposure.
- **DELETE is irreversible and must respect legal hold.** DELETE cascades message rows; it MUST be blocked by any active retention/legal-hold (OQ-018-A) so a user cannot use unfriend-delete to destroy records subject to preservation. When held, the UI must clearly state why DELETE is unavailable.
- **Block is not a substitute for the flood guard.** Block gating and the §5 flood guard are independent controls; a blocked user's attempts still consume rate budget (FR-018-48) so block cannot be used to bypass anti-DoS accounting.
- **No enumeration via unblock.** `unblockContact` on a non-existent block is a silent no-op (FR-018-50) so the caller cannot probe block state through unblock responses.

**Open questions:**
- OQ-018-A: Legal-hold / records-retention source of truth for unfriend-DELETE and block-driven deletion. FR-018-53/55/54 require DELETE to be disabled and KEEP forced when a hold applies, but the mechanism that marks a conversation as held (per-org policy flag, a conversationholds table, a sysadmin-set flag, or company-context inheritance) is not yet specified. Needs a decision before implementing the KEEP/DELETE gate.
- OQ-018-B: Whether unfriend should use a distinct contacts.status value (e.g. 'unfriended') instead of reusing 'declined'. Reusing 'declined' keeps the §2 invariant and the 24h-purge behavior with no schema change, but conflates a decline of a pending request with the termination of an accepted friendship for analytics/audit. Confirm 'declined' reuse is acceptable, or add the enum value.
- OQ-018-C: Should a user be able to see and manage a list of who they've blocked (a block-management UI), and can the same screen show/undo unfriends? Section 4 specifies unblock but not whether the blocked-list is surfaced in the /chats or settings UI, nor whether blocking is initiated from a conversation, a profile, or a search result.
- OQ-018-D: When A blocks B mid-conversation and KEEP is the default for the retained thread, does B still see the historical thread as read-only on their side, or does the thread disappear from B's inbox entirely? FR-018-42 retains history read-only for both parties by default, but silence (FR-018-43) could argue for hiding it from B; the two goals need an explicit reconciliation.


---

## [spec 018] Contact-Request Flood Guard: Freeze, Notify, and Manual Sysadmin Unfreeze

## Section 5 — Contact-Request Flood Guard (anti-DoS freeze + notify + manual unfreeze)

**Owning spec: 018 (Contacts & Direct Messages).** Touches spec 011 (auth: `authauditlog`, `issystemadmin` set, SES mailer, `lib/auth/ratelimit.ts`) for the audit event, the sysadmin notification, and the shared rate-limit primitive.

### Rationale

Contact requests are the one contact-graph write a user can trigger against *arbitrary* other users without any prior relationship, and each request posts a "wants to connect" private message into a target's inbox. That makes it the natural spam/DoS vector: a single account (or a scripted account) can fan out thousands of requests, flooding inboxes and inflating the graph. Section 2's "re-request immediately after decline, no cooldown" rule (decided model) deliberately removes friction from the happy path, which raises the ceiling on abuse. This section adds a rolling-rate trip that **freezes the offending account's ability to send contact requests only** — the rest of the app keeps working — and holds that freeze until a system administrator manually reviews and clears it. This is intentionally a hard, human-gated stop (not an auto-expiring cooldown) so that a genuine flood forces a human look before the account can resume flooding.

---

### Functional Requirements

**FR-018-51 (Rolling-rate trip).** The system MUST count each *accepted attempt* by a user to send a contact request (`requestContact`, and any email-bound invite send that creates an outbound "wants to connect" record) against a rolling per-user window. The trip MUST fire when a user's count within the window meets or exceeds the configured threshold. The default threshold MUST be **10 contact requests per 60 seconds**, and both the count and the window MUST be tunable via environment variables (e.g. `CONTACT_FLOOD_LIMIT`, `CONTACT_FLOOD_WINDOW_MS`) WITHOUT a code change, mirroring the shape of the existing `lib/auth/ratelimit.ts` sliding-window limiter.

**FR-018-52 (Freeze on trip — contact requests only).** On a trip, the system MUST place the user into a **frozen** state that blocks *only* the sending of new contact requests. All other application capability (reading, posting to conversations they belong to, responding to inbound requests, community/DM activity, sign-in) MUST remain fully functional. The freeze MUST be a durable, server-side state (persisted per FR-018-57), NOT merely the in-memory rate-limit bucket — so it survives process restarts and cannot be cleared by simply waiting out a window.

**FR-018-53 (Frozen check is first, and is authoritative).** `requestContact` MUST check the frozen flag **before** any other work (before block checks, dedupe, invite creation, or message posting) and MUST reject with a stable, generic-but-honest error ("You are suspended from sending contact requests." / a `CONTACT_REQUESTS_FROZEN` error code) while the freeze is active. A frozen user MUST NOT be able to create any new contact/invite record or post any "wants to connect" message. The rejection MUST NOT leak the threshold value or how close other users are to a trip.

**FR-018-54 (Audit on trip).** When a freeze is applied, the system MUST write one `authauditlog` row with `eventtype = 'contact_flood'`, `userid` = the frozen user, and a `payload` capturing at least: the observed count, the configured limit, the window length, and the trip timestamp. This write MUST use the existing best-effort `writeAudit` path (a logging failure MUST NOT prevent the freeze itself from being applied). `authauditlog.eventtype` is free-form `text` today, so `'contact_flood'` requires no enum migration; the `AuthEventType` union in `lib/auth/audit.ts` SHOULD be extended to include it for type safety.

**FR-018-55 (Notify the frozen user).** On trip, and on every subsequent contact-request attempt while the freeze is active, the system MUST inform the user that they are suspended from sending contact requests and that a system administrator must review the suspension before it can be lifted. The message MUST NOT promise an automatic expiry (there is none — see FR-018-58). The at-trip notification and the on-subsequent-attempt rejection message MUST be consistent.

**FR-018-56 (Notify sysadmins via SES).** On trip, the system MUST notify the system administrators — every user with `users.issystemadmin = true` — via the existing SES mailer. The email MUST identify the frozen user (id + email/display name), the trip metrics (count/limit/window), the trip time, and a link/pointer to the sysadmin frozen-users review surface. The frozen user MUST additionally be **surfaced in-app** on that review surface (FR-018-59). SES failure MUST be logged but MUST NOT roll back the freeze; the in-app review surface is the durable source of truth so a lost email never leaves a freeze invisible.

**FR-018-57 (Persist the frozen state — data model).** The system MUST model the frozen state in a dedicated durable table, `contactfreezes` (see Data-Model Changes). An active (uncleared) row MUST mean "frozen from sending contact requests." At most one active freeze row MUST exist per user at a time (a re-trip of an already-frozen user MUST NOT stack a second active freeze; it MAY append audit/metrics but MUST leave the single active freeze in place).

**FR-018-58 (Held until manually cleared).** A freeze MUST NOT auto-expire and MUST NOT be lifted by the passage of time, by the rate-limit window resetting, by the user signing out/in, or by the user themselves. It MUST persist until a system administrator performs an explicit unfreeze action (FR-018-60). This is the deliberate divergence from the auth soft rate-limits, which do auto-recover.

**FR-018-59 (Sysadmin frozen-users review surface).** The system MUST provide a sysadmin-only surface that lists currently-frozen users with: user identity, freeze reason (`contact_flood`), trip metrics, frozen-at time, and the related `authauditlog` entries. Access MUST be gated on `users.issystemadmin = true`; no other role (org owner/admin, community owner/moderator, support) may view or act on freezes. Every load of decrypted/sensitive detail on this surface is out of scope here (no message plaintext is shown — this surface concerns *counts and identity*, not conversation content).

**FR-018-60 (Manual unfreeze action — audited).** The review surface MUST expose an **Unfreeze** action, available only to `issystemadmin` users, that marks the active `contactfreezes` row cleared (records who cleared it and when). After a successful unfreeze, the user MUST be able to send contact requests again immediately (the durable block is gone; the in-memory rolling window MAY need to reset for that user so a stale bucket does not immediately re-trip). Each unfreeze MUST write an `authauditlog` row with `eventtype = 'contact_unfreeze'`, `userid` = the unfrozen user, and a `payload` recording the acting sysadmin's id.

**FR-018-61 (No self-service and no privilege bypass).** A frozen user MUST NOT be able to unfreeze themselves through any endpoint. The unfreeze endpoint MUST re-verify `issystemadmin` server-side on every call (not merely hide the UI control). A non-sysadmin request to the unfreeze or review endpoints MUST be rejected (403).

**FR-018-62 (Interaction with block/flood ordering).** As stated in Section 4, blocks are checked in `requestContact`. The **frozen check (FR-018-53) MUST run before the block check and before dedupe**, so a flooding user is stopped at the door regardless of who they are targeting. The flood counter (FR-018-51) MUST count *attempts that reach `requestContact` and are not already frozen*; requests rejected purely because the sender is already frozen MUST NOT further increment the flood window (the user is already frozen — re-counting is redundant and could mask metrics).

---

### Data-Model Changes

New table **`contactfreezes`** (schema `yappchat`; kit DB conventions: lowercase plural table, `id` uuid v7 PK, FK = parent-name + `id`, lowercase columns, no separators). Modeled as an append-with-clear log rather than a boolean on `users` so that freeze history (repeat offenders) is preserved for sysadmin review and audit:

| column | type | notes |
|---|---|---|
| `id` | `uuid` PK | uuid v7 |
| `userid` | `uuid` NOT NULL | FK → `users.id`; the frozen user |
| `reason` | `text` NOT NULL | freeze cause; `'contact_flood'` for this section (kept as `text` to allow future freeze reasons without migration) |
| `triggercount` | `integer` NOT NULL | observed request count at trip |
| `triggerlimit` | `integer` NOT NULL | configured limit in force at trip |
| `windowms` | `integer` NOT NULL | configured window (ms) in force at trip |
| `createdat` | `timestamptz` NOT NULL DEFAULT now() | frozen-at |
| `clearedat` | `timestamptz` NULL | set on unfreeze; NULL ⇒ active freeze |
| `clearedby` | `uuid` NULL | FK → `users.id`; the sysadmin who unfroze |

Indexes / constraints:
- Index on `(userid)` for lookup.
- **Partial unique index** enforcing at most one *active* freeze per user: unique on `(userid)` `WHERE clearedat IS NULL` (satisfies FR-018-57's single-active invariant).
- Index on `(clearedat)` (or partial `WHERE clearedat IS NULL`) to list active freezes efficiently for the review surface.

"Is this user frozen?" = `EXISTS (SELECT 1 FROM contactfreezes WHERE userid = ? AND clearedat IS NULL)`.

No change to `authauditlog` schema is required (free-form `eventtype text`); two new event-type string values are introduced: `'contact_flood'` and `'contact_unfreeze'`.

**Configuration (no schema):** `CONTACT_FLOOD_LIMIT` (default `10`), `CONTACT_FLOOD_WINDOW_MS` (default `60000`). The in-memory rolling counter reuses the `lib/auth/ratelimit.ts` sliding-window primitive keyed per user (e.g. `contactflood:{userid}`); note this counter is per-node, so on a multi-node deployment the *durable* freeze (this table) is the real guard and the in-memory window is only the fast trip detector — a documented limitation matching the existing rate-limiter note, not a silent gap.

---

### Acceptance Criteria

- [ ] Sending contact requests up to `CONTACT_FLOOD_LIMIT − 1` within `CONTACT_FLOOD_WINDOW_MS` succeeds; the request that meets the threshold trips the freeze.
- [ ] The default threshold is 10 requests / 60s, and setting `CONTACT_FLOOD_LIMIT` / `CONTACT_FLOOD_WINDOW_MS` changes the trip point with no code change.
- [ ] On trip, exactly one active `contactfreezes` row exists for the user (`clearedat IS NULL`), with `reason='contact_flood'` and the trip metrics populated.
- [ ] A re-trip of an already-frozen user does NOT create a second active `contactfreezes` row (partial-unique enforced).
- [ ] While frozen, `requestContact` rejects with `CONTACT_REQUESTS_FROZEN` (or equivalent) and creates NO contact record and posts NO "wants to connect" message.
- [ ] The frozen check runs before the block check and before dedupe (verified by a frozen user targeting both a blocked-relationship and a fresh user — both rejected identically as frozen).
- [ ] A rejection because the sender is already frozen does NOT further increment the flood counter.
- [ ] While frozen, the user can still read messages, post into conversations they belong to, respond to inbound contact requests, and sign in (only outbound contact requests are blocked).
- [ ] The freeze survives a server/process restart and survives the rolling window resetting — it is not lifted by time.
- [ ] On trip, an `authauditlog` row with `eventtype='contact_flood'` is written for the user, including count/limit/window/timestamp in `payload`; an audit-write failure does not prevent the freeze.
- [ ] On trip, the user receives a "suspended from sending contact requests — awaiting sysadmin review" message, and receives a consistent message on each subsequent request attempt while frozen.
- [ ] On trip, every `issystemadmin` user is emailed via SES with the frozen user's identity, trip metrics, and a pointer to the review surface; SES failure is logged but does not roll back the freeze.
- [ ] The frozen user appears on the sysadmin-only frozen-users review surface with identity, reason, metrics, frozen-at, and linked audit entries; a non-sysadmin cannot load this surface (403).
- [ ] A sysadmin Unfreeze action sets `clearedat`/`clearedby`, writes an `authauditlog` row `eventtype='contact_unfreeze'` (with acting sysadmin id), and immediately restores the user's ability to send contact requests (stale in-memory window is reset so it does not instantly re-trip).
- [ ] A frozen user cannot unfreeze themselves; the unfreeze and review endpoints re-verify `issystemadmin` server-side (not UI-only) and reject non-sysadmins.

---

### Security / Privacy Notes

- **Least privilege:** freeze visibility and the unfreeze action are restricted to `users.issystemadmin`; enforcement is server-side on every call, never UI-gating alone.
- **Human-in-the-loop:** the freeze is a hard, non-expiring stop that *requires* a human sysadmin to clear — consistent with the illegal-activity-monitoring stance (Section 8) that automated systems flag and freeze but humans decide. There is no automated punitive escalation (no auto-ban, no auto-report).
- **No information leak:** rejection messages to the frozen user state the fact of suspension but never expose the numeric threshold, window, or other users' proximity to a trip; block relationships (Section 4) remain silent and are unaffected by the frozen path since the frozen check short-circuits first.
- **Audit trail:** both the trip (`contact_flood`) and the clear (`contact_unfreeze`, with acting admin id) are recorded in the append-only `authauditlog`, giving a complete who-froze-whom-and-who-cleared-it record; the `contactfreezes` history rows preserve repeat-offender patterns for review.
- **DoS realism:** the durable table — not the per-node in-memory counter — is the authoritative guard, so the protection holds under horizontal scaling even though trip *detection* is currently per-node (documented limitation, mirrors `lib/auth/ratelimit.ts`).

**Open questions:**
- Threshold defaults: is 10 requests / 60s the right trip point, or should it be more permissive (e.g. 20/60s) to avoid freezing power users who legitimately add many contacts after importing an address book? The value is env-tunable regardless, but the shipped default should reflect expected real usage.
- Repeat-offender policy: should a user who has been frozen-and-cleared N times get a lower threshold, a longer/permanent hold, or an automatic account review — or is every trip treated identically? The contactfreezes history table supports either, but the decided model does not specify escalation.
- Sysadmin notification channel scope: SES email to the full issystemadmin set is specified. For larger admin sets, should notifications be batched/deduped (e.g. one digest per interval) to avoid mail storms if many users trip at once, and should there be an in-app/push channel in addition to email?
- Should the email-bound invite send path (contactinvites) count toward the same flood window as in-app requestContact calls, or have its own separate limit? This section assumes shared counting; confirm whether outbound email invites (which can be sent to arbitrary addresses) warrant an independent, possibly stricter, guard.
- On unfreeze, should the user's in-memory rolling window be hard-reset (proposed) or left intact? Hard-reset avoids an immediate re-trip on a stale bucket but briefly widens the window right after a known abuser is released; confirm the preferred trade-off.


---

## [spec both] @mention → private DM from a public community space

## Section 6 — @mention → private DM from a public community space

**Owning specs:** primary **017 (Communities)** for the public-space capture/routing behavior; **018 (Contacts & Direct Messages)** for the resulting DM lifecycle (connect-request, send-gating, private-tier classification). FRs are labeled per spec.

### 6.1 Intent

Inside a **public community space** (community `discoverability = public` AND the space does not override stricter AND it is not the admin space — the "public tier" defined in Section 1), authoring a message whose text targets another user with an `@person` mention MUST NOT be published into the public, plaintext space. Instead the mention captures the message and routes it into a **private 1:1 DM** with the mentioned user, subject to the normal connect/contact rules of Section 2. This gives users a "reply privately" affordance from a public room without leaking the content to the room, and keeps person-to-person content in the private (encrypted + monitored) tier.

This behavior applies **only** to public community spaces. In private/closed spaces and in existing DMs (person/group conversations), an `@person` is a plain textual mention/notification and is NOT re-routed (see OQ-1).

### 6.2 Functional Requirements

**Mention detection (spec 017)**

1. **FR-6.1 (017) — MUST** treat a message submitted to a **public space** conversation as a "mention-route" candidate when its text contains at least one `@person` token that resolves to a distinct, existing user (the *mention target*) who is reachable to the author (see FR-6.7). A token resolves via the space's own reachable set: it MUST match a user who is a **member of that community** (i.e., has a `communitymembers` row for the space's community). The server, not the client, is the authority for resolution and routing.

2. **FR-6.2 (017) — MUST** resolve a mention token deterministically to exactly one user. If a token is ambiguous (matches more than one community member) or resolves to no community member, the token is NOT a mention-route target: it is left as literal text and the message follows the normal public-space posting path (FR-6.9). The system MUST NOT silently pick one of several ambiguous matches.

3. **FR-6.3 (017) — MUST** treat a message that mentions **exactly one** valid target as a single-target private route: the entire message body is moved to the DM with that target and is NOT posted to the public space. Where a message contains **multiple** distinct valid mention targets, the server MUST NOT fan the same body into several DMs by default; it MUST instead reject the submission with a recoverable error (`ambiguous_mention_route`, 400) telling the author to mention only one person to send a private message, OR — if OQ-2 is resolved in favor of first-target routing — route to the first resolved target only. (Pick-one is the guided default; see OQ-2.)

4. **FR-6.4 (017) — MUST** treat a self-mention (`@` the author) as ordinary text: no DM is created and the message posts to the public space normally (subject to the join-to-post rule of Section 1).

**Routing into the DM (spec 018)**

5. **FR-6.5 (018) — MUST**, on a valid single-target mention route, resolve (get-or-create) the **private 1:1 `person` conversation** between the author and the mention target using the same path as a normal contact request (the get-or-create direct conversation of Section 2), so that at most one active DM exists per unordered pair.

6. **FR-6.6 (018) — MUST** apply the Section 2 connect/contact rules to the route:
   - **If the author and target are already connected** (an accepted contact row exists): the message body is delivered into their DM as a normal author message via the engine send path, and normal DM send-gating is satisfied.
   - **If they are NOT yet connected**: the route becomes a **connect request** exactly as `requestContact` in Section 2 — it opens/uses the 1:1 conversation, creates (idempotently) a single active pending contact record, and posts the standard "wants to connect" system message. The author's typed body MUST NOT be delivered as an author message while the pair is unconnected (the DM send-gate forbids author messages to a non-contact); it is instead captured (see FR-6.11 / OQ-3). The system MUST NOT create a duplicate pending record or post a second "wants to connect" if an active pending row already exists (idempotent, per Section 2).

7. **FR-6.7 (018/017) — Block interaction. MUST** honor `contactblocks` (Section 4) before routing:
   - If the **target has blocked the author** (a `contactblocks` row exists with `blockerid = target`, `blockedid = author`): the author MUST NOT be able to open/route a DM to the target. The `@target` token MUST resolve as **unreachable** — it is left as literal text and the message follows the normal public-space path (or, if the token is the only content and posting is otherwise valid, it posts as plaintext into the public space). The failure MUST be **silent** with respect to the block (Section 4): the author receives no "you are blocked" signal; from their perspective the mention simply did not become a private route. The system MUST NOT reveal block state, and MUST NOT create a contact record, contact invite, or DM message.
   - If the **author has blocked the target**: routing a private DM to a user the author has themselves blocked MUST be prevented (treat as unreachable / literal text); the author is expected to unblock first.

8. **FR-6.8 (018) — MUST** classify the resulting/target DM as **private-tier** per Section 1 and Section 7: the `person` conversation is encrypted-at-rest (escrow, per-conversation DEK) and is subject to illegal-activity monitoring (Section 8). A mention-routed DM carries no weaker protections than any other DM. The public space it originated from remains plaintext and is unaffected.

**Public-space non-route path (spec 017)**

9. **FR-6.9 (017) — MUST**, when a public-space submission has no valid single mention target (no `@person`, only self-mention, only unresolved/ambiguous tokens, or the sole target is unreachable per FR-6.7), post the message to the public space **only if** the author is a member of that space (the join-to-post rule of Section 1). A non-member author has no public-post fallback: their submission is rejected with the standard join-to-post error unless it was fully consumed by a valid private route.

10. **FR-6.10 (017) — MUST** allow a **non-member** of a public space (who may READ per Section 1) to route an `@person` private DM **only** to the extent the target is reachable per the contact rules; i.e., the private-route path does NOT require the author to have joined the space, because the content is not entering the space. Posting to the space still requires membership (Section 1). *This makes "read a public space, DM someone in it, but don't post publicly" possible for non-members.* (See OQ-4 for whether non-member mention-routing should be allowed at all.)

**Capture / feedback (spec 018)**

11. **FR-6.11 (018) — MUST** give the author unambiguous client feedback that their message was routed privately and NOT posted publicly: the composer result MUST indicate the message went to a DM with the target (and, when unconnected, that it became a connect request). The typed body's disposition while unconnected is governed by OQ-3.

12. **FR-6.12 (017/018) — MUST** perform the whole route (mention resolution, reachability/block checks, get-or-create conversation, contact-record create-or-noop, message/system-message post) server-side as a single logical operation so that a partial failure cannot leave a contact record without its conversation or vice versa (consistency mirrors Section 9's transaction requirement for group-chat creation).

### 6.3 Data-model changes

No new tables are required by this section; it composes existing structures plus tables introduced elsewhere in this delta.

- **conversations** (existing, spec 001): a mention-routed DM uses `kind = 'person'`. No new column.
- **contacts** (existing, spec 018, as reworked in Section 2): a not-yet-connected mention route creates one active `pending` row (`requesterid = author`, `addresseeid = target`, `status = 'pending'`, `conversationid` set to the 1:1). No new column.
- **contactblocks** (introduced in Section 4): consulted read-only here (`blockerid`, `blockedid`). No change.
- **conversationkeys** (introduced in Section 7): the routed `person` conversation gets its escrow DEK on first message exactly as any other private conversation. No change specific to this section.

**Optional (only if OQ-3 selects "hold the drafted body"):** a small holding structure for the author's typed body pending the target's accept. If adopted, follow DB conventions (table lowercase+plural, no separators; PK `id` uuid v7; FK `contactid` → `contacts.id`, `conversationid` → `conversations.id`; columns lowercase such as `authorid`, `body`, `createdat`, `deliveredat`). This is deferred pending OQ-3 and is NOT proposed for build in this section.

### 6.4 Security & privacy notes

- **No content leak to the public tier.** The defining guarantee: a message intended for one person via `@` must never be persisted or published into the plaintext public space. Routing is server-authoritative; a client that fails to detect the mention still results in private routing because the server re-runs resolution. Conversely, the server MUST NOT route to a private DM any message the author intended for the space when resolution is ambiguous — it fails closed to a recoverable error (FR-6.3) rather than guessing.
- **Block secrecy preserved (Section 4).** A blocked author gets no distinguishable signal: the mention degrades to literal text with the same outcome a non-existent user would produce. The response timing/shape MUST NOT let an author probe whether a specific user has blocked them via mention routing.
- **Private-tier inheritance.** The routed DM is encrypted-at-rest (escrow, Section 7) and monitored for the serious-crime taxonomy (Section 8) — a public-space `@` cannot be used to create an unmonitored or unencrypted side channel.
- **No enumeration via mentions.** Mention resolution is limited to members of the originating community (FR-6.1); it MUST NOT resolve arbitrary platform users, so a public space cannot be used to DM-probe the whole user base. People-search hardening (Section 10) is the separate discovery path.
- **Consent still required.** Routing to an unconnected user produces a connect request, not a delivered private message; the target's inbox is not populated with arbitrary author content before they accept (subject to OQ-3). This preserves the Section 2 consent model.

### 6.5 Acceptance Criteria

- [ ] In a public space, submitting a message containing `@bob` (Bob is a community member and connected to the author) delivers the body to the author↔Bob 1:1 DM and posts **nothing** to the public space.
- [ ] The same submission when the author and Bob are **not** connected creates a single pending contact (`requesterid = author`), posts the standard "wants to connect" system message into their 1:1, and posts nothing to the public space; the author's typed body is not delivered as an author message while unconnected (per OQ-3 disposition).
- [ ] Re-submitting an `@bob` mention while a pending request already exists does NOT create a second contact row and does NOT post a second "wants to connect" (idempotent).
- [ ] A message with `@self` (the author) posts normally to the public space (subject to join-to-post) and creates no DM.
- [ ] A message whose `@token` matches no community member, or matches more than one, is left as literal text and follows the normal public-space path (posts if the author is a member, else rejected for join-to-post).
- [ ] A message with two distinct valid mention targets is rejected with `ambiguous_mention_route` (400) by default (pick-one guidance), OR routes to the first target only if OQ-2 is decided that way — and in neither case is the body posted publicly.
- [ ] When Bob has blocked the author, an `@bob` mention does NOT open a DM, does NOT create a contact record or invite, produces no "you are blocked" signal, and the author observes only that the mention did not become a private route (the message either posts as plaintext if the author is a member, or is rejected for join-to-post — the block itself is invisible).
- [ ] When the author has blocked Bob, an `@bob` mention does not create a private route (treated as unreachable).
- [ ] The routed `person` conversation is encrypted-at-rest (has a `conversationkeys` row) and is included in illegal-activity monitoring; the originating public space remains plaintext.
- [ ] A non-member of a public space (read-only) can route an `@person` DM (subject to reachability) without joining, but still cannot post publicly without joining.
- [ ] The author receives explicit client feedback that the message was sent privately (and, if applicable, that it became a connect request) rather than posted to the space.
- [ ] Mention resolution, reachability/block checks, conversation get-or-create, contact create-or-noop, and message/system post either all succeed or leave no orphaned contact/conversation state.


**Open questions:**
- OQ-1: This section routes @mentions to a private DM ONLY from public community spaces. In private/closed spaces and in existing DMs, @person is assumed to be a plain textual mention/notification and is NOT re-routed. Confirm this scope, and confirm whether an in-space @mention should generate any notification/highlight (out of scope for this delta unless decided).
- OQ-2: Multi-target behavior. Default proposed is to REJECT a submission that names two or more distinct valid mention targets (ambiguous_mention_route, 400) and instruct the author to mention one person. Alternative: route to the FIRST resolved target only. Which is the product behavior? (Fanning the same body into multiple private DMs is explicitly not proposed.)
- OQ-3: Disposition of the author's typed body when the target is NOT yet connected. Options: (a) DROP the body and send only the standard 'wants to connect' request (author must re-type after acceptance) — simplest, matches current requestContact which sends no author text; (b) HOLD the drafted body server-side and auto-deliver it into the DM once the target accepts (needs the optional holding table in 6.3); (c) send a short fixed connect message and discard the body. Which?
- OQ-4: Should a NON-MEMBER of a public space be permitted to mention-route a private DM at all (FR-6.10), or must the author first join the space (become a community/space member) before @mention routing is available? Allowing it enables 'read + DM without posting'; disallowing it keeps all space interaction membership-gated.
- OQ-5: Mention token syntax and resolution key. Assumed `@` followed by a resolvable handle/display token matched against community members. Do users have stable @handles, or is matching by display name (ambiguity-prone, feeding FR-6.2)? A stable handle materially reduces ambiguity and enumeration surface.
- OQ-6: Does the mention target receive any indication of WHICH public space the DM/connect-request originated from (context breadcrumb), or is the origin space deliberately omitted from the private DM for privacy? Affects whether the connect-request system message carries space context.


---

## [spec 018] Section 7 — DM / Private-Community Encryption (Escrow At-Rest, AWS KMS Envelope, Lawful Access — NOT E2E)

## Section 7 — DM / Private-Community Encryption (Escrow At-Rest, AWS KMS Envelope, Lawful Access — explicitly NOT E2E)

**Owning spec:** 018 (Contacts & Direct Messages). **Also governs:** spec 017 private/closed spaces (same private tier) and touches spec 001 (message storage / read path). **Reconciles with:** spec 010 (zero-knowledge E2E).

> **Model in one line:** Private conversations (person + group DMs, and private/closed community spaces) are encrypted **at rest** with a per-conversation AES-256-GCM data key that is itself wrapped by an AWS-KMS-held master key. The server can unwrap and decrypt for a conversation's members and for a **sysadmin-only, fully-audited lawful-access** path. This is **escrow encryption**, **NOT end-to-end**, and **MUST NOT be marketed as end-to-end.** Public-community-space messages remain **plaintext**.

### 7.1 Positioning, reconciliation, and marketing constraints

#### FR-018-ENC-001 — Escrow, not E2E (foundational, MUST) — spec 018
The private-conversation encryption defined in this section MUST be implemented as **server-decryptable escrow encryption at rest**, NOT end-to-end encryption. The server (via AWS KMS) MUST be able to obtain the plaintext of any private message for (a) delivering to that conversation's members on read, and (b) the audited lawful-access path (7.5). The product, UI, marketing copy, ToS, and privacy policy MUST NOT describe private DMs or private spaces as "end-to-end encrypted", "zero-knowledge", or otherwise imply the operator cannot read them. Approved language is "encrypted at rest" / "encrypted storage".

#### FR-018-ENC-002 — Supersedes 018 OQ-2 (MUST) — spec 018
This section **resolves and supersedes** spec 018 Open Question OQ-2 ("E2E for DMs"). OQ-2 MUST be closed as **decided: escrow at-rest, not E2E**. Spec 018's Scope Boundary / Out-of-Scope lines that defer "DM E2E encryption" MUST be updated to reference this section as the decided-and-in-scope encryption model. No client-held private key is introduced for DMs by this section.

#### FR-018-ENC-003 — Reconciliation with spec 010 zero-knowledge E2E (MUST document) — spec 018 / note to 010
Spec 010 specifies **zero-knowledge, client-side E2E** where "the server NEVER sees the plaintext private keys" and explicitly **rejects HSM-based server-side key escrow as undermining E2E**. This section deliberately **diverges** for the Individuals/private-space contexts and MUST record the divergence explicitly:
- The two models are **mutually exclusive per conversation**. A private conversation is governed by **exactly one** of: (a) spec 010 zero-knowledge E2E, or (b) this section's KMS escrow. They MUST NOT both apply to the same message.
- For the initial launch of contacts/DMs and private spaces, private conversations use **this section's escrow model** (server-decryptable, lawful-access-enabled). Spec 010's zero-knowledge E2E is **not** applied to these conversations at launch.
- A conversation's governing model MUST be recorded on the conversation-key record (see `mode` in 7.3) so the read path, monitoring, and lawful-access paths can tell escrow conversations apart from any future E2E ones and never attempt server-side decrypt on a true-E2E conversation.
- **Open Question (see below):** whether spec 010's E2E is ever offered as an opt-in "no-recovery, no-monitoring" tier that would forgo lawful access and monitoring for that conversation. This section does not decide that; it only reserves the `mode` discriminator for it.

**Security/privacy note:** the divergence is intentional and legally motivated (lawful access + serious-crime monitoring per section 8). Because it is a weaker privacy posture than spec 010 promises, the disclosure requirement (FR-018-ENC-001 and section 8's ToS disclosure) is a **hard gate** — shipping the escrow path without the corresponding user-facing disclosure is a spec violation.

### 7.2 Scope: which conversations are encrypted

#### FR-018-ENC-004 — Encrypted private tier (MUST) — spec 018 / 017 / 001
The following conversations are the **private tier** and their message content at rest MUST be encrypted per this section:
- `conversations.kind = 'person'` (1:1 DMs) — spec 018.
- `conversations.kind = 'group'` (ad-hoc group DMs) — spec 018.
- `conversations.kind = 'space'` where the linked community space is **private/closed** — i.e. NOT (community `discoverability = 'public'` AND the space does not override to stricter AND the space is not the admin space) — spec 017.

#### FR-018-ENC-005 — Public spaces stay plaintext (MUST) — spec 017 / 001
Messages in a **public** community space (per the section-1 public-read definition: community `discoverability = 'public'` AND the space does not override stricter AND it is not the admin space) MUST be stored as **plaintext** (`messages.content`, `encryptiontype = 'platform'`, no `conversationkeys` row required). Public content is intentionally readable at rest to support open discovery, non-member read, and standard moderation. Public spaces MUST NOT be routed through the KMS unwrap or the section-8 monitoring pass.

#### FR-018-ENC-006 — System messages follow the conversation tier (MUST) — spec 018 / 001
System messages (`postSystemMessage`, e.g. "wants to connect", "you're now connected", join notices) posted into a **private-tier** conversation MUST be encrypted with the same conversation key as user messages. System messages in a public space remain plaintext. (Rationale: a connect-request system message reveals a social edge and belongs to the private tier.)

### 7.3 Data model — new `conversationkeys` table

#### FR-018-ENC-007 — `conversationkeys` table (MUST) — spec 018 / 001
A new table `conversationkeys` MUST store exactly one wrapped data key per encrypted private conversation. Follows project DB conventions (lowercase, plural table, no separators; PK `id` UUID v7; FK = parent name + `id`).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK (v7) | app-generated UUID v7 |
| `conversationid` | `uuid` NOT NULL | FK → `conversations.id` ON DELETE CASCADE; **UNIQUE** (one active DEK per conversation) |
| `mode` | enum `convkeymode` NOT NULL default `'escrow'` | discriminator: `'escrow'` (this section, KMS-wrapped, server-decryptable) or `'e2e'` (reserved for spec 010 zero-knowledge; server holds no usable key). Read/monitoring/lawful-access paths branch on this. |
| `wrappeddek` | `bytea` NOT NULL | the AES-256 DEK **ciphertext** as returned by KMS Encrypt / GenerateDataKey (the KMS blob). Raw DEK is NEVER persisted. NULL/unused when `mode = 'e2e'`. |
| `kmskeyid` | `text` NOT NULL | the KMS KEK identifier (key ARN or alias) used to wrap this DEK; supports key rotation and multi-key environments. |
| `dekalgo` | `text` NOT NULL default `'AES-256-GCM'` | data-key algorithm, for forward compatibility. |
| `keyversion` | `integer` NOT NULL default `1` | increments on DEK rotation (7.6); messages record which version encrypted them (see FR-018-ENC-009). |
| `createdat` | `timestamptz` NOT NULL default now | |
| `rotatedat` | `timestamptz` NULL | set when the DEK is rotated. |

Indexes: `uniqueIndex` on `conversationid` (`conversationkeys_conversationid_key`).

**Security/privacy note:** `conversationkeys` stores ONLY wrapped (KMS-encrypted) key material. A full database dump of `conversationkeys` + `messages` yields **no plaintext** without a live, authorized KMS `Decrypt`/`unwrap` call. The raw KEK never exists in the app process or the database.

#### FR-018-ENC-008 — `convkeymode` enum (MUST) — spec 018
A new Postgres enum `convkeymode` MUST be created with values `('escrow', 'e2e')`. Default for conversations created under this section is `'escrow'`.

#### FR-018-ENC-009 — Message storage columns reuse spec 001 shape (MUST) — spec 001 / 018
Encrypted private messages MUST be stored using the **existing** `messages` columns rather than a parallel table:
- `encryptedpayload` (`bytea`) — holds the AES-256-GCM ciphertext.
- `content` (`text`) — MUST be `NULL` for encrypted private messages (no plaintext at rest).
- `encryptiontype` — a new enum value `'escrow'` MUST be added to `msgencryptiontype` (currently `e2e | agent-e2e | platform`) and set on encrypted private messages. Public/plaintext messages keep `'platform'`.
- The AES-GCM **IV/nonce** (96-bit) and **auth tag** (128-bit) MUST be persisted so the message can be decrypted independently. They MAY be prepended/appended within `encryptedpayload` using a documented framing (e.g. `nonce(12) || ciphertext || tag(16)`) — the framing MUST be specified before implementation. The **DEK `keyversion`** used to encrypt each message MUST be recorded (reusing `encryptionkeyid` to reference `conversationkeys.id`, or a documented equivalent) so a message survives DEK rotation.

**Open Question:** whether to reuse `messages.encryptionkeyid` (currently a deferred spec-001 FK stub to `userencryptionkeys`) to point at `conversationkeys.id`, or add a dedicated `conversationkeyid` column. Flagged; low-risk either way.

### 7.4 Encryption / decryption behavior (envelope via AWS KMS)

#### FR-018-ENC-010 — Per-conversation DEK provisioning (MUST) — spec 018 / 001
On first message send into a private-tier conversation with no `conversationkeys` row, the server MUST provision a data key: obtain a 256-bit DEK and its KMS-wrapped form (e.g. AWS KMS `GenerateDataKey` against the configured KEK), persist the wrapped blob + `kmskeyid` in `conversationkeys`, use the plaintext DEK in memory to encrypt the message, then discard the plaintext DEK. Provisioning MUST be idempotent under concurrency (unique `conversationid` + upsert/conditional insert) so two simultaneous first-sends do not create two DEKs.

#### FR-018-ENC-011 — Encrypt on write (MUST) — spec 018 / 001
When persisting a user or system message to a private-tier conversation, the server MUST encrypt the plaintext with AES-256-GCM under the conversation's current DEK, store the result in `encryptedpayload` with `encryptiontype = 'escrow'` and `content = NULL`, and MUST NOT write the plaintext to `messages.content`, to logs, to analytics events, or to any error payload.

#### FR-018-ENC-012 — Decrypt on read for members (MUST) — spec 018 / 001
On an authorized member read (REST `GET /api/engine/conversations/[id]/messages`, WS delivery, or notification body composition), for `escrow`-mode conversations the server MUST unwrap the DEK via KMS `Decrypt` (using `wrappeddek` + `kmskeyid`), decrypt each requested message, and return plaintext to the authenticated member. Unwrapped DEK plaintext MUST live only in process memory for the duration of the request and MUST NOT be persisted. The read path MUST reuse the **existing membership gate** (`isConversationMember`) — decryption is offered ONLY to conversation members (and the lawful-access path); the public-read exception from section 1 does NOT apply to private-tier conversations.

#### FR-018-ENC-013 — DEK unwrap caching bound (SHOULD) — spec 018
To avoid a KMS `Decrypt` per message, the server MAY cache an unwrapped DEK **in memory only**, per conversation, for a short, bounded TTL (default ≤ 60s, tunable via env). Cached DEKs MUST NOT be written to disk, DB, or shared cache that outlives the process trust boundary, and MUST be evicted on conversation-key rotation. This is a performance concession, not a security relaxation.

#### FR-018-ENC-014 — KMS is the trust root; no local KEK (MUST) — spec 018
The raw KEK MUST reside only in AWS KMS. The application and database MUST NEVER hold, import, or export the plaintext KEK. All wrap/unwrap operations MUST be KMS API calls so that **every unwrap is logged by KMS (CloudTrail)**, giving an independent, tamper-evident record of every key access, including lawful-access exports.

### 7.5 Lawful access (sysadmin-only, audited export)

#### FR-018-ENC-015 — Sysadmin-only lawful-access export (MUST) — spec 018 / 011
There MUST be a lawful-access export capability that returns the **decrypted history** (or, at the operator's option, the unwrapped DEK) for a specified private conversation. It MUST be authorized to sysadmins ONLY — callers where `users.issystemadmin = true`. Any non-sysadmin caller MUST be rejected (403). No other role (org owner, community owner/moderator, support, agent) may access private-conversation keys or plaintext through any path.

#### FR-018-ENC-016 — Every lawful-access use is audited (MUST) — spec 018 / 011
Every invocation of the lawful-access export (success OR denial) MUST write an `authauditlog` row with `eventtype = 'lawful_access_export'`, `userid` = the acting sysadmin, and `payload` capturing at minimum: target `conversationid`, conversation `kind`, whether plaintext or DEK was returned, message count / time range exported, a stated reason/case reference, and the outcome (granted/denied). This app-level audit is in addition to the KMS/CloudTrail unwrap record (FR-018-ENC-014), giving two independent trails.

#### FR-018-ENC-017 — No silent or programmatic bulk drain (MUST) — spec 018
The lawful-access path MUST operate per named conversation (or an explicitly enumerated set) and MUST NOT expose a bulk "decrypt everything" endpoint, an un-audited internal helper, or a way to obtain the KEK itself. Rate limiting / anomaly alerting on lawful-access calls SHOULD reuse the `lib/auth/ratelimit.ts` pattern. (Open Question: whether a second sysadmin's approval is required per export — two-person rule.)

**Security/privacy note:** lawful access is the entire reason this tier is escrow rather than E2E. It is a deliberate, disclosed capability. Its safety rests on: (1) sysadmin-only authz, (2) dual audit trails (app `authauditlog` + KMS CloudTrail), and (3) no path to the raw KEK. These three MUST all hold; weakening any one makes the escrow model unaccountable.

### 7.6 Key lifecycle

#### FR-018-ENC-018 — DEK/KEK rotation (SHOULD) — spec 018
The KEK SHOULD use AWS KMS automatic key rotation. A per-conversation DEK MAY be rotated (re-wrap existing DEK under a new KEK version, or generate a new DEK and increment `keyversion`); when a new DEK is introduced, historical messages retain their original `keyversion` and MUST remain decryptable via the retained wrapped key material. Rotation MUST update `rotatedat` and MUST invalidate any cached unwrapped DEK (FR-018-ENC-013).

#### FR-018-ENC-019 — Deletion semantics (MUST) — spec 018 / 017
When a conversation is deleted (e.g. unfriend → "Delete" per section 4, or space/community deletion), its `conversationkeys` row MUST be deleted via the `conversationid` cascade, and its `messages` removed. Deleting the wrapped DEK renders any residual ciphertext undecryptable (crypto-shredding), which is the intended effect and MAY be relied on as the deletion mechanism for the encrypted content.

### 7.7 Acceptance Criteria

- [ ] A `conversationkeys` table exists with columns per FR-018-ENC-007, a UNIQUE constraint on `conversationid`, and a `convkeymode` enum (`escrow`, `e2e`) defaulting to `escrow`.
- [ ] `msgencryptiontype` includes a new `escrow` value; encrypted private messages are stored with `encryptiontype = 'escrow'`, `encryptedpayload` populated, and `content IS NULL`.
- [ ] Sending the first message into a `person`, `group`, or private/closed `space` conversation provisions exactly ONE `conversationkeys` row (idempotent under concurrent first-sends), with `wrappeddek` = a KMS blob and the raw DEK never persisted.
- [ ] A raw DB dump of `messages` + `conversationkeys` contains NO plaintext of any private-tier message; decrypting requires a live authorized KMS `Decrypt` call.
- [ ] An authorized member reading a private conversation via `GET /api/engine/conversations/[id]/messages` and via WS delivery receives correct plaintext; a non-member receives 403 with no decryption attempted.
- [ ] Messages in a **public** community space are stored plaintext (`content` populated, `encryptiontype = 'platform'`, no `conversationkeys` row) and are never routed through KMS unwrap or section-8 monitoring.
- [ ] System messages ("wants to connect", etc.) in a private-tier conversation are encrypted with the conversation DEK; in a public space they are plaintext.
- [ ] The lawful-access export returns decrypted content (or the DEK) ONLY for a caller with `issystemadmin = true`; every other caller (including org/community owners and support) is rejected 403.
- [ ] Every lawful-access invocation (grant and denial) writes an `authauditlog` row with `eventtype = 'lawful_access_export'`, the acting sysadmin `userid`, and a payload including target `conversationid` and reason; a corresponding KMS unwrap appears in CloudTrail.
- [ ] There is no bulk "decrypt everything" endpoint and no path (any role) to export the raw KEK.
- [ ] Deleting a conversation cascades removal of its `conversationkeys` row (crypto-shred) and its messages.
- [ ] DEK rotation preserves decryptability of historical messages (via retained `keyversion` material) and invalidates any in-memory DEK cache.
- [ ] Spec 018 OQ-2 is marked resolved (escrow, not E2E) and the reconciliation note vs spec 010 (mutually-exclusive per-conversation `mode`) is recorded in both specs.
- [ ] No product/UI/marketing/ToS surface describes private DMs or private spaces as "end-to-end" or "zero-knowledge"; the ToS/privacy disclosure required by section 8 is present (hard gate).
- [ ] Plaintext of a private message never appears in application logs (Pino), analytics events, or error payloads.

### 7.8 Security & Threat Model note

- **Protects against:** offline theft of the database / storage snapshot (backup exfiltration, stolen disk, dumped read-replica). Ciphertext in `messages.encryptedpayload` is useless without a live, authorized KMS `Decrypt` on the per-conversation `wrappeddek`. Deleting a `conversationkeys` row crypto-shreds that conversation's history.
- **Also protects against:** a compromised DB credential that can read tables but cannot call KMS `Decrypt` (KMS access is a separate IAM grant, not implied by DB access).
- **Does NOT protect against (by design):** a malicious or compelled **operator / sysadmin** with the lawful-access grant, or anyone who can invoke KMS `Decrypt` with the app's KMS role. This is intentional — the whole point of escrow is that the operator CAN decrypt for lawful access and serious-crime monitoring (section 8). Users are NOT protected from the operator, which is precisely why this MUST NOT be presented as E2E and MUST be disclosed.
- **Accountability controls (compensating):** the operator's access is not silent — it is gated to sysadmins, and every access produces two independent, tamper-evident records (app `authauditlog` + KMS CloudTrail). The KEK is never extractable to the app, so access cannot be moved off-audit.
- **Contrast with spec 010:** spec 010's zero-knowledge E2E DOES protect against the operator (server never holds usable keys) but forfeits lawful access, monitoring, and server-side recovery. This section trades that protection away deliberately for the private-DM/space tier.


**Open questions:**
- Reuse of messages.encryptionkeyid: point it at conversationkeys.id, or add a dedicated conversationkeyid column? (deferred spec-001 FK stub currently targets userencryptionkeys)
- AES-GCM framing: exact on-disk layout for nonce/ciphertext/tag within encryptedpayload (e.g. nonce(12)||ciphertext||tag(16)) must be fixed before implementation.
- Two-person rule for lawful-access exports: should a second sysadmin's approval be required per export, or is single-sysadmin + audit sufficient?
- Optional future E2E tier: should spec 010 zero-knowledge E2E ever be offered per-conversation as an opt-in that forgoes lawful access AND section-8 monitoring? The convkeymode='e2e' discriminator is reserved for it but the policy is undecided.
- DEK unwrap cache TTL default (proposed 60s) — acceptable exposure window vs KMS call volume/cost; needs product/security sign-off.
- KMS multi-region / DR posture: does the KEK need multi-region replication so private history stays readable in a regional failover, and how does that interact with CloudTrail auditing across regions?


---

## [spec both] Spec 018/017 delta — Section 8: Illegal-activity monitoring of private conversations (AI classifier + sysadmin review queue)

## Section 8 — Illegal-Activity Monitoring of Private Conversations

**Spec ownership:** New capability. FRs are labeled per home spec:
- **[018]** governs private DMs (`person` + `group` conversations) — this is the Individuals context that spec 018 owns.
- **[017]** governs private/closed community **spaces** — spec 017 owns spaces and their conversations.
- **[001]** owns the shared engine seam where classification is triggered (message write path) and the escrow-decrypt read path (Section 7).

Because the mechanism (classifier, taxonomy, review queue, sysadmin flow, disclosure) is identical for both surfaces, it is specified once here and referenced from both specs. Where a requirement is surface-specific it is called out.

**Dependency:** This section REQUIRES Section 7 (escrow at-rest encryption + KMS unwrap + sysadmin-only audited decrypt). Monitoring reads decrypted plaintext of PRIVATE conversations; it therefore runs on the server side that already holds lawful-access decrypt capability. This is NOT compatible with zero-knowledge E2E — see the Section 7 reconciliation note against spec 010.

**Scope (HARD boundary):**
- **IN scope:** private DMs (`person`, `group`) [018] and private/closed community spaces [017] — i.e. exactly the conversations that are escrow-encrypted at rest per Section 7.
- **OUT of scope (never classified by this pipeline):** public community spaces (community `discoverability='public'` AND the space does not override stricter AND is not the admin space). Public spaces are PLAINTEXT and covered by standard community moderation only. `agent` and `support` conversation kinds are also out of scope for this pipeline in v1 (Open Question OQ-4).

---

### 8.1 Serious-Crime Taxonomy (the classification target)

The classifier MUST evaluate content against this DEFINED, closed taxonomy of serious crimes only. General rudeness, spam, harassment, or ToS-breaches are explicitly NOT in this taxonomy (they route to standard community moderation, not this pipeline).

| Category code | Description |
|---|---|
| `child_safety` | Child sexual abuse material (CSAM), child sexual exploitation, grooming of minors |
| `violence_terrorism` | Credible threats of violence, terrorism, incitement to mass-casualty harm |
| `weapons_explosives` | Trafficking/manufacture of illegal weapons or explosives |
| `human_trafficking` | Human trafficking, forced labor, sexual servitude |
| `drug_trafficking` | Trafficking / large-scale distribution of controlled substances |
| `serious_fraud` | Serious financial fraud (large-scale scams, money laundering, identity-theft rings) |

**[018/017] FR-8.1** The system MUST classify private-conversation message content against the six categories above and no others. The taxonomy MUST be defined in a single versioned constant (a `taxonomyversion` string, e.g. `"2026-06-30.1"`) that is recorded on every flag so historical flags remain interpretable after the taxonomy or prompt is revised.

**[018/017] FR-8.2** The classifier prompt MUST instruct the model to return a structured verdict per message: `{ flagged: boolean, categories: string[], confidence: number (0..1), rationale: string }`, where `categories` is a subset of the taxonomy codes. The system MUST treat a response it cannot parse into this shape as an `error` outcome (FR-8.9), NOT as "not flagged".

---

### 8.2 Classification Trigger & Provider

**[001/018/017] FR-8.3** On send of a message to an in-scope PRIVATE conversation, the system MUST enqueue that message for classification **asynchronously** (out of the send request's critical path). Message delivery, persistence, fan-out, and read latency MUST NOT be blocked by, and MUST NOT fail because of, classification (the classifier is advisory, never a send-gate). Enqueue MUST occur after the message is durably persisted so no in-scope message is silently skipped.

**[001] FR-8.4** Classification MUST run against the DECRYPTED plaintext obtained via the Section 7 escrow path (per-conversation DEK unwrapped by KMS). Plaintext obtained for classification MUST live only in memory for the duration of the call and MUST NOT be persisted anywhere except as permitted by FR-8.7 (bounded excerpt on a confirmed flag).

**[018/017] FR-8.5** Classification MUST use the **configured system AI provider** — the single system-default provider row (`aiproviders` where `userid IS NULL` and `isdefault=true`, resolved via the existing `resolveProviderRow`/adapter seam, provider `type` ∈ {`anthropic`, `openai-compatible` incl. Groq}). The provider/model, prompt, and taxonomy version in effect MUST be recorded on each flag (FR-8.8) for reproducibility.

**[018/017] FR-8.6** The pipeline MUST support both operating modes and treat them as equivalent for downstream handling:
- (a) **on-send async** classification of each new in-scope message; and
- (b) a **background sweep** that (re)classifies a bounded batch of in-scope messages (e.g. backfill, taxonomy-version bump, or provider-outage catch-up), reading via the same escrow decrypt path.
A message MUST NOT be double-flagged for the same `(messageid, taxonomyversion)`; re-classification under a NEW taxonomy version MAY produce a new flag.

---

### 8.3 On a Hit — Audit, Review Queue, Notify

**[018/017] FR-8.7** When the classifier returns `flagged=true`, the system MUST, in a single transaction:
1. INSERT a row into `contentflags` (§8.6) capturing the conversation, message, categories, confidence, rationale, provider/model, and taxonomy version, with `status='open'`; and
2. WRITE an `authauditlog` row with `eventtype='content_flag_created'` and a payload referencing the `contentflags.id`, `conversationid`, `messageid`, categories, and confidence.
The stored flag MAY include a bounded plaintext **excerpt** (see FR-8.15 for the retention/redaction constraints); it MUST NOT store the full conversation.

**[018/017] FR-8.8** Each `contentflags` row MUST be uniquely keyed by `(messageid, taxonomyversion)` so re-processing the same message under the same taxonomy is idempotent (no duplicate queue entries).

**[018/017] FR-8.9** If classification errors (provider unavailable, parse failure, timeout), the system MUST record the attempt as `status='error'` (or an equivalent error record) with a bounded retry/backoff, and MUST NOT create a false `flagged` result and MUST NOT drop the message from the eligible set. Errored items MUST be re-eligible for the background sweep (FR-8.6b). Repeated provider errors MUST be observable (metric/log), because a silently-failing classifier is a monitoring gap.

**[018/017] FR-8.10** On a new `open` flag the system MUST notify the sysadmin set (users with `issystemadmin=true`) via SES email AND surface the flag in a sysadmin review queue UI. Notifications MUST NOT be sent to the flagged user, the other conversation participants, community moderators, or org admins — flags are sysadmin-only.

---

### 8.4 Human-in-the-Loop Review (no auto-action, no auto-report)

**[018/017] FR-8.11** Flags MUST be advisory and reviewed by a human sysadmin ONLY. The system MUST NOT, on the basis of a flag, take ANY automated action against the user or content: no auto-ban, no auto-suspend, no auto-delete, no auto-mute, no auto-throttle, and specifically **no automated report to law enforcement or any third party**. (This deliberately differs from the Section 5 contact-flood guard, which DOES auto-freeze; illegal-activity flags never auto-act.)

**[018/017] FR-8.12** A sysadmin reviewing a flag MUST be able to inspect the flagged message and its surrounding context ONLY via the Section 7 sysadmin-only audited lawful-access/export path. Every such inspection MUST write an `authauditlog` row (`eventtype='content_flag_reviewed'` on open, plus the Section 7 `content_export`/decrypt audit event). No review UI may surface private plaintext through any non-audited channel.

**[018/017] FR-8.13** A sysadmin MUST be able to resolve a flag to exactly one terminal disposition, each of which sets `status` and records `reviewedby`, `reviewedat`, and a free-text `reviewnote`:
- `dismissed_false_positive` — not a real violation;
- `confirmed_actioned` — real violation; the sysadmin took a manual, separately-audited action (recorded in the note / referenced action);
- `escalated` — retained for legal/authorities handling done OUT OF BAND by a human (still no automated report).
Transitions MUST be one-way from `open`/`in_review` to a terminal state; a terminal flag MUST NOT silently reopen (a new flag is created instead).

**[018/017] FR-8.14 (false-positive handling)** Because the classifier is probabilistic:
- A confidence threshold (env-tunable, default e.g. `0.5`) MAY gate whether a low-confidence verdict enters the review queue vs. is logged only; the threshold value in effect MUST be recorded on the flag.
- `dismissed_false_positive` dispositions MUST be counted (queryable) so the false-positive rate is observable and the prompt/threshold can be tuned.
- A dismissed flag MUST NOT re-fire for the same `(messageid, taxonomyversion)` (FR-8.8 idempotency), preventing repeat-noise on the same content.

---

### 8.5 Disclosure (HARD REQUIREMENT)

**[018/017] FR-8.15 (disclosure — blocking)** The fact that PRIVATE messages (DMs and private/closed spaces) are subject to automated illegal-activity monitoring, that content is escrow-encrypted (server-decryptable) rather than end-to-end, and that flagged content may be reviewed by a human sysadmin, MUST be disclosed to users in the Terms of Service AND the Privacy Policy BEFORE this feature is enabled in production. The product MUST NOT describe private DMs or private spaces as "end-to-end encrypted" or "private, only you can read this" anywhere in UI, marketing, or docs. Enabling the monitoring pipeline in production is GATED on the disclosure copy being live (release-checklist item).

**Security/Privacy note:** This is the single most legally-sensitive requirement in the delta. Monitoring undisclosed private communications is a serious privacy and potentially legal violation. The disclosure gate (FR-8.15) and the sysadmin-only, fully-audited access model (FR-8.10/8.12) are the controls that make the capability defensible. Access to plaintext, keys, and flags MUST be limited to `issystemadmin` users and MUST be 100% audited.

---

### 8.6 Data Model Changes

All tables live in the `yappchat` Postgres schema. Conventions: lowercase plural table names, no separators; PK `id` UUID v7; FK column = parent-table-name + `id`; lowercase columns; timezone-aware timestamps.

**New table `contentflags`** (the sysadmin review queue — one row per flagged message per taxonomy version):

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | UUID v7 (app-generated) |
| `conversationid` | `uuid` NOT NULL | references `conversations.id` (`onDelete: cascade`) |
| `messageid` | `uuid` NOT NULL | references `messages.id` (`onDelete: cascade`) |
| `authorid` | `uuid` NOT NULL | the flagged message's author (the `users.id`); FK-less to match engine's decoupled-membership pattern, or FK to `users.id` — see OQ-2 |
| `surface` | enum `flagsurface` | `dm` \| `group` \| `space` — records which in-scope surface produced the flag (018 vs 017) |
| `categories` | `text[]` NOT NULL | subset of the six taxonomy codes |
| `confidence` | `numeric` (or `integer` basis-points) NOT NULL | model confidence 0..1 |
| `rationale` | `text` | model's short justification |
| `excerpt` | `text` | bounded redactable plaintext excerpt (see FR-8.7 / retention); nullable |
| `provider` | `text` NOT NULL | provider `type`/name used |
| `model` | `text` NOT NULL | model id used |
| `taxonomyversion` | `text` NOT NULL | version string of the taxonomy+prompt in effect |
| `confidencethreshold` | `numeric` | threshold in effect at classification time |
| `status` | enum `contentflagstatus` NOT NULL default `'open'` | `open` \| `in_review` \| `dismissed_false_positive` \| `confirmed_actioned` \| `escalated` \| `error` |
| `reviewedby` | `uuid` | the reviewing sysadmin's `users.id`; nullable until reviewed |
| `reviewnote` | `text` | sysadmin free-text disposition note; nullable |
| `reviewedat` | `timestamptz` | nullable until reviewed |
| `createdat` | `timestamptz` NOT NULL default now | |

Indexes / constraints:
- `uniqueIndex("contentflags_message_taxonomy_key").on(messageid, taxonomyversion)` — enforces FR-8.8 idempotency.
- `index("contentflags_status_idx").on(status)` — queue queries (open items).
- `index("contentflags_conversationid_idx").on(conversationid)`.
- `index("contentflags_createdat_idx").on(createdat)` — retention sweep + newest-first queue.

New enums (in `ycSchema`): `flagsurface` = `["dm","group","space"]`; `contentflagstatus` = `["open","in_review","dismissed_false_positive","confirmed_actioned","escalated","error"]`.

**`authauditlog` (existing, no schema change):** reuse the existing table (`id/userid/eventtype/ip/payload/createdat`). New `eventtype` values (string-only, no migration): `content_flag_created`, `content_flag_reviewed`, `content_flag_resolved`. `payload` (jsonb) carries `{ contentflagid, conversationid, messageid, categories, confidence, disposition? }`.

**Config (env, no schema):** system-default AI provider is already resolvable via `aiproviders`. New env knobs: classifier enable flag, confidence threshold (default `0.5`), taxonomy version, sweep batch size, retry/backoff. Enable flag defaults OFF until FR-8.15 disclosure is live.

---

### 8.7 Retention of Flags & Excerpts

**[018/017] FR-8.16 (retention)** `contentflags` rows are records and MUST be retained per a defined policy, not silently purged:
- `open`/`in_review` flags MUST be retained until a sysadmin resolves them (no auto-expiry of unresolved flags).
- Terminal flags (`dismissed_false_positive`, `confirmed_actioned`, `escalated`) MUST be retained for a configurable minimum (default e.g. 365 days) for audit/legal; `escalated` flags MUST NOT be auto-deleted while their legal hold is active (OQ-3).
- The stored `excerpt` on a `dismissed_false_positive` flag SHOULD be redacted/nulled on resolution (or after a short window) to minimize retained private plaintext, while the flag metadata (categories, disposition, audit trail) is kept. Confirmed/escalated flags MAY retain the excerpt per legal-hold policy.

**Security/Privacy note:** flag retention must be reconciled with the underlying conversation's retention. If a conversation/message is deleted (e.g. unfriend→Delete in Section 4, or spec 010 retention), the `contentflags` row's `messageid`/`conversationid` FKs cascade-delete the flag body; the AUDIT trail (`authauditlog`) is retained independently as the durable compliance record. This split (transient flag body vs. durable audit event) MUST be explicit so a user's right-to-erasure does not erase the fact that a lawful-access review occurred.

---

### Acceptance Criteria

- [ ] Sending a message to a `person` or `group` (private) conversation enqueues async classification; the send response is not delayed and does not fail if the classifier/provider is down. [018]
- [ ] Sending a message to a private/closed community **space** enqueues classification identically. [017]
- [ ] Sending a message to a **public** community space does NOT enqueue classification (verified: no `contentflags` row, no provider call). [017]
- [ ] `agent`/`support` conversations are not classified in v1. [001]
- [ ] Classification reads plaintext only via the Section 7 escrow/KMS decrypt path; no separate plaintext store is introduced.
- [ ] Classifier uses the system-default `aiproviders` row; provider, model, and `taxonomyversion` are recorded on every flag.
- [ ] A message whose content matches a taxonomy category produces exactly one `contentflags` row (`status='open'`) and one `authauditlog` `content_flag_created` event, inside one transaction.
- [ ] Re-processing the same message under the same taxonomy version creates NO duplicate flag (unique `(messageid, taxonomyversion)` enforced).
- [ ] A classifier parse/timeout/provider error yields `status='error'` (or an error record), never a false `flagged=true`, and the item remains re-eligible for the background sweep.
- [ ] New `open` flag emails the `issystemadmin` set via SES and appears in the sysadmin review queue; NO notification reaches the flagged user, participants, community mods, or org admins.
- [ ] No automated action is taken on any flag (no ban/suspend/delete/report); verified there is no code path from a flag to a user-facing action or external report.
- [ ] A sysadmin can view flagged content only via the Section 7 audited lawful-access path; each view writes an `authauditlog` review/export event.
- [ ] A sysadmin can resolve a flag to exactly one terminal disposition (`dismissed_false_positive` / `confirmed_actioned` / `escalated`), setting `reviewedby`/`reviewedat`/`reviewnote` and writing an audit event; terminal flags do not silently reopen.
- [ ] Low-confidence verdicts below the configured threshold are handled per FR-8.14 and the threshold value is recorded on the flag.
- [ ] `dismissed_false_positive` count is queryable (false-positive rate observable); a dismissed flag does not re-fire for the same message+taxonomy.
- [ ] The classifier enable flag defaults OFF and cannot be turned on in production until the ToS + Privacy Policy disclosure copy (FR-8.15) is live (release-checklist gate).
- [ ] No UI/marketing/doc string describes private DMs or private spaces as end-to-end encrypted; disclosure of monitoring + escrow + human review is present in ToS and Privacy Policy.
- [ ] Deleting the underlying message/conversation cascade-deletes the `contentflags` body while the `authauditlog` trail persists; unresolved flags are never auto-purged; terminal flags follow the configured retention (with `escalated` respecting legal hold).

**Open questions:**
- OQ-1 (async infra): The pipeline is specified as 'async', but the exact mechanism is undecided — in-process fire-and-forget after persist, a DB-polled worker on `contentflags`/an `error`-eligible set, or the deferred RedisBroker/queue from spec 003 T007. Fire-and-forget risks losing classifications on process crash; a durable queue is safer but heavier. Which for v1?
- OQ-2 (authorid FK): Engine tables (`conversationmembers`, `messages.orgmemberid`) are deliberately FK-less to keep the engine decoupled from auth-schema. Should `contentflags.authorid` follow that pattern (plain uuid, no FK) or take a real FK to `users.id` for referential integrity on the review queue? A real FK plus message cascade could complicate erasure ordering.
- OQ-3 (retention vs. erasure conflict): FR-8.16 keeps terminal flags (esp. `escalated`) for legal hold, but a user right-to-erasure / conversation delete cascade-deletes the flag body. Which wins when an `escalated` flag is under active legal hold — does erasure block, or does the flag/excerpt survive the user's deletion? This needs Legal sign-off, not an engineering default.
- OQ-4 (scope of kinds): v1 excludes `agent` and `support` conversations from classification. Agent DMs (AI personal-assistant threads) and support chats can carry private content too — confirm they stay out of scope for v1, or should `support` (org-visible) at least be included?
- OQ-5 (cost/volume controls): On-send classification of every private message calls the system AI provider per message, which has real cost and rate-limit exposure at scale. Is per-message on-send classification acceptable for v1, or should v1 ship the background-sweep mode (FR-8.6b) only / with sampling, and add on-send later?
- OQ-6 (excerpt vs. no-excerpt): FR-8.7 permits storing a bounded plaintext excerpt on the flag to make sysadmin triage possible without a full lawful-access decrypt every time. Storing ANY private plaintext outside the encrypted store is a privacy tradeoff. Should the flag store a redactable excerpt (faster triage) or store ZERO plaintext and force every look at content through the audited Section 7 decrypt path (maximally private, more audit noise)?


---

## [spec 018] Group-chat TOCTOU wrap, people-search rate-limiting, and verified non-bugs (spec 018 §§9–11)

## Section: Group-Chat Atomicity, People-Search Hardening & Verified Non-Bugs

**Spec home:** 018 (Contacts & Direct Messages). Group-chat creation and people-search both live in `lib/contacts/service.ts`; the transaction primitive is provided by the shared Drizzle/Postgres layer (spec 001 engine). No new user-facing surface is introduced by this section — these are correctness, security, and abuse-hardening requirements plus an explicit "no change" ledger so the reviewer knows what was audited and deliberately left alone.

This section is a **proposal**; it describes target behavior only. No implementation code is included.

---

### 9. Group-Chat Creation: Atomic Validate-Then-Add (TOCTOU close)

**Context.** `createGroupChat(creatorid, memberIds)` today (`lib/contacts/service.ts:209`) runs three phases with no transaction: (a) loop `areContacts(creatorid, id)` for every prospective member, (b) create the `group` conversation, (c) `addConversationMember` for the creator and each member. The accepted-contact check in (a) and the member-add in (c) are separated in time. This was previously benign because an accepted contact could not be revoked — but the block/unfriend work in §4 of this delta makes contact removal a real, first-class operation. A concurrent unfriend or block landing between the check and the add now lets a **non-contact (or a user who just blocked the creator) be added to a group chat**, defeating the DM-consent model. This is a genuine TOCTOU that must be closed.

**FR-018-G1 (MUST).** `createGroupChat` MUST perform member validation and member insertion inside a **single database transaction**. The transaction MUST cover: the `areContacts(creatorid, id)` check for every member in the deduplicated set, creation of the `group` conversation, and all `conversationmembers` inserts (creator + members). Either all members are validated and added, or the transaction rolls back and no conversation/membership rows persist.

**FR-018-G2 (MUST).** Within the transaction, the accepted-contact read for each prospective member MUST be evaluated such that a concurrently-committing unfriend/block cannot slip a stale "accepted" result past the add. The implementation MUST use one of: (a) row-level locking of the relevant `contacts` rows for the duration of the transaction (e.g. select-for-update semantics), or (b) `SERIALIZABLE` isolation with retry on serialization failure. The chosen mechanism MUST guarantee that if any pair transitions to not-accepted/blocked before commit, the offending member is rejected and the whole operation fails.

**FR-018-G3 (MUST).** If **any** prospective member fails the accepted-contact check (or is blocked per §4), the entire `createGroupChat` call MUST fail with the existing `not_a_contact` error (HTTP 403) and MUST NOT create the conversation or add **any** members — including members who individually passed. Partial group creation is prohibited.

**FR-018-G4 (MUST).** The existing input guards MUST be preserved and evaluated before/within the transaction: creator is excluded from the member set, the member set is de-duplicated, and an empty resulting set MUST fail with `no_members` (HTTP 400).

**FR-018-G5 (MUST).** Block enforcement (§4) MUST be honored inside this transaction: if any prospective member has blocked the creator, that member MUST be treated as a non-contact and rejected (generic `not_a_contact`; the block MUST NOT be disclosed to the creator, consistent with the silent-block rule).

**FR-018-G6 (SHOULD).** On a serialization-failure retry (if isolation-based locking is chosen), the operation SHOULD retry a small bounded number of times before surfacing a transient error, so ordinary concurrency does not produce spurious user-facing failures.

**Data model:** No schema change. This is a transactional-boundary change around existing reads/writes on `contacts`, `conversations`, and `conversationmembers`.

**Security/privacy note:** This requirement is the join-time enforcement of the same consent invariant the DM send-gate enforces at message time. Closing it prevents a race-based bypass of the "you may only add accepted contacts" rule and, in combination with §4, prevents a **blocked** user from being pulled into a shared room.

---

### 10. People-Search Hardening (rate-limit; keep 2-char minimum + self-exclusion)

**Context.** `GET /api/contacts/search?q=` (`src/app/api/contacts/search/route.ts`) calls `searchUsers(q, ctx.user.id)`. The handler is authenticated but **unthrottled** — an authenticated caller can enumerate/scrape the user directory (name + email substrings) at unlimited request rate. The underlying `searchUsers` correctness controls (2-char minimum, self-exclusion, 10-row cap) are already correct and are retained unchanged; this item adds abuse throttling only.

**FR-018-S1 (MUST).** `GET /api/contacts/search` MUST be rate-limited per authenticated user, using the shared limiter pattern in `lib/auth/ratelimit.ts` (`rateLimit(key, limit, windowMs)`). The rate-limit key MUST be scoped to the caller's user id (e.g. `contacts:search:{userid}`) so one user's searching cannot exhaust another's budget.

**FR-018-S2 (MUST).** The default limit MUST be a rolling window sized to permit normal type-ahead usage while blocking bulk enumeration (proposed default: **~30 search requests / 60s**, tunable via env, mirroring the existing limiter's `limit`/`windowMs` shape). On trip, the endpoint MUST return HTTP **429** with a `retryAfterSec` derived from `RateResult.retryAfterSec`; it MUST NOT return partial or empty results in a way that masks the throttle.

**FR-018-S3 (MUST — no change, retained).** The existing 2-character minimum MUST be preserved: `searchUsers` MUST return an empty result set for any query whose trimmed length is `< 2` (never a full/unbounded directory listing). This guard MUST remain server-side (not merely client-side).

**FR-018-S4 (MUST — no change, retained).** Self-exclusion MUST be preserved: the caller MUST never appear in their own search results (`ne(users.id, selfId)`).

**FR-018-S5 (MUST — no change, retained).** The result cap MUST remain bounded (currently 10 rows); search MUST NOT be usable to page through the entire user table.

**FR-018-S6 (SHOULD).** Block-awareness: results SHOULD exclude users who have blocked the caller (§4), so a blocked user is absent from the blocker-target's reachable set via search. (Cross-references §4's "A is hidden from B's reachable set." If §4 already mandates search-level block filtering, this FR is satisfied there and needs no duplicate implementation.)

**FR-018-S7 (SHOULD).** Repeated rate-limit trips on search from a single user SHOULD be observable (metric/log) so abusive enumeration can be spotted operationally. This is distinct from the §5 contact-request flood freeze — a search-throttle trip MUST NOT freeze the user's contact requests, and MUST NOT write a `contact_flood` audit event.

**Data model:** No schema change. The limiter is the existing in-memory per-instance store in `lib/auth/ratelimit.ts`.

**Security/privacy note:** The shared limiter is per-instance (Map-backed) and does not coordinate across nodes — an accepted, documented limitation carried over from spec 011. Under multi-node deployment the effective limit is multiplied by the node count; a shared store (Redis) is the eventual fix and SHOULD be tracked as the same follow-up already noted for spec 011's limiter, not re-litigated here (see Open Question OQ-S1).

---

### 11. Verified Non-Bugs (audited — NO CHANGE)

The following were reviewed against the current code and found correct. They are recorded here so the reviewer knows they were examined and deliberately left unchanged; no FR mandates a change to any of them.

**NB-1 — Contact-response authorization is correct.** `respondToContact(contactid, userid, accept)` (`lib/contacts/service.ts:128`) restricts accept/decline to the **addressee**: it loads the row and rejects with `forbidden` (HTTP 403) when `row.addresseeid !== userid` (line 133). A requester cannot accept their own request, and an unrelated user cannot act on the pair's request. **No change.**

**NB-2 — Search minimum-length + self-exclusion are correct.** `searchUsers(q, selfId)` (`lib/contacts/service.ts:42`) returns empty for any trimmed query `< 2` chars (line 44) and excludes the caller via `ne(users.id, selfId)` (line 49). Both guards are server-side. (These are additionally retained as MUST-style requirements FR-018-S3/S4 above so the §10 rate-limit change cannot accidentally regress them.) **No change to the guards themselves.**

**NB-3 — Self-connect-via-email is already closed.** A user cannot create a contact edge to themselves by inviting their own email, because email is globally unique across `users` (the auth-layer unique-email constraint). An email invite resolves to at most one account, and that account is the inviter's own only when the addresses match — in which case the accept path's existing `inv.inviterid === userid` self-invite rejection (`acceptContactInvite`, `lib/contacts/service.ts:229`) refuses it. The unordered-pair active-row invariant from §2 further prevents a degenerate self-pair. **No change.**

---

### Acceptance Criteria

Group-chat atomicity (§9):
- [ ] `createGroupChat` runs validation + conversation creation + all member inserts inside one DB transaction.
- [ ] A member unfriended (or who blocks the creator) after the check but before commit causes the whole call to fail with `not_a_contact` (403) and leaves **zero** rows (no conversation, no memberships) behind.
- [ ] A concurrency test that races an unfriend/block against `createGroupChat` never produces a group containing a non-contact or a user who blocked the creator, across repeated runs.
- [ ] Existing guards still hold: creator excluded, members de-duplicated, empty set → `no_members` (400).
- [ ] When one of several members fails validation, **none** of the other (valid) members are added.

People-search hardening (§10):
- [ ] `GET /api/contacts/search` returns HTTP 429 with `retryAfterSec` once a single user exceeds the configured rolling limit; other users are unaffected.
- [ ] The rate-limit key is scoped to the caller's user id.
- [ ] Query of trimmed length `< 2` returns an empty array (verified server-side, not just in the UI).
- [ ] Caller never appears in their own results.
- [ ] Result set stays capped (≤ 10 rows); no pagination path exposes the full user table.
- [ ] A search rate-limit trip does NOT freeze the user's contact requests and does NOT emit a `contact_flood` audit event.

Verified non-bugs (§11):
- [ ] A requester (non-addressee) attempting accept/decline on a contact request receives 403 `forbidden`.
- [ ] A search with a 1-char query returns empty; the caller is absent from all self-searches.
- [ ] Inviting one's own email cannot create a self-contact edge (rejected on accept; no self-pair row is ever created).

---

### Security / Privacy Summary (this section)

- **§9** closes a consent-bypass race: the DM/group "accepted contacts only" rule is now enforced atomically at join time, matching the message-time send-gate, and honors silent blocks without disclosing them.
- **§10** limits directory enumeration by authenticated users without weakening the retained correctness guards; the per-instance limiter's cross-node weakness is a known, documented limitation, not introduced here.
- **§11** documents audited-clean controls so future refactors don't silently regress authorization, search-length, or self-connect protections.

**Open questions:**
- OQ-S1 (spec 018 §10): The shared rate limiter in lib/auth/ratelimit.ts is in-memory and per-instance; under multi-node ECS deployment the effective search/flood limits multiply by node count. Do we accept this for v1 (matching spec 011's documented limitation) or gate a shared-store (Redis) limiter before launch? Recommend tracking as one cross-cutting item alongside the spec 011 limiter, not per-endpoint.
- OQ-S2 (spec 018 §10): Confirm the default people-search limit (~30 req/60s). Type-ahead UIs can burst; if the client debounces search input, 30/60s is comfortable, but an un-debounced keystroke-per-request client would trip it. Decide whether the client MUST debounce (and at what interval) or whether the server limit should be raised.
- OQ-G1 (spec 018 §9): Choose the concurrency mechanism for the group-chat transaction — row-level locking of contacts rows (select-for-update) vs SERIALIZABLE isolation with bounded retry. Locking is simpler and lower-overhead for the typical small member set; SERIALIZABLE is more uniform if other multi-row invariants (e.g. §2 unordered-pair) adopt it too. Pick one project-wide policy to avoid mixed isolation semantics.
- OQ-S3 (spec 018 §10 / §4 boundary): Is search-level exclusion of users who blocked the caller owned by §4 (block/reachable-set) or by §10 (search)? FR-018-S6 defers to §4 if §4 already mandates it; confirm the single owner so it isn't implemented twice or dropped between the two sections.


---

## Adversarial review findings (resolve before/at implementation)

1. **[critical] Section 4 vs Section 5 — FR numbering collision (contradiction between sections)** — Section 4 (Block/Unfriend) numbers its FRs FR-018-40 through FR-018-58, defining FR-018-51 = 'Unblock MUST NOT auto-restore the contact' and FR-018-52 = 'MUST provide symmetric unfriend'. Section 5 (Flood Guard) independently numbers its FRs FR-018-51 through FR-018-62, defining FR-018-51 = 'Rolling-rate trip' and FR-018-52 = 'Freeze on trip'. FR-018-51 and FR-018-52 therefore each name TWO different requirements. Worse, Section 5 also reuses FR-018-53..FR-018-58, which Section 4 already uses (FR-018-53 unfriend-KEEP/DELETE prompt vs FR-018-53 frozen-check-first; FR-018-57 block-supersedes vs contactfreezes-persist; FR-018-58 mutual-block vs held-until-cleared). Every cross-reference to these numbers (e.g. §9 'blocked per §4', §5 'FR-018-53 MUST run before the block check') is now ambiguous, and tasks/acceptance traceability breaks.
   - *Suggested:* Renumber one block. Since Section 4 was authored first in the ordering, keep FR-018-40..58 for Block/Unfriend and renumber Section 5's flood-guard FRs to a fresh non-overlapping range (e.g. FR-018-70..FR-018-81), then fix the internal cross-references in §5 ('frozen check FR-018-53' → new number) and §4/§9's references. Add a single consolidated FR-index at the top of the spec-018 delta so future sections don't collide.
2. **[high] Section 2 data model — one-active invariant is only conditionally enforceable; migration/backfill has an unhandled gap** — FR-2.3 makes the at-most-one-active invariant normative and relies on a partial unique index on (usera,userb) WHERE status IN ('pending','accepted'). But (a) OQ-A leaves it open whether the index or an app-level transactional guard is used — if the product picks the app-only guard, the invariant is NOT actually enforced at the DB and concurrent inserts can create two active rows (the current requestContact at service.ts:104-117 does a read-then-insert with no transaction, exactly the race). (b) The backfill says it MUST 'fail loudly' if any pair holds >1 active row 'should not, given today's unique index' — but today's unique index is on the ORDERED pair (requesterid,addresseeid), so a pair CAN legitimately have two active rows today: A→B accepted and B→A pending are two distinct ordered pairs both active for the same unordered pair. The backfill will fail on legitimate existing data, or (if it doesn't check) silently violate the new invariant.
   - *Suggested:* Make the partial unique index mandatory (resolve OQ-A to 'index required') so the invariant is enforceable regardless of app logic. In the migration, add an explicit pre-backfill reconciliation step for the ordered-pair-produces-two-active-rows case (define which active row wins — e.g. keep the accepted, decline the pending) rather than only 'fail loudly'. State that requestContact must wrap read-then-insert in a transaction AND rely on the unique index (belt-and-suspenders), matching FR-2.7's idempotent-on-conflict behavior.
3. **[high] Section 7 vs engine reality — system messages cannot currently be encrypted; postSystemMessage uses non-UUID author ids and writes plaintext content** — FR-018-ENC-006 requires system messages in private-tier conversations to be encrypted with content=NULL and encryptedpayload set. But the built postSystemMessage (engine/service.ts:277) writes plaintext to messages.content, and existing contact system messages use authorid='yappchat-contact' (a non-UUID string). The 'wants to connect' body embeds the requester's real display name (service.ts:122) — a social-edge disclosure Section 7 explicitly says belongs to the private tier. The delta states the requirement but gives no path for postSystemMessage to obtain/derive the conversation DEK, and provisioning (FR-018-ENC-010) is described as 'on first message send' — a connect-request system message is frequently the FIRST message in a brand-new 1:1, so the DEK-provisioning-on-first-send and the system-message-encryption paths must interlock. This ordering is unspecified.
   - *Suggested:* Add an explicit FR: postSystemMessage into a private-tier conversation MUST provision the conversationkeys DEK if absent (idempotent) and encrypt exactly like user messages, and MUST NOT be exempted by its non-UUID authorid. State the ordering (provision DEK → encrypt system message → persist) and add an acceptance criterion that the first-ever message in a person conversation being a system 'wants to connect' still yields a conversationkeys row and content IS NULL.
4. **[high] Section 3 vs Section 2 — acceptContactInvite 'upgrade existing active row to accepted' can violate the one-active invariant and contradicts immutability** — FR-006b.4 says the winner 'upgrades' an existing active row to accepted or inserts a new accepted row, 'consistent with the at-most-one-active invariant'. But Section 2 FR-2.1 makes rows IMMUTABLE except for the single pending→terminal transition, and defines 'connected' as an accepted row existing. If an active PENDING row already exists in the OPPOSITE direction (invitee had already requested the inviter, or vice-versa), upgrading it to accepted is fine; but if a pending row exists in the SAME direction that the invite would create, or if the pair already has an accepted row, the 'upgrade' semantics are underspecified and could either no-op-incorrectly or create a second active row. The current code (service.ts:231-236) blindly flips ANY existing row to accepted, which under the new immutability rule (no resurrecting declined→...) is now illegal for a declined history row.
   - *Suggested:* Specify acceptContactInvite's contact-write precisely against the Section 2 states: if an accepted row exists → no-op return it; if a pending row exists (either direction) → transition THAT row to accepted (allowed pending→accepted); if only declined/no active row → insert a NEW accepted row (never resurrect a declined row). Cross-reference FR-2.1's single-transition rule and confirm the invite-accept path cannot flip a declined row in place.
5. **[high] Section 8 async classification vs Section 7 crypto-shred deletion — a race can drop or orphan flags; enqueue/persist/delete ordering undefined** — FR-8.3 enqueues classification AFTER durable persist; FR-8.4 reads plaintext via the Section 7 KMS unwrap. But Section 4 DELETE (FR-018-55) and Section 7 crypto-shred (FR-018-ENC-019) can delete the conversation + conversationkeys between enqueue and the async classifier run. When the classifier dequeues, the DEK is gone (crypto-shredded) so it can neither decrypt nor classify — FR-8.9 would record status='error' and FR-8.6b makes it 're-eligible for the background sweep', creating an infinite un-satisfiable retry loop on a deleted conversation. Conversely, contentflags FKs cascade-delete on message/conversation delete (§8.7 note), so a flag created just before deletion vanishes while the message it flagged is also gone — acceptable, but the errored-queue-item case is not handled.
   - *Suggested:* Add an FR: a queued classification whose conversationkeys row / conversation no longer exists MUST be dropped (terminal 'skipped'/'obsolete'), NOT retried as an error, so deletion (crypto-shred) cleanly cancels pending classification. Define enqueue payload to carry conversationid+messageid+keyversion and have the worker treat missing key/conversation as a terminal non-error outcome.
6. **[medium] Section 1 vs Section 6 — non-member public-space READ contradicts @mention-route needing membership resolution and reachable-set** — Section 1 FR-A2 lets a non-member READ a public space. Section 6 FR-6.10 lets a NON-MEMBER of a public space @mention-route a private DM to someone 'in it'. But FR-6.1 resolves a mention token ONLY against communitymembers of the space's community, and a non-member author reading the space has no membership context establishing who is 'reachable'. There is no stated rule for how a non-member's composer even submits into a space they can only GET (Section 1 says POST always requires membership, and FR-6.9 says a non-member has 'no public-post fallback'). So the mechanism by which a non-member's @mention message reaches the server route at all (which endpoint, given POST to the space is 403 for non-members) is unspecified — the capture point for a non-member's mention-route is undefined.
   - *Suggested:* Specify the submission endpoint/flow for a non-member's mention-route (it cannot be POST /conversations/[space]/messages since that 403s non-members). Either introduce a dedicated space-scoped compose endpoint that runs mention resolution before the join-to-post gate, or resolve OQ-4 to 'must join to mention-route' and delete FR-6.10. As written, FR-6.10's capability has no route.
7. **[medium] Section 5 flood counter double-count vs email-invite path (FR-018-51) and Section 3** — FR-018-51 (§5) says the flood counter MUST count 'any email-bound invite send that creates an outbound wants-to-connect record'. But inviteContactByEmail (service.ts:182-206) has two branches: if the email matches an existing user it calls requestContact (which itself would increment), and if not it creates a contactinvites row (no requestContact). Counting 'the invite send' AND the internal requestContact call would double-count the existing-user branch. Also §5 open question and FR-018-51 disagree on whether email invites share the same window or get a separate limit (OQ says 'assumes shared; confirm'), leaving the count semantics ambiguous.
   - *Suggested:* Define the counting seam at exactly one place — either count at the public requestContact/inviteContactByEmail entrypoints (and have requestContact NOT double-count when called internally by the invite path), or count only successful outbound 'wants to connect' record creations. State explicitly that the existing-user invite branch counts once, not twice.
8. **[medium] Section 4 KEEP read-only vs Section 1 membership gate — read-only enforcement mechanism unspecified and conflicts with the sole-enforcement-point rule** — FR-018-54 (KEEP) requires the person conversation become read-only with 'both parties retain read access'. But send-gating is re-applied via the declined contacts status (so POST is already blocked by sendMessage's not_connected gate), while READ for a person conversation is gated ONLY by isConversationMember (Section 1 FR-A1) — and unfriend does NOT remove conversationmembers rows on KEEP. So 'read-only' is really 'send-blocked, read-open', which matches intent, but FR-018-54 also says 'until a subsequent delete or block-driven action changes it' with no column/flag modeling the archived/read-only state. There is no data-model field (e.g. conversations.archivedat or a status) to represent read-only, so the client 'render as archived' requirement has nothing to read.
   - *Suggested:* Either state explicitly that read-only = (declined contact ⇒ send-gated) + (membership retained ⇒ read allowed) with NO new column, and that the client infers archived state from the absence of an accepted contact; or add a modeled conversation/contact flag if a durable archived marker is needed. Remove the ambiguous 'read-only' language that implies a state not stored anywhere.
9. **[medium] Section 6 FR-6.6 unconnected-route vs Section 8 monitoring — dropped author body is unmonitored, but connect system-message is; OQ-3 leaves body disposition undecided affecting acceptance criteria testability** — FR-6.6/FR-6.11 and OQ-3 leave undecided whether the author's typed body is dropped, held server-side, or discarded when routing to an unconnected target. The acceptance criterion 'the author's typed body is not delivered as an author message while unconnected (per OQ-3 disposition)' is therefore not testable — its expected result depends on an unresolved open question. If OQ-3 picks 'HOLD the drafted body', that held body is private content that must also be encrypted (Section 7) and classified (Section 8) once delivered, but no holding-table encryption/monitoring requirement exists (6.3 defers the table entirely).
   - *Suggested:* Resolve OQ-3 before approval (recommend (a) drop, matching current requestContact which sends no author text — simplest and needs no holding table). If (b) hold is chosen, add explicit FRs that the held body is escrow-encrypted at rest and enters Section 8 monitoring on delivery. Make the acceptance criterion concrete for the chosen option so it is testable.
10. **[medium] Section 7 message-storage — encryptionkeyid reuse to reference conversationkeys.id is left as an Open Question but is load-bearing for DEK rotation acceptance** — FR-018-ENC-009 requires each message to record the DEK keyversion 'reusing encryptionkeyid to reference conversationkeys.id, or a documented equivalent', and the acceptance criterion 'DEK rotation preserves decryptability of historical messages (via retained keyversion material)' depends on this linkage. But the column choice is flagged as an Open Question ('reuse messages.encryptionkeyid vs add conversationkeyid'), so the acceptance criterion cannot be verified until the column is decided. encryptionkeyid is currently a deferred spec-001 stub typed uuid pointing (nominally) at userencryptionkeys; conversationkeys.id is also uuid, so a reuse is type-compatible but semantically overloads the column across two different target tables with no discriminator.
   - *Suggested:* Decide the column in-spec rather than deferring: prefer a dedicated conversationkeyid uuid on messages (avoids overloading encryptionkeyid across userencryptionkeys vs conversationkeys). Then the rotation acceptance criterion becomes testable. If reuse is chosen, document that encryptionkeyid's referent is determined by encryptiontype ('escrow' ⇒ conversationkeys.id).
11. **[medium] Section 8 authorid provenance — flag records message author, but messages.authorid is TEXT holding non-user ids (system authors), and OQ-2 leaves FK undecided** — contentflags.authorid is 'NOT NULL, the flagged message's author (users.id)'. But messages.authorid is TEXT and can hold non-UUID system authors (e.g. 'yappchat-contact' for connect-request system messages, per service.ts:120). Section 7 FR-018-ENC-006 says system messages in private tiers ARE encrypted and thus in-scope for classification (Section 8 classifies decrypted private content). A flagged system message would have a non-UUID authorid that cannot satisfy a NOT-NULL uuid users.id column or an FK to users. OQ-2 debates the FK but not the non-user-author case.
   - *Suggested:* Specify how contentflags.authorid handles non-user/system authors: either make it nullable text mirroring messages.authorid (no FK, matching the engine's FK-less pattern), or exclude system messages from classification (but that contradicts ENC-006 encrypting them as social-edge-sensitive). Pick one and state it; the current NOT-NULL uuid conflicts with the message model.
12. **[low] Terminology — 'admin space' flag name inconsistent (adminonly) and public-test wording drift between Section 1 and Sections 5/7/8** — Section 1's §1.2 public test is a 4-part conjunction including corponly=false. Sections 5, 7 (FR-018-ENC-004/005) and 8 (Scope boundary) restate the 'public space' definition as only 3 parts: 'community discoverability=public AND space does not override stricter AND not the admin space' — omitting the corponly disqualifier that Section 1 makes normative. A corp-only space inside a public community would be classified public by the 3-part restatements (→ plaintext, unmonitored) but private by Section 1 (→ encrypted, monitored). This is a real cross-section contradiction about which spaces get encrypted/monitored.
   - *Suggested:* Define the public-space predicate ONCE (Section 1 §1.2, the 4-part conjunction incl. corponly) and have Sections 5/7/8 reference it by name ('a PUBLIC space per §1.2') instead of restating a 3-part version. Fix the FR-018-ENC-004/005 and §8 scope wording to include the corponly disqualifier so corp spaces are unambiguously private-tier (encrypted + monitored).
13. **[low] Section 2 FR-2.7 opposite-direction handling references OQ-B but states a SHOULD that contradicts FR-2.8 accept-authority** — FR-2.7 says if an active pending row exists in the OPPOSITE direction, the system 'SHOULD surface/accept the incoming request rather than creating a competing pending row (see OQ-B)'. OQ-B leans toward auto-accept as mutual intent — but FR-2.8 states only the addressee may accept. If B initiates toward A while A→B is pending, auto-accepting makes B (the original addressee) effectively accept via a request action, which is consistent, but if the partial unique index is in force, B's insert simply fails the unique constraint and there is no code path to 'surface/accept' unless explicitly written. The invariant enforcement (index) and the desired UX (auto-accept) are in tension and unspecified.
   - *Suggested:* Resolve OQ-B before approval. If auto-accept is chosen, add an explicit FR that requestContact, on detecting an opposite-direction active pending row, transitions THAT row to accepted (a legal pending→accepted move by the addressee-initiated action) instead of inserting — so the unique index never trips and FR-2.8 is honored. Make the acceptance criteria cover the opposite-direction case explicitly.
14. **[low] Section 5 FR-018-59/60 — sysadmin review surface and unfreeze endpoint are new UI/API surfaces with no route/endpoint named and no acceptance criterion for the notify-user delivery channel** — FR-018-55 requires notifying the frozen USER 'at trip and on subsequent attempts', but the delivery channel is unspecified — requestContact returns an error synchronously (that covers subsequent attempts), but the AT-TRIP notification to the user has no channel (email? in-app? the rejection is only seen on the NEXT attempt). Also FR-018-59/60 mandate a sysadmin-only review surface + unfreeze action but name no route (unlike Section 7's named /api lawful-access), so the SPEC-FIRST gate can't trace them to an endpoint. authauditlog.eventtype extension to 'contact_flood'/'contact_unfreeze' is specified as text (correct) but the AuthEventType union extension (audit.ts:10-23) is only a SHOULD, meaning a typo'd eventtype won't be caught.
   - *Suggested:* Specify the at-trip user-notification channel (e.g. the trip itself returns the frozen error to the triggering request, so 'at trip' = the tripping request's response — state that explicitly, or add an in-app banner/email). Name the sysadmin endpoints (e.g. GET /api/admin/contact-freezes, POST /api/admin/contact-freezes/[id]/unfreeze) so they're traceable. Upgrade the AuthEventType union extension to MUST for the two new event types.
15. **[critical] Section 7 (escrow encryption) + Section 1 (tier gating) — WS legacy channel scope leaks all private plaintext** — The delta bases the entire escrow/monitoring model on the membership-checked `conversation:{id}` scope, but the engine publishes EVERY message to BOTH `scopes.channel(channelid)` AND `scopes.conversation(conversationid)` (engine/service.ts publishMessageEvent, lines 313-322). In server/ws.ts line 204 the `channel:` subscribe is unconditionally authorized (`if (scope.startsWith("channel:")) return true;`). Because ALL person + group DMs share ONE 'direct' channel (getDirectChannel / DIRECT_PLATFORM in contacts/service.ts), and every private/closed community space rides its community's single channel, ANY signed-in user can `subscribe` to `channel:{directChannelId}` (or a community channel id) and receive the live plaintext of every private DM, group, and private-space message in real time. This bypasses the members-only gate (FR-A1/A2), the escrow-at-rest guarantee (FR-018-ENC-012 says decryption is offered ONLY to members), and the monitoring/lawful-access accountability entirely — the plaintext is fanned out over an open scope before any of it applies. The delta's threat model (7.8) and Section 1 assume conversation-scope is the only live path; it is not.
   - *Suggested:* Add a normative FR to Section 1/7: the legacy open `channel:` scope MUST NOT carry private-tier (person/group/private-space) message payloads. Either (a) stop dual-publishing private-tier messages to `channel:{id}` (publish only to `conversation:{id}`), or (b) make canSubscribe for `channel:` membership-checked / restrict it to non-private channels, and add an acceptance criterion: 'a signed-in non-member who subscribes to the shared direct channel scope receives NO private DM/group/space events.' Also require that WS-delivered private payloads are decrypted per-recipient only after the conversation-membership check, never broadcast.
16. **[critical] Section 7 FR-018-ENC-001/012 vs Section 8 — 'sysadmin-only lawful access' is contradicted by routine server-side unwrap; the restriction is illusory as written** — The review question asks whether 'sysadmin-only lawful access' actually restricts who can decrypt, given the server unwraps for normal reads. As specified it does NOT. FR-018-ENC-012 has the server call KMS Decrypt on every member read (REST GET, WS delivery, notification body), and Section 8 has a background/async classifier that unwraps and reads plaintext of every private message. So the app's KMS role can decrypt any conversation at will; the 'sysadmin-only' control (FR-018-ENC-015) governs only ONE explicit export endpoint, not the decrypt CAPABILITY. Anyone who can invoke the app's KMS role (any code path in the Next app, a compromised app credential, an SSRF/RCE, or a rogue engineer with deploy access) can decrypt everything WITHOUT tripping the authauditlog/2-trail accountability that the spec leans on. 7.8 admits this ('does NOT protect against anyone who can invoke KMS Decrypt with the app's KMS role') but the FRs still assert lawful access is 'sysadmin-only' and that 'no other role can access keys/plaintext' (FR-018-ENC-015), which is false for the decrypt operation itself. The two statements are in direct tension and the spec presents the weaker guarantee as if it were the stronger one.
   - *Suggested:* Rewrite FR-018-ENC-015's claim to be precise: the AUDITED EXPORT endpoint is sysadmin-only, but the server (app KMS role) can decrypt any private conversation as an inherent property of escrow. Make the accountability real: (1) require a dedicated, tightly-scoped KMS grant used ONLY by the lawful-access export and the monitoring worker, distinct from the member-read decrypt path, with KMS key policy + CloudTrail alerting on any Decrypt outside those callers; (2) require per-read audit or at least anomaly detection on the member-read decrypt volume; (3) state plainly in ToS/threat-model that the operator can read all private content at any time (not just via the export endpoint). Do not let 'sysadmin-only lawful access' imply the plaintext is otherwise unreachable.
17. **[critical] Section 8 FR-8.15 / Section 7 FR-018-ENC-001 — disclosure is a release-checklist item, not a hard technical gate; monitoring of private messages without consent is the top legal exposure** — The most legally-sensitive requirement (automated scanning of private 1:1 and group messages against a criminal taxonomy, with human sysadmin review of decrypted content) is gated only by 'the enable flag defaults OFF and cannot be turned on in production until disclosure copy is live (release-checklist item).' A checklist item is a process control, not an enforced one — nothing in the data/authz model prevents the flag being flipped on before ToS/Privacy Policy are updated, and 'disclosure is live' is not machine-verifiable. In many jurisdictions (EU ePrivacy/GDPR, US wiretap/ECPA two-party-consent states, UK IPA) scanning the content of private interpersonal communications requires a lawful basis and specific, prior, conspicuous disclosure — and possibly more than a ToS line (e.g. explicit consent, DPIA, or a legal-process predicate). Relying on a taxonomy the model 'MUST evaluate' also risks over-collection: the classifier reads 100% of private content, not just criminal content. This is stated as an engineering default where it needs Legal sign-off (partly acknowledged in OQ-3 but not elevated).
   - *Suggested:* Elevate FR-8.15 from a checklist item to a HARD, enforced gate with Legal sign-off as a blocking dependency before ANY code: (1) require an explicit, versioned 'monitoring_disclosure_version' + 'monitoring_enabled_at' config that the classifier worker asserts is present and post-dates the disclosure before it will run (fail-closed if absent); (2) require a documented lawful basis and jurisdiction analysis (which user residencies are in scope, whether opt-in consent is needed) as an acceptance criterion, not an open question; (3) consider limiting the classifier to a narrower predicate or on-report basis rather than blanket scanning of all private content, to reduce the over-collection surface. Do not ship blanket private-content scanning on a ToS line alone.
18. **[high] Section 5 FR-018-51/52 — the flood-freeze can be weaponized to silently suppress a target's contact requests (freeze-someone-else via forced tripping)** — The review asks whether the freeze can be weaponized to freeze someone else. As specified, the freeze keys on the SENDER, which is correct — but the counter (FR-018-51) counts 'each accepted attempt to send a contact request' including 'any email-bound invite send'. Because inviteContactByEmail can be sent to ARBITRARY email addresses (no relationship required) and the delta shares that count with in-app requests, an attacker cannot freeze a victim directly — HOWEVER, there is an adjacent weaponization: the freeze is a HARD, non-expiring, human-gated stop. Combined with Section 2's 'immediate re-request after decline, no cooldown' and the fact that a re-request posts a 'wants to connect' message each time, a coordinated set of accounts (or an account whose credentials are shared) can trivially self-trip to generate sysadmin mail storms (FR-018-56 emails the ENTIRE issystemadmin set on every trip). More importantly, the freeze is applied to a legitimate power user who imports an address book (10/60s default is very low — one address-book import trips instantly), amounting to a self-inflicted denial-of-service on legitimate onboarding, and the ONLY recovery is manual sysadmin action (FR-018-58), so a single mis-tuned default converts normal usage into a support incident and a mail flood.
   - *Suggested:* (1) Raise the default well above address-book-import bursts or exempt/curve the email-invite path (OQ acknowledges this—decide it, don't defer). (2) Add rate-limiting/dedup/batching to the sysadmin SES notification (a digest, not one email per trip) so trips cannot be used as a mail-bomb against admins. (3) Add an auto-review or auto-expiry-with-review-flag option for FIRST offenses so a legitimate user isn't hard-stopped until a human happens to look; reserve the permanent human-gated freeze for repeat offenders. (4) Explicitly confirm the counter keys only on the authenticated sender id and cannot be incremented on another user's behalf.
19. **[high] Section 6 FR-6.7 / FR-6.1 — @mention→PM is a block-probing and enumeration oracle despite the 'silent' intent** — FR-6.7 says a blocked/self-blocked mention 'degrades to literal text' and the message 'either posts as plaintext if the author is a member, or is rejected for join-to-post.' That branch itself is the oracle: the AUTHOR observes a materially different outcome depending on block/reachability state. If the author is a non-member (common for 'read + DM without posting', FR-6.10), then: mentioning a reachable user => private route + composer feedback 'sent to DM' (FR-6.11); mentioning a user who has BLOCKED them => not routed, and since the author is a non-member the message is rejected for join-to-post (FR-6.9). Those two responses are trivially distinguishable, so an author can probe 'has X blocked me?' by @mentioning X from a public space and observing whether they get 'sent privately' vs 'join to post'. This defeats the Section 4 silent-block guarantee (FR-018-43) that block state must be indistinguishable from 'not connected'. The same path also lets an author confirm which handles resolve to real community members (FR-6.2 leaves unresolved tokens as literal text but resolved-and-routed tokens produce the DM-feedback), an enumeration signal.
   - *Suggested:* Make the mention-route outcome INDISTINGUISHABLE across block/unreachable/nonexistent: e.g. always give the same composer feedback shape regardless of whether a private route actually happened, or route unconditionally to a 'request sent' style acknowledgement that reveals nothing about the target's block or membership state. Ensure a blocked-author mention and a mention of a connected-but-unroutable user and a mention of a nonexistent handle all return the identical response and timing. Reconcile FR-6.7/6.9/6.11 with FR-018-43 explicitly and add an acceptance criterion asserting response+timing parity.
20. **[high] Section 7 FR-018-ENC-004/005 + FR-018-ENC-006 — tier is DERIVED per-message with no stored discriminator, so a space flipped public↔private silently mis-encrypts (or exposes) history and monitoring** — Section 1.4 and 7 keep the tier fully DERIVED (community.discoverability + space.discoverability + adminonly + corponly) with 'no schema migration proposed'. But encryption-at-rest and monitoring are decided at WRITE time from that derived tier. A community/space's discoverability is mutable (spec 017 community:update / space:update capabilities exist). Concrete failure: a private space accrues escrow-encrypted history + a conversationkeys row; an owner later flips the community to discoverability=public (or removes a stricter space override). Now the SAME conversation is 'public' by the §1.2 test, so FR-018-ENC-005 says its messages should be plaintext and NOT routed through KMS/monitoring — but the existing rows are ciphertext with content=NULL, and new public readers (FR-A2 non-member read) will get undecryptable/empty content OR the server must keep unwrapping 'public' content (contradicting FR-018-ENC-005's 'public spaces MUST NOT be routed through KMS unwrap'). The reverse (public→private) leaves a backlog of plaintext, unmonitored messages in a now-'private' space that users will assume are protected. Nothing in the delta specifies re-encryption/backfill or freezes tier on a conversation, and the read path branches on derived tier, not on the message's own encryptiontype.
   - *Suggested:* Bind encryption/monitoring to the per-message stored discriminator (messages.encryptiontype = 'escrow' vs 'platform') and/or the conversationkeys.mode row on the READ path, NOT to the live-derived tier — a message that was written escrow MUST always be read via unwrap regardless of the space's current discoverability. Then specify what a discoverability flip does: either forbid flipping a space with existing escrow history to public without an explicit, audited re-encryption/backfill step, or make the tier of a conversation sticky once it has a conversationkeys row. Add acceptance criteria for both flip directions.
21. **[high] Section 8 FR-8.16 vs Section 4/7 deletion (crypto-shred) + right-to-erasure — conflicting mandates with no resolution** — Three deletion/retention mandates collide and the delta defers the conflict to OQ-3 (Legal) while still stating each as a MUST: (a) FR-018-ENC-019 crypto-shreds a conversation on delete (unfriend→Delete, space delete) by removing conversationkeys — after which ciphertext is permanently unreadable; (b) FR-8.16 requires terminal contentflags (esp. 'escalated' under legal hold) to be RETAINED and says the excerpt MAY be kept for confirmed/escalated flags; (c) the Section 8 note says deleting the message cascade-deletes the contentflags BODY while authauditlog persists. So if an 'escalated' flag is under active legal hold but the underlying conversation is deleted (or the DEK crypto-shredded), the retained flag's messageid/conversationid FKs cascade away and the ONLY preserved evidence is a stored excerpt (if kept) plus an audit row — the actual message content that legal hold is meant to preserve is destroyed by the crypto-shred. Conversely, if the user has a right-to-erasure request, the 'escalated'-under-hold retention blocks it. The spec has DELETE as a user-triggered MUST (FR-018-55) and also has legal-hold-forces-KEEP (FR-018-53/55) but the hold source of truth is itself an open question (OQ-018-A), so the gate that would prevent the crypto-shred is unspecified.
   - *Suggested:* Resolve the precedence explicitly before build: a conversation/DEK with ANY open or escalated contentflag (or under legal hold) MUST NOT be crypto-shredded or hard-deleted — deletion must be blocked or downgraded to a tombstone that preserves the ciphertext + DEK until the hold clears. Make the legal-hold source of truth (OQ-018-A) a blocking decision, not an open question, since three MUSTs depend on it. Specify that FR-018-ENC-019 crypto-shred is gated on 'no active hold/flag' and that the contentflags excerpt alone is not treated as sufficient evidence when a hold requires the full content.
22. **[high] Section 3 FR-006a — email-binding relies on a verified, immutable account email; unverified/changeable email or plus-address aliasing reopens the unsolicited-connection vector** — The invite hardening binds acceptance to 'the accepting user's account email == inv.email (case-insensitive)'. Its security rests on the account email being (a) verified and (b) not attacker-controllable. The delta does not require the accepting account's email to be VERIFIED at accept time. If signup allows an unverified email (or if a user can set/change their account email to an arbitrary string without verification), an attacker who obtains a leaked invite link can simply create/switch an account to the invited email and satisfy the check — restoring the bearer-token weakness the section set out to close. OQ-D also punts on plus-addressing/dotted-Gmail normalization: if the platform's unique-email constraint treats jane+x@gmail.com and jane@gmail.com as distinct but the mail provider delivers both to the same inbox, an attacker controlling the alias can accept invites addressed to the canonical address (or vice versa), and the 'only the invited email may accept' guarantee is weaker than stated.
   - *Suggested:* Add an FR: acceptContactInvite MUST require the accepting account's email to be VERIFIED (email_verified) and MUST compare against the verified email only; an unverified-email account cannot consume an invite. Specify whether account email is immutable or, if changeable, that changing it requires re-verification and does not retroactively enable pending invites. Decide OQ-D (recommend canonicalizing provider aliases OR documenting that binding is to the exact registered address and invites to alias addresses are the inviter's risk). Add acceptance criteria covering unverified-email accept (rejected) and email-change-then-accept.
23. **[medium] Section 1 §1.2 / FR-A2 — public-space non-member read has no scrape/rate control and no backlog cap; a signed-in scraper can drain all public history** — FR-A2 grants any signed-in user unlimited GET on a public space's FULL history without joining, and the delta itself raises (but does not decide) the anti-scrape and backlog-window open questions. Combined with Section 10 only rate-limiting people-search (not the message route), an authenticated adversary can enumerate and exfiltrate the entire message backlog of every public space at unlimited request rate, harvesting authors, timestamps, and content of every public community — a mass-collection surface that also feeds deanonymization of who posts where. listMessages caps at 200 rows per call but nothing prevents paging via time windows once pagination lands, and no per-non-member throttle is specified.
   - *Suggested:* Add a MUST (not an open question) to rate-limit the non-member public-read GET per user (reuse lib/auth/ratelimit.ts, keyed contacts-search-style), and decide the backlog-window question (cap non-member reads to a recent window until they join, or accept full history with an explicit product decision). Add an acceptance criterion that a single user cannot enumerate public-space history beyond the configured rate.
24. **[medium] Section 8 FR-8.4 / FR-8.7 — storing decrypted excerpts (and the classifier reading 100% of private plaintext) undercuts the escrow-at-rest guarantee and creates a second, weaker plaintext store** — FR-8.7 permits a 'bounded plaintext excerpt' stored on the contentflags row, and FR-8.4 has the classifier decrypt every in-scope message. The excerpt is stored in the contentflags table as plaintext `excerpt text` (§8.6 data model) — i.e. OUTSIDE the encrypted messages store, with no conversationkeys wrapping. This means a DB dump of contentflags yields real private plaintext of flagged conversations, directly contradicting the Section 7 guarantee (FR-018-ENC-007 note: 'a full database dump ... yields no plaintext'). It also means the most sensitive content (that which matched a serious-crime classifier, e.g. child-safety) is the content most likely to sit in cleartext in a secondary table. OQ-6 raises this but leaves it undecided; meanwhile FR-8.7 already says the flag MAY include the excerpt, so the permissive path is the default.
   - *Suggested:* Default to storing ZERO plaintext on contentflags (force every review through the audited Section 7 decrypt path), OR if an excerpt is kept for triage, require it to be encrypted under the SAME conversation DEK (or a dedicated KMS-wrapped key) so a contentflags dump is not plaintext, and require excerpt redaction/nulling on dismissal (already SHOULD in FR-8.16 — make it MUST for child_safety category). Reconcile FR-8.7 with the FR-018-ENC-007 'no plaintext in a DB dump' claim explicitly.
25. **[medium] Section 2 OQ-D / FR-2.6 — reusing one conversation per pair leaks decline history into the thread, contradicting the no-decline-disclosure privacy control** — FR-2.6 and the Section 2 security note require that neither party can observe a prior decline (no re-request flag, identical 'wants to connect' text). But getOrCreateDirectConversation reuses ONE conversation per unordered pair (contacts/service.ts getOrCreateDirectConversation, keyed on any contact row between the pair), and system messages ('wants to connect', 'X accepted — you're now connected', and by extension any decline notice) accumulate in that single thread. So a re-request's new 'wants to connect' lands in a thread that already visibly contains the earlier request's system messages and any accept/decline traces — the addressee can plainly see this is a repeat approach, defeating the 'never observable' guarantee. The delta flags this as OQ-D but simultaneously asserts the no-disclosure requirement as normative, leaving a contradiction.
   - *Suggested:* Decide OQ-D in favor of the privacy invariant: either (a) do not persist decline as a visible system message in the shared thread, and ensure the re-request 'wants to connect' cannot be distinguished from a first request given prior thread contents, or (b) clear/rescope prior request-system-messages on decline+purge so a re-request thread looks fresh. Add an acceptance criterion that the addressee's view of a re-request is byte-identical to a first-time request.
26. **[medium] Section 4 FR-018-42/43 vs FR-018-54 (KEEP read-only) — silent block leaks via the retained read-only DM state visible to the blocked user** — Block MUST be silent (FR-018-43): B must not be able to distinguish 'A blocked me' from 'A is not a contact / does not exist'. But FR-018-41 downgrades the accepted contact to 'declined' and retains the DM read-only by default (FR-018-42), and OQ-018-D openly admits the unresolved conflict: does B still see the historical thread read-only, and does the thread transition observably? If B had an active, sendable DM with A and it suddenly becomes read-only / send-gated with a 'not_connected' error, that state change is itself a signal — an ordinary unfriend produces the same read-only+declined state, but B experiences a transition at the exact moment A blocks, and B's send now fails where it previously succeeded. A determined harasser watching for the moment their DM stops working can infer the block. The generic-error requirement covers the ERROR CODE but not the observable STATE TRANSITION and its timing.
   - *Suggested:* Resolve OQ-018-D as a blocking item: define exactly what B sees on block (recommend: identical to an unfriend-by-the-other-party, which is already a legitimate observable state, so block is hidden within the unfriend population) and ensure the transition timing/behavior of block is indistinguishable from a normal unfriend. Add an acceptance criterion asserting B cannot distinguish 'A blocked me' from 'A unfriended me' from state, error, or timing.
27. **[medium] Section 7 FR-018-ENC-013 — 60s in-memory DEK cache widens the plaintext-key exposure window and is not evicted on lawful-access/membership change** — The SHOULD-cache of an unwrapped DEK in process memory (default <=60s) is a real key-material-at-rest-in-RAM exposure: any process memory disclosure (heap dump, core dump on crash, /proc access, a memory-scraping RCE) yields live plaintext DEKs for up to 60s per active conversation, and at scale many DEKs concurrently. The spec requires eviction on rotation but NOT on membership revocation (e.g. unfriend/block that re-gates the conversation) or on a lawful-access export. It also doesn't require the cache to be cleared on process signals or exclude it from crash dumps. This partially undercuts the 'DB access alone can't decrypt; you need a live KMS call' protection by keeping decrypted keys resident.
   - *Suggested:* Tighten FR-018-ENC-013: require the DEK cache to be evicted on ANY membership/authorization change for the conversation and on conversation deletion, not just rotation; require the process to disable core dumps / exclude key memory from dumps where feasible; make the TTL default lower (e.g. <=10s) or opt-in, and require a security sign-off on the exposure-window vs KMS-cost tradeoff (already an OQ — decide it). Document that the cache is a named residual risk in the threat model (7.8), which currently omits it.
28. **[medium] Section 5 FR-018-56 / Section 8 FR-8.10 — SES notify-all-sysadmins on every trip/flag is an unauthenticated-input-driven mail amplification and PII-spray vector** — Both the flood guard (FR-018-56: email every issystemadmin on every trip) and the monitor (FR-8.10: email the issystemadmin set on every new open flag) send an SES email to the FULL sysadmin set per event, driven by user-controllable activity (sending contact requests; sending messages that match a classifier). An attacker (or a noisy classifier with false positives on high-volume public-adjacent private chatter) can drive high email volume to all admins, and the flag emails carry flag metadata (categories like child_safety, conversation ids, user identity per FR-018-56) — sensitive PII/accusatory data sprayed to every admin inbox and into SES/email logs, retained outside the audited store. This is both a DoS-on-admins and a confidentiality concern for the most sensitive category of data.
   - *Suggested:* Require batching/deduplication/digest for both notification paths (the delta raises this as an OQ for FR-018-56 — decide it MUST), rate-limit outbound admin notifications, and MINIMIZE PII in the email body (link to the in-app review surface which is the durable source of truth per FR-018-56, rather than embedding category/identity in email). For child_safety especially, prefer an in-app-only signal, not an email carrying the accusation.
29. **[low] Section 8 FR-8.5 — routing all private plaintext to a third-party AI provider (Anthropic/Groq/OpenAI-compatible) is a data-processor/sub-processor disclosure and residency issue not addressed** — FR-8.5 sends decrypted private-message plaintext to 'the configured system AI provider' (type anthropic or openai-compatible incl. Groq) for classification. This means 100% of private DM/group/space content is transmitted to an external processor. The disclosure requirement (FR-8.15) covers 'monitoring by a human sysadmin' and 'escrow not E2E' but does NOT explicitly require disclosing that private content is sent to a named third-party AI sub-processor, nor does it address data-residency (Groq/US processing for EU users), the provider's own retention/training use of the submitted content, or a DPA/sub-processor listing. This is a distinct legal obligation from the monitoring disclosure itself.
   - *Suggested:* Add an FR requiring: (1) the third-party AI processor be named as a sub-processor in the Privacy Policy / DPA and disclosed to users; (2) a contractual no-retention / no-training term with the provider for classifier traffic, verified before enabling; (3) a residency analysis for the provider region vs user residencies. Prefer a provider/mode with a zero-retention API for this traffic.
30. **[low] Section 8 FR-8.3 / OQ-1 — fire-and-forget async classification after persist can silently drop classifications on crash, creating monitoring gaps the spec elsewhere treats as unacceptable** — FR-8.3 requires enqueue AFTER durable persist 'so no in-scope message is silently skipped', but OQ-1 admits the async mechanism is undecided and lists 'in-process fire-and-forget' as an option, which loses the classification if the process dies between persist and classify. The route already uses fire-and-forget for the space AI auto-answer (`void maybeAutoAnswerForConversation(...).catch(()=>{})` in the messages route), so the likely implementation path is the lossy one. A silently-dropped classification directly contradicts FR-8.9's 'MUST NOT drop the message from the eligible set' and the stated goal that a silently-failing classifier is a monitoring gap — which matters legally, since the whole justification for the privacy tradeoff is that serious-crime content is actually reviewed.
   - *Suggested:* Decide OQ-1 toward a DURABLE work record (e.g. an eligibility/queue row written in the same transaction as the message, drained by a worker with retry), not in-process fire-and-forget. Add an acceptance criterion: after a process crash between persist and classify, the message is still classified by the sweep (FR-8.6b) — verified, not assumed.
