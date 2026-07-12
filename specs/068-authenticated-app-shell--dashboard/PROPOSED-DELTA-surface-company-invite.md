# PROPOSED DELTA — Surface "Invite a colleague" on the company dashboard

**Spec:** 068 Authenticated App Shell & Dashboard · **Status:** `PROPOSED` (not approved, not built) · **Drafted:** 2026-07-12
**Depends on:** Spec 011 (org-member invite — `orginvitations`, `POST /api/orgs/invitations`, `MembersManager`, `getActiveOrg`).
**Promotion:** on approval + implementation → a new FR (or dashboard-section note) in [`spec.md`](./spec.md) + a `Delta — Implemented` section.

---

## Why

The company/org member invite ("Invite a colleague") already exists (spec 011) but lives **only** at `/members` — it isn't discoverable from the dashboard, so a corporate owner/admin can't tell the product can invite teammates. This surfaces the **existing** capability on the dashboard home; **no new invite logic.**

## Proposed change

On `/app` (dashboard home), a user whose **active org is corporate** and whose **role is owner/admin** sees an **Invite a colleague** entry:

- A compact quick-action/panel that either links to `/members` or inline-embeds the existing invite form (reusing `MembersManager`'s invite call, `POST /api/orgs/invitations`).
- Gated exactly like `/members` (`getActiveOrg(user.id)`, `plantype === "corporate"`, role ∈ {owner, admin}); everyone else sees nothing new.
- Purely additive to the dashboard; no backend change (reuses spec 011 routes).

## Scope

- **In:** one dashboard entry point for the existing org invite; corporate owner/admin only.
- **Out:** any new invite type, community invites (that's the FR-021 / spec-013 console work), non-corporate orgs.

## Open Question

1. **Link vs. embed** — a quick-action **card that routes to `/members`** (minimal, keeps one canonical invite surface) **or** an **inline invite form** on the dashboard (fewer clicks, duplicates the form)? Recommend the card/link for a single source of truth.

---

*Per CLAUDE.md SPEC-FIRST: nothing here is built. This is a small discoverability change over an already-shipped spec 011 capability.*
