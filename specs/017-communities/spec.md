# Spec 017: Communities

**Spec Number**: 017
**Status**: `design`
**Created**: 2026-06-18
**Scope Source**: [`specs/Project-Scope/017-communities.md`](../Project-Scope/017-communities.md) — full requirements (18 FRs, 4 scenarios, 10 success criteria)
**Design**: [`specs/design/communication-model.md`](../design/communication-model.md) (§11 is this spec's seed)
**Depends On**: Spec 001 (Common Chat Engine — message bus + shared `conversationmembers` core + `space` conversation kind + `conversation:{id}` scope), Spec 003 (WebSocket engine — live delivery, presence, typing, replay), Spec 002 (Personal Assistant — AI for translation + RAG-over-history), Spec 011 (Auth — users + the **account profile** incl. preferred language), Spec 009 (Push Notifications)

## Overview

Communities is YappChat's **Groups** context (context 2 of three — Company / Groups / Individuals; see the communication-model design doc). It is the Discord / Facebook-Group half of the product: people gather around a shared interest rather than an employer or a personal relationship. The defining v1 shape is a **multilingual, AI-assisted support community** — the first one being **wxKanban** itself, with spaces for `beta`, `support`, and `general`.

A **community** is a container an owner sets up; inside it are **spaces** (topic rooms) that ride the spec 001 message engine and the spec 003 transport. A person **joins YappChat once** — their profile (name, bio, **preferred language**, avatar) is an **account-level profile owned by spec 011**, set at onboarding. Carrying that one identity, they discover communities and **join or request to join**; per community they pick up only a **role** and a **rich availability** status. Three capabilities make this more than a chat room: **per-viewer opt-in translation**, **community-owned durable history**, and a **community-scoped AI** that answers from history. Because translation and AI-over-history require server-readable plaintext, community spaces are deliberately **not E2E** — a conscious per-context trade.

## Business Problem

Neither incumbent owns *communities of interest*. Slack is employer-bound; WhatsApp is 1:1/small-group personal. Software user-groups, families, and support/news audiences have no home that is **global by default** — i.e. where a mixed-language audience can actually help each other, and where the accumulated history resolves new questions instead of being lost scrollback. YappChat's wedge is a community space that is **multilingual on demand** and **AI-searchable across its whole history**, dogfooded by wxKanban's own beta/support community.

## Actors

- Primary: Community member — joins to give or get help (e.g. a wxKanban beta user).
- Secondary: Owner / moderator — sets up the community + spaces, sets policy, approves joins, moderates, controls retention.
- Secondary: Community AI assistant — the spec 002 PA scoped to a single community; RAG over its history.
- Secondary: Unauthenticated visitor — sees only public-discoverable community landing info.

## Success Metrics

1. **Policy correctness 100%** — effective join policy resolves to the stricter of (community × space); `unlisted` never appears in discovery.
2. **Membership-gated everything** — non-members get zero space data and cannot subscribe `conversation:{id}`; verified server-side.
3. **Translation fidelity & thrift** — opt-in, original + code blocks byte-preserved, each `(message, language)` translated at most once, same-language view = zero calls.
4. **Community-owned retention** — a member cannot purge community content; only owner/mod retention applies.
5. **AI scoping & citation** — retrieval is hard-scoped to the community, answers in the asker's language and cite ≥1 source.

(Full 10-criterion list in the scope document.)

## Scope Boundary

**IN:** communities + spaces (chat/broadcast); roles (owner/mod/member); per-container discoverability × join policy at community **and** space level (space overrides stricter); join-request queue + moderation; member directory + per-community availability; native messaging over 001/003; per-viewer opt-in translation; community-owned durable history + search; community AI (RAG); discovery; presence/typing; notifications; community audit log. New code under `apps/web/src/app/communities/*` + `src/components/communities/*` + `/api/communities/*`, `/api/spaces/*`. New tables: `communities`, `communitymembers`, `spaces`, `communityinvites`, `joinrequests`, `messagetranslations`, `messageembeddings`, `communityauditlog`.

**OUT:** Company context (ctx 1) and Individuals context (ctx 3) — separate specs; bridging to external Discord/Facebook (bridge phase, needs `extensions/`); E2E for community content (deliberately excluded); billing for paid communities (spec 014); video rooms (001 T7); the 001/003 engine internals; a per-community profile (identity is the spec 011 account profile).

## Out of Scope

Threads/reactions/pins/file-sharing; paid communities; bridged communities; E2E community content; defining a profile (reuses spec 011's account profile).

## Open Questions

None blocking — resolved in the 2026-06-18 scope session (see scope doc Clarifications): beachhead, profile location (account-level/011), translation opt-in, community-owned history, two-level access control, own-spec, no-E2E.

## Functional Requirements

> Condensed; authoritative per-FR criteria live in [`specs/Project-Scope/017-communities.md`](../Project-Scope/017-communities.md).

### FR-001 — Create & configure a community
Owners create/configure a community (name, unique slug, description, avatar, discoverability, default join policy); creator becomes `owner`; edits audited.

### FR-002 — Spaces (sub-groups)
Spaces map to spec 001 conversations of kind `space` with a `communityid`; have a `mode` (`chat`/`broadcast`) and own discoverability + join policy defaulting to **inherit**, overridable **stricter**; broadcast restricts posting to owner/mod.

### FR-003 — Roles & permissions
Roles `owner`/`moderator`/`member`; a capability map (`action → role`) backs UI + API; last-owner protection.

### FR-004 — Join flow + policy enforcement
`open`=instant, `approval`=join request, `invite-only`=via invite; effective policy = stricter of community/space; `unlisted` never in discovery.

### FR-005 — Moderation surface
Approve/deny join requests; remove/ban; manage roles — API-enforced; all governance written to the community audit log.

### FR-006 — Account profile (set at YappChat join, reused)
Identity comes from the **spec 011 account profile** (name, bio, **preferred language**, avatar), set at onboarding. 017 does not define a profile; it reads the account profile and adds only per-community **role** + **availability**.

### FR-007 — Availability ("available to help")
Members set a rich availability status + optional note (office-hours) + topics; visible in the directory and surfaced when the AI suggests pinging a human. Live online/offline comes from spec 003; the help flag is member-set and persistent.

### FR-008 — Community discovery
Discovery lists/searches `public` communities (name, description, member count, languages present); `unlisted` never listed; unauthenticated visitors see only public landing info.

### FR-009 — Member directory
Searchable member list (name, language, availability, role); visible to community members only.

### FR-010 — Native messaging in spaces (store original)
Messaging rides 001/003 on `conversation:{id}` with **membership-checked subscribe**; each message stores **original content + source language** (default = author's account language); rendered with author identity from the account profile.

### FR-011 — Broadcast spaces
Only owner/mod may post in a `broadcast` space; members are read fan-out; translation + history apply.

### FR-012 — Per-viewer opt-in translation
**Opt-in** per viewer (off by default); **original always stored/viewable**, code blocks never translated; **lazy + cached** per `(message × target-language)`; engine = Claude Haiku; same-language view = no call.

### FR-013 — Durable, community-owned history
Retained per the **community's** setting (default forever), owner/mod governed; members cannot purge community content; paginated; `lastreadat` drives unread.

### FR-014 — History search (text)
Keyword search across a space/community's messages, scoped to the member's communities.

### FR-015 — AI assistant over history (RAG)
Per-message embeddings in **pgvector**; in-space `/ask` runs retrieval over **only this community's** history via the spec 002 PA, answers **in the asker's language**, **cites** sources; explicit no-result path.

### FR-016 — Notifications
New-message (per mute), @mention, and join-approval notifications via spec 009; owners/mods notified of new join requests.

### FR-017 — Presence & typing
Online/offline + "X is typing…" in spaces, wired from spec 003.

### FR-018 — Community moderation/audit log
Append-only `communityauditlog` (joins/leaves, approvals/denials, removals/bans, role/policy/retention changes), attributed; visible to owner/mod.

### FR-019 — Per-space support AI (source-grounded auto-answer)
At **space creation** (and editable later by owner/mod) the creator may toggle **"Use AI in this space."** When on, the space becomes an **AI-assisted support space**: an opt-in, **per-space** assistant — *distinct from* the community-wide history AI of FR-015 — grounded in **owner-provided knowledge sources**.

- **Knowledge sources** (any combination): (a) a **website URL** the owner provides, **crawled once** into a snapshot at enable time and **re-crawled only on an explicit owner "refresh"** (no scheduled/live crawl in v1); (b) **uploaded documents** (PDF / Markdown / DOCX / TXT); (c) the **space's own message history**. Source text is chunked + embedded into **pgvector** (reusing the FR-015 embedding path) under a per-space namespace.
- **Behavior — auto-answer support bot**: when a member posts a message the assistant judges to be a **question/support request**, it **replies automatically in the space** with an answer **synthesized only from the configured sources**, **in the asker's language**, and **citing ≥1 source** (doc title / page anchor / source URL). Explicit **no-answer path** ("I couldn't find this in the sources") that **surfaces an available human** (ties to FR-007 availability) rather than hallucinating.
- **Model**: latest Claude (default `claude-opus-4-8`) via the spec 002 PA / `aiproviders`.
- **Guardrails**: retrieval is **hard-scoped to this space's sources** (never other spaces/communities); bot answers are attributed to a system "Assistant" author and labeled AI; owner/mod can disable the toggle, edit sources, and trigger re-crawl/re-index; crawl respects `robots.txt` and a page-count cap.

**Open-question resolutions (2026-06-27):** new per-space AI (FR-015 unchanged); sources = website URL + uploaded docs + space history; behavior = auto-answer; website freshness = one-time snapshot + manual refresh.

### FR-020 — Per-space invite links
An owner/moderator (capability `invite:create`) may mint a **single-use, expiring, shareable link** scoped to **one specific space**. Unlike the community invite of FR-004, redeeming a space link admits the recipient **directly into that space's conversation — overriding the space's own stricter policy** (invite-only / `adminonly` / `corponly`) that they would not reach via a normal community join; the invite itself is the grant. Redemption also joins the recipient to the parent **community** (silently, as `member`) if they are not already one — acceptable because minting requires the same moderator-level trust as a community invite.

- **Link shape:** a token-first URL `{SITE_URL}/communities/join?token=<token>` — a real clickable link (FR-004's community invite previously exposed only a raw token with no landing page; that gap is closed here for both community and space invites).
- **Landing page:** resolves the token to a preview ("You're invited to **{space}** in **{community}**") **without consuming it**, then a **Join** button redeems it and routes the user into the space. Unauthenticated visitors are bounced to `/signin?return=…` and back.
- **Single-use:** each link works once, then is spent (mirrors FR-004). A fresh link is minted per person.
- **Validation:** token must be unused, unexpired, and its space must belong to the community; invalid / expired / used → friendly error, no join.
- **Privacy:** the resolve/preview endpoint is auth-gated and token-keyed (24 random bytes, unguessable, not enumerable); it reveals community + space names only to a signed-in holder of the link.
- **Audit:** `space_invite_created` and `space_invite_redeemed` written to `communityauditlog`.

### FR-021 — Reusable (multi-use) invite links
An owner/moderator (capability `invite:create`) may mint a **reusable** invite link — community-wide (FR-004) or space-scoped (FR-020) — that admits **multiple** recipients until it reaches a **use cap** or **expiry**, whichever comes first. Same token-first URL shape, landing page, and policy-override semantics as FR-020; the only change is that one token can be redeemed more than once. A single-use link is just `maxuses = 1` — the FR-020 behavior becomes a special case of this FR, not a separate code path.

- **Use cap:** the minter chooses `maxuses` (**default 100**), or **unlimited** (`NULL`). Redemption is valid while `usecount < maxuses` (or unlimited) **and** unexpired **and** not revoked.
- **Expiry:** **required** (`expiresat`), max window **90 days**. No perpetual links; revoke is the manual kill switch.
- **Strict-space restriction:** reusable links are allowed **only for `open` / `approval` spaces**. `adminonly` and `corponly` spaces stay **single-use only** — the server forces `maxuses = 1` and rejects any larger/unlimited value (`invite_not_reusable`). This bounds the blast radius of the policy-override: a shared link can never mass-admit strangers into an admin or corp-only space.
- **Idempotent for existing members:** if the redeemer is already a member of the target space/community, redemption is a **no-op success** and does **not** consume a use.
- **Revocable:** owner/mod (capability `invite:create`) may revoke a standing link at any time, killing it regardless of remaining uses.
- **Preview:** the resolve/preview endpoint stays non-consuming and may surface remaining uses to the holder.
- **Audit:** one `space_invite_redeemed` / `invite_redeemed` row **per redemption** (attributed to the redeemer); `space_invite_created` on mint; new `space_invite_revoked` on revoke.
- **Redeemer log:** each redemption also writes a `communityinviteredemptions` row (inviteid, userid, redeemedat) for analytics/abuse review; the unique `(inviteid, userid)` also backs the already-redeemed no-op.

## Data Model

**New tables (017):** `communities`, `communitymembers` (role + availability only — *not* a profile), `spaces` (references a 001 conversation), `communityinvites`, `joinrequests`, `messagetranslations` (cache, unique `(messageid,langcode)`), `messageembeddings` (pgvector), `communityauditlog` (append-only).

**FR-020 change:** `communityinvites` gains a **nullable `spaceid`** (FK → `spaces`, `ON DELETE cascade`, indexed): `NULL` = community-wide invite (FR-004, unchanged); set = per-space invite (FR-020). One table, one hashed-token/redemption path. Migration **0021**.

**FR-021 change:** `communityinvites` gains **`maxuses`** (`integer` NULL = unlimited; default `1` = single-use) + **`usecount`** (`integer NOT NULL DEFAULT 0`); `usedat` is repurposed as a "dead" marker (set when the cap is reached or on revoke). New table **`communityinviteredemptions`** (`inviteid` FK → `communityinvites` `ON DELETE cascade`, `userid`, `redeemedat`, unique `(inviteid,userid)`) logs each redemption and backs the already-redeemed no-op. Migration **0025**; existing rows backfilled to `maxuses=1` (single-use unchanged).

**New tables (017 / FR-019 per-space support AI):** `spaceaiconfig` (1:1 with a space — `enabled`, `model`, `autoanswer`, `lastindexedat`); `spaceaisources` (the website URL + uploaded-doc rows for a space — `kind` `website|document|history`, `url`/`storagekey`, `status`, `crawledat`); `spaceaichunks` (pgvector chunk embeddings of source text, namespaced per space, citing back to a `spaceaisources` row + anchor). Reuses the FR-015 embedding/PA path; **pgvector** required.

**Reused:** spec 011 `users` + **account `userprofiles`** (name/bio/**preferred language**/avatar — owned by 011, set at onboarding); spec 001 `conversations`/`messages`/`messagedeliveries` + the shared `conversationmembers` core; spec 002 PA + `aiproviders`; the 003 `conversation:{id}` scope.

Migrations generated only (manual apply); **pgvector** extension required for `messageembeddings`.

## Tasks

See [tasks.md](tasks.md) — 8 tasks (T001–T008), mapping to build slices G1–G5.

## Phase

**Current Phase**: design
**Priority**: high

## Status

- **Date**: 2026-06-18
- **Phase**: design

## Delta — Implemented 2026-06-28 (retro-scoped)

Built ahead of spec; documented here to keep scope and code in sync (see `feedback_spec_first_always` — do not repeat). tsc/eslint-clean; applied via idempotent migrations (pre-live relaxation in effect).

- **Three-tier space access model** — `spaces` gained `adminonly` + `corponly` boolean columns. Effective audiences: **Q&A = open** (any logged-in user with access to the community), **General = corporate-members-only** (`corponly`, = org member), **Administration = owners/moderators only** (`adminonly`). This refines FR-002/FR-004's per-space policy with org-membership-aware gating.
- **Auto Administration space** — `createCommunity` now auto-creates an `Administration` space (adminonly, invite, unlisted); only owners/moderators are synced in.
- **Membership sync** — `lib/communities/membership.ts`: `syncMemberToSpaces` (skips adminonly / corponly-unless-org-member / gated), `syncStaffToSpace` (admin spaces follow role), `syncCorpToSpace` (corp-only spaces follow org membership); `setMemberRole` re-syncs admin spaces.
- **Manage panel** — `SpacesManager` (in `OwnedCommunitiesManager.tsx`) now manages **spaces** (create/update/delete, "use AI in this space", 4-way "Who can enter": inherit/approval/invite/**corp-only**) **and members**, with the `--destructive` theme token fixed (was near-invisible in dark mode).
- **Note:** clicking a person in a community to "Ask to connect" is part of **spec 018** (Contacts & DMs), not this spec.

## Delta — Implemented 2026-07-01 (Per-space invite links, FR-020)

Spec-first (this FR was written before the code). Adds shareable, single-use links that admit a clicker directly into one specific space, overriding that space's strict policy.

- **Schema** — `communityinvites.spaceid` (nullable FK → `spaces`, `ON DELETE cascade`, indexed); migration **`0021_space_invites.sql`**. `NULL` = community invite (FR-004), set = space invite.
- **Backend** (`lib/communities/membership.ts`) — `createSpaceInvite(communityid, spaceid, createdby, ttlHours=72)` (verifies space ∈ community); `resolveInvite(token)` (token-first preview — community + space name + validity, no consume); `redeemInvite(token, userid)` (join community if needed → `addConversationMember` overriding the space's strict policy → mark used → audit). Single-use.
- **Routes** — `POST /api/communities/:id/spaces/:spaceid/invites` (capability `invite:create`), `GET /api/invites/:token` (auth-gated resolve), `POST /api/invites/redeem` (auth-gated consume).
- **UI** — landing page `/communities/join?token=…` (unauth → `/signin?return=…`, already allow-listed); per-space **"Generate invite link"** control (full clickable URL + Copy) in `SpacesManager` (`components/dashboard/OwnedCommunitiesManager.tsx`).
- **Audit** — `space_invite_created` / `space_invite_redeemed` in `communityauditlog`.

## Delta — Implemented 2026-07-11 (Reusable multi-use invite links, FR-021)

Spec-first (FR-021 + the [proposed delta](./PROPOSED-DELTA-multiuse-invites.md) written and approved before code). Turns the single-use link into a reusable one, capped and revocable, with a strict-space safety restriction.

- **Schema** — `communityinvites` += `maxuses` (`integer` NULL = unlimited) + `usecount` (`integer NOT NULL DEFAULT 0`); `usedat` now also means "dead" (cap reached / revoked). New table `communityinviteredemptions` (`inviteid`/`userid`/`redeemedat`, unique `(inviteid,userid)`). Migration **`0025_multiuse_invites.sql`**; existing rows backfilled to `maxuses=1`.
- **Backend** (`lib/communities/membership.ts`) — `createInvite`/`createSpaceInvite` take an optional `maxuses` (default 1; **strict-space guard** forces 1 for `adminonly`/`corponly`, else `invite_not_reusable`); `redeemInvite` now does a **bounded atomic increment** (`WHERE usedat IS NULL AND (maxuses IS NULL OR usecount < maxuses)`), logs a `communityinviteredemptions` row, and **no-ops (no use burned) if already a member**; `resolveInvite` reports `remaining`; new `revokeInvite`; new `listInvites`.
- **Routes** — community + space `POST …/invites` accept `{ maxuses }`; `GET …/invites` lists active links; `POST /api/communities/:id/invites/:inviteid/revoke` revokes (community-scoped for authz). All capability `invite:create`.
- **UI** — the `SpacesManager` invite control gains a **uses** selector (Single-use / 25 / 100 / Unlimited — reusable options hidden for admin/corp spaces), shows remaining uses on active links, and a **Revoke** button. **(2026-07-12)** the same control is also mounted at the **community level** in the Manage panel — a "Generate community link" (whole-community invite, no space) sitting with the community's entry settings, so a community-wide reusable link is available without editing a space.
