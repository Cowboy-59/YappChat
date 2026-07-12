# PROPOSED DELTA — Global Invite Console (system admin)

**Spec:** 013 Admin Console · **Status:** `PROPOSED` (not approved, not built) · **Drafted:** 2026-07-12
**Depends on:** Spec 011 (`orginvitations`, org-invite create/revoke/resend), Spec 017 (`communityinvites` incl. FR-021 reusable links, `createInvite`/`createSpaceInvite`/`listInvites`/`revokeInvite`), Spec 013 FR-001/002/018 (the `requireAdmin` gate + audit).
**Promotion:** on approval **and** implementation → **FR-019** in [`spec.md`](./spec.md) + a `Delta — Implemented` section.

---

## Why

YappChat has **two** separate invite systems and no single place to see or manage them: company/org member invites (spec 011 `orginvitations`) live only at `/members`, and community/space invite links (spec 017 `communityinvites`) are buried in each community's Manage panel. A system admin has **no** cross-deployment view of who has been invited where, and no one-stop create/revoke. This adds that surface to the Admin Console — consistent with 013's charter: **consume/proxy existing 011 + 017 services, don't reimplement them.**

## Proposed FR-019 — Global invite console

A system administrator (`issystemadmin`) gets a cross-org invite console at `/admin` that aggregates **both** invite systems into one management surface. Support (`issupport`) sees it **read-only**; org owner/admin do **not** (their invite tools stay at `/members` and the community Manage panel).

- **List** — a unified, filterable table of **active** invites across the whole deployment. Columns: **type** (`company` | `community` | `space`), **target** (company name, or community + space name), **created by**, **uses** (email-bound single-use for company; `usecount / maxuses / remaining` for community per FR-021), **expires**, **status**. Filter by type; search by target name. Tier-scoped per FR-002 (support read-only).
- **Create** — mint an invite into **any** company (proxies 011 org-invite create) or **any** community/space (proxies 017 `createInvite`/`createSpaceInvite`, incl. FR-021 `maxuses`). Type-discriminated form.
- **Revoke** — kill any active invite: proxies 011 org-invite revoke + 017 `revokeInvite`. Support cannot revoke.
- **Gate + audit** — `requireAdmin({ flag: "issystemadmin" })` on every mutation; each create/revoke writes an attributed `authauditlog` row (the underlying 011/017 audit rows still fire too). Denied access recorded per FR-018.

## Routes (new, under `/api/admin/*` per 013 Scope Boundary)

- `GET  /api/admin/invites` — aggregated list (`orginvitations` ∪ `communityinvites`), joined to `orgs` / `communities` / `spaces` for names. Query: `?type=company|community|space`, `?q=<target>`.
- `POST /api/admin/invites` — create; body discriminated by `type` (`company` → `{ orgid, email, role }`; `community`/`space` → `{ communityid, spaceid?, maxuses?, ttlHours? }`).
- `POST /api/admin/invites/:source/:id/revoke` — `source ∈ {org, community}`; proxies the matching revoke.

## Data model

**No new tables.** Reads/acts over `orginvitations`, `communityinvites` (+ `orgs`, `communities`, `spaces`, `users` for names). Consistent with 013's "net-new domain is small."

## UI

New `InviteConsole` panel in `apps/web/src/components/admin/*`, mounted on `/admin` (system-admin tier). List + type filter + create form + per-row Revoke. Reuses the FR-021 reusable-link controls for community/space creation.

## Open Questions (need decisions before build)

1. **Create scope** — should the console's Create support **both** company and community invites from day one, or ship **list + revoke** first (read/manage) and add cross-org Create in a second pass? (Create-into-any-company is the higher-trust, higher-effort part.)
2. **Active vs. history** — list only **live** invites (default), or also show spent/revoked/expired with a status filter (needs the org-invite side to expose consumed/revoked state)?
3. **Redeemer detail** — surface *who redeemed* a community link (we now log `communityinviteredemptions`) as a drill-down, or keep the table to counts only in v1?

---

*Per CLAUDE.md SPEC-FIRST: nothing here is built. Note 013 itself is still largely unbuilt (design-phase placeholder `/admin`); this FR can ship as a self-contained slice on top of the existing `isSystemStaff`/`requireAdmin` gate without the rest of 013.*
