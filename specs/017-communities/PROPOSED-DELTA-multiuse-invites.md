# PROPOSED DELTA — Multi-use (reusable) community/space invite links

**Spec:** 017 Communities · **Status:** `PROPOSED` (not approved, not built) · **Drafted:** 2026-07-11
**Extends:** FR-020 (Per-space invite links) and FR-004 (community join via invite)
**Promotion:** on approval **and** implementation, this becomes **FR-021** in [`spec.md`](./spec.md) plus a `Delta — Implemented` section (mirroring the FR-020 delta). Until then `spec.md` is unchanged.

---

## Why

Today every invite is **single-use**: `redeemInvite` spends the token on the first redeemer (guarded `UPDATE … SET usedat WHERE usedat IS NULL`), so a link sent to five people admits only the first. There is no way to mint **one link you can post once** — in a team channel, an email to a group, a newsletter — and have many people join a community/space from it. This delta adds that "universal" link.

## Proposed FR-021 — Reusable (multi-use) invite links

An owner/moderator (capability `invite:create`) may mint a **reusable** invite link — community-wide (like FR-004) or space-scoped (like FR-020) — that **admits multiple recipients** until it hits a **use cap** or **expiry**, whichever comes first. It is the same token-first URL shape (`{SITE_URL}/communities/join?token=<token>`), landing page, and policy-override semantics as FR-020; the only change is that a single token can be redeemed more than once.

- **Use cap** — the minter chooses a max number of redemptions (`maxuses`); **default 100**, with **Unlimited** (`NULL`) as an explicit opt-in. A single-use link (FR-020) is just `maxuses = 1` — the existing behavior becomes a special case, not a separate code path.
- **Strict-space gating** — reusable links are permitted **only for `open` / `approval` spaces**. `adminonly` and `corponly` spaces stay **single-use only** (`maxuses` forced to `1`, Unlimited disallowed), limiting the blast radius of the policy-override (see Resolved Decisions).
- **Expiry** — **required** (`expiresat`), max window **90 days**. A reusable link is valid while `usecount < maxuses` (or unlimited) **and** unexpired **and** not revoked. No perpetual/never-expiring links.
- **Idempotent for existing members** — if the redeemer is **already a member** of the target space/community, redemption is a **no-op success** and does **not** consume a use. (Prevents one person burning the cap by reloading the link.)
- **Revocable** — owner/mod can **revoke** a standing link at any time (kills it immediately regardless of remaining uses). New capability path or reuse `invite:create`'s role.
- **Preview shows remaining** — the landing page still resolves without consuming; for a reusable link it may show "spots left" (or just validity) to the holder.
- **Audit** — each successful redemption still writes `space_invite_redeemed` (one row **per redemption**, attributed to the redeemer); minting writes `space_invite_created` (unchanged); revocation writes a new `space_invite_revoked`.
- **Policy-override risk (IN SCOPE, must be decided)** — FR-020's whole point is that an invite **overrides a space's strict policy** (`invite-only` / `adminonly` / `corponly`). A *reusable* link that overrides `adminonly` and is posted publicly is a mass-access hole. See Open Question 4.

## Proposed data-model change

`communityinvites` (current columns: `id, communityid, spaceid?, tokenhash, createdby, expiresat, usedat, createdat`) gains:

| Column | Type | Meaning |
|--------|------|---------|
| `maxuses` | `integer` NULL | Max redemptions. `NULL` = unlimited. `1` = single-use (the FR-020 default). |
| `usecount` | `integer NOT NULL DEFAULT 0` | Redemptions so far. |

- **`usedat` retained** — repurposed as "dead" marker: set to `now()` when the last use is consumed (`usecount` reaches `maxuses`) **or** on revoke. Cheap "is this link still alive" check + no behavioral change for legacy single-use.
- **Backfill (migration):** existing rows → `maxuses = 1`; `usecount = 1 WHERE usedat IS NOT NULL ELSE 0`. Preserves current single-use semantics exactly.

**New table `communityinviteredemptions`** (Resolved Decision 4 — structured redeemer log):

| Column | Type | Meaning |
|---|---|---|
| `id` | `uuid` PK | |
| `inviteid` | `uuid` NOT NULL → `communityinvites.id` (`ON DELETE cascade`) | which link |
| `userid` | `uuid` NOT NULL | who redeemed |
| `redeemedat` | `timestamptz NOT NULL DEFAULT now()` | when |

Unique `(inviteid, userid)` — one redemption row per person per link (also backs the "already redeemed → no-op, don't burn a use" check). Written inside the same transaction as the `usecount` increment.

- **New migration** — next free number (repo is at `0024`; this would be **`0025_multiuse_invites.sql`**), covering both the `communityinvites` columns and the new table; generated only, applied manually per project convention.

## Proposed backend change (`lib/communities/membership.ts`)

- `createInvite` / `createSpaceInvite` gain an optional `maxuses` param (default `1` — **no behavior change** for existing callers).
- `redeemInvite` switches from "spend on first" to a **bounded atomic increment**:
  ```sql
  UPDATE communityinvites
     SET usecount = usecount + 1,
         usedat   = CASE WHEN maxuses IS NOT NULL AND usecount + 1 >= maxuses
                         THEN now() ELSE usedat END
   WHERE id = :id
     AND usedat IS NULL
     AND (maxuses IS NULL OR usecount < maxuses)
  ```
  First-writer-wins concurrency preserved (0 rows affected → `invite_used` 409); unlimited links never cap. Already-a-member short-circuit runs **before** the increment.
- New `revokeInvite(inviteid, actorid)` → set `usedat = now()`, write `space_invite_revoked`.
- `resolveInvite` validity becomes `usedat IS NULL AND expiresat > now() AND (maxuses IS NULL OR usecount < maxuses)`; optionally return `remaining`.

## Proposed routes / UI

- **Routes** — `POST …/invites` body accepts `{ maxuses?: number | null }`; add `POST /api/communities/:id/invites/:inviteid/revoke` (community-scoped for authz); `GET …/invites` to list active links (count + remaining).
- **UI** (`SpacesManager` in `OwnedCommunitiesManager.tsx`) — the "Generate invite link" control gains a **uses** choice (Single-use / N uses / Unlimited) + expiry, shows **remaining uses** on active links, and a **Revoke** button.

## Resolved Decisions (2026-07-11)

1. **Use cap** — **default 100**, with **Unlimited** as an explicit opt-in. No hard ceiling on the opt-in value (subject to Decision 3's strict-space restriction).
2. **Expiry** — **required**, max window **90 days**. No perpetual links; a standing link is killed by expiry or revoke.
3. **Strict-space eligibility** — reusable links are **allowed only for `open` / `approval` spaces**. `adminonly` and `corponly` spaces remain **single-use only** (server forces `maxuses = 1`; Unlimited rejected). Enforced in `createSpaceInvite`, not just the UI.
4. **Redeemer tracking** — **add `communityinviteredemptions`** (see Data Model) for structured analytics/abuse review; the per-redemption `space_invite_redeemed` audit row is also kept.
5. **UI affordance** — fold single-use and reusable into **one** "invite link" control with a **uses** field (Single-use / N / Unlimited) rather than two buttons.

---

*Per CLAUDE.md SPEC-FIRST: nothing here is built. All five open questions are now resolved. On your go-ahead this promotes to FR-021 in `spec.md` and implementation proceeds.*
