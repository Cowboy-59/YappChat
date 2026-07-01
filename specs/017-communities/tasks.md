# Task Breakdown: Communities

**Feature**: Communities
**Spec**: 017
**Date Generated**: 2026-06-18
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

---

## Tasks

| # | Task | Priority | Status |
|---|------|----------|--------|
| 1 | Communities + spaces foundation + membership guard | high | DONE + LIVE-VERIFIED — tables communities/communitymembers/spaces (migration `0008` APPLIED), `requireMembership` + capability map + effective-policy helpers, create/get/update community + create/list spaces (backing yappchat-internal channel + `space` conversation + creator conversationmember), routes `/api/communities[/:id[/spaces]]`. tsc/eslint/90 tests green. Live e2e `scripts/communities-g1-e2e.mjs` 12/12 (create community+spaces, capability + 404 membership gates, stricter-override rule, gated live messaging in a space conversation). Fixed slug-uniqueness bug (uuidv7 prefix collision → incrementing-suffix loop). |
| 2 | Join flow + invites + approval queue + moderation + audit | high | DONE + LIVE-VERIFIED — join (open/approval/invite) + single-use expiring invites + approval queue + approve/deny + role-set + remove (revokes space access) + append-only `communityauditlog`; joining syncs user into all space conversations (T009); last-owner protection. Tables joinrequests/communityinvites/communityauditlog (migration `0009` APPLIED). Notifications (FR-016) deferred (spec 009 not built). tsc/eslint/94 tests green. Live e2e `scripts/communities-t002-e2e.mjs` 13/13. Fixed invite-validation bug (2nd query selected only id but read usedat/expiresat). |
| 3 | Discovery + member directory + profile surfacing + availability | high | todo |
| 4 | Native messaging in spaces + broadcast + store original | high | todo |
| 5 | Per-viewer opt-in translation (lazy, cached, Claude) | high | todo |
| 6 | Presence + typing + live availability in spaces | medium | todo |
| 7 | Durable community-owned history + pagination + search | high | todo |
| 8 | AI over history — pgvector embeddings + community RAG /ask | medium | todo |
| 9 | Per-space invite links (FR-020) | high | todo |

## Task Details

### T001 — Communities + spaces foundation + membership guard

FR-001/002/003. Add tables communities (slug unique, name, description, avatarurl, ownerid FK users, discoverability public|unlisted, joinpolicy open|approval|invite, retentionpolicy forever|days, retentiondays, timestamps), communitymembers (communityid FK, userid FK, role owner|moderator|member, availabilitystatus, availabilitynote, joinedat; unique (communityid,userid)), and spaces (communityid FK, conversationid FK -> spec 001 conversations kind 'space', name, topic, mode chat|broadcast, discoverability nullable=inherit, joinpolicy nullable=inherit) via Drizzle migration (generate SQL only — manual apply). Build the single shared requireMembership(communityid,{minRole?}) guard + a capability map (action->role) both UI and API read. Owner create/configure community + spaces; effective space policy = stricter of community and space; last-owner protection (never zero owners). DEPENDS ON spec 001 shared core (conversationmembers, 'space' kind rename, conversation:{id} scope) — coordinate that extension.

### T002 — Join flow + invites + approval queue + moderation + audit

FR-004/005/018 (+FR-016 join notifs). Implement join honoring effective policy: open=instant, approval=creates joinrequests (pending), invite=via communityinvites (hashed token, expiry). Moderation surface: approve/deny queue (attributed+audited), remove/ban member, promote/demote role — enforced at API not UI-only. Append-only communityauditlog (joins/leaves, approvals/denials, removals/bans, role changes, policy+retention changes), visible to owner/mod. Notify owners/mods of new join requests + the requester on decision (spec 009). Tables: communityinvites, joinrequests, communityauditlog.

### T003 — Discovery + member directory + profile surfacing + availability

FR-006/007/008/009. Community discovery surface lists/searches public communities (name, description, member count, languages present); unlisted never listed; unauthenticated visitors see only public landing info (no members/messages). Member directory (members of the community only): name, preferred language, availability, role — name/language/avatar read from the spec 011 ACCOUNT profile (017 does not own a profile). Per-community availability: rich 'available to help' status + optional note (office-hours) + topics, member-set, persists across sessions; surfaced in directory and when the AI suggests pinging a human.

### T004 — Native messaging in spaces + broadcast + store original

FR-010/011 (+FR-016 mentions/new-message notifs). Send/receive ride spec 001 engine + spec 003 conversation:{id} scope; subscribe authorized by membership (closes the open-subscribe hole). Each message stores original content + source language (defaults to author's account-profile language). Render with author identity resolved from the account profile. Broadcast spaces: only owner/moderator may post, members are read fan-out. @mention + new-message notifications via spec 009 (respect per-space mute).

### T005 — Per-viewer opt-in translation (lazy, cached, Claude)

FR-012. Translation is opt-in per viewer (off by default); a toggle translates the current view into the viewer's account preferred language. Original is always stored and viewable ('view original'); content inside code blocks is never translated. Lazy: translate per (message x target-language) only when a viewer of that language opts in; cache in messagetranslations (unique (messageid,langcode)); identical requests served from cache; same-language view performs zero translation calls. Engine = Claude Haiku (current model). Route POST /api/messages/:mid/translate.

### T006 — Presence + typing + live availability in spaces

FR-017. Wire spec 003 hooks (usePresence/useTypingIndicator) into the space view: online/offline indicators on the member list, 'X is typing...' in a space, sendTyping on keystroke. Reflect live presence alongside the member-set availability-to-help flag (FR-007) so the directory shows both real-time online state and stated help-availability.

### T007 — Durable community-owned history + pagination + search

FR-013/014. Space history retained per the COMMUNITY's retention setting (default forever), governed by owner/mod; an individual member cannot purge community-owned messages (contrast personal-DM retention). Paginate history (cursor on createdat); per-member lastreadat (on conversationmembers) drives unread counts. Keyword search across a space/community's messages (searches originals; optionally viewer's cached translations), scoped to communities the member belongs to.

### T008 — AI over history — pgvector embeddings + community RAG /ask

FR-015. Enable pgvector; add messageembeddings (messageid PK FK, embedding vector, model, createdat) generated async off the send path (backfill via queue). In-space /ask (or community assistant) runs semantic retrieval over ONLY this community's history (hard-scoped by communityid) and answers via the spec 002 PA in the asker's preferred language, citing >=1 source message; no-result path is explicit and may list members currently flagged 'available to help' (language match preferred). Route POST /api/communities/:id/ask. Component CommunityAssistant (answer + cited sources).

### T009 — Per-space invite links (FR-020)

FR-020. Add nullable `communityinvites.spaceid` (FK -> spaces, ON DELETE cascade, indexed; migration 0021). Backend in `lib/communities/membership.ts`: `createSpaceInvite(communityid, spaceid, createdby, ttlHours=72)` (verify space belongs to community, single-use sha-256-hashed token, return plaintext once, audit `space_invite_created`); `resolveInvite(token)` (token-first preview: community + space name + validity, NO consume, returns null for unknown token); `redeemInvite(token, userid)` (validate unused/unexpired -> join community via `addMember` if not a member -> `addConversationMember` to the invited space's conversation UNCONDITIONALLY, overriding adminonly/corponly/stricter policy — the invite IS the grant -> mark used via guarded `WHERE usedat IS NULL` update -> audit `space_invite_redeemed`). Routes: `POST /api/communities/:id/spaces/:spaceid/invites` (capability `invite:create`), `GET /api/invites/:token` (auth-gated resolve), `POST /api/invites/redeem` (auth-gated consume). Landing page `apps/web/src/app/communities/join/page.tsx` reading `?token=` -> preview -> Join -> route into `/communities?c=…&space=…`; unauthenticated bounces through `/signin?return=…` (already allow-listed in `lib/auth/return-url.ts`). Per-space "Generate invite link" control (builds full origin URL + Copy) in `SpacesManager` (`components/dashboard/OwnedCommunitiesManager.tsx`). Single-use, expiring. Unit tests for resolve/redeem edge cases (expired/used/unknown, already-member, strict-space override inserts a conversationmembers row).
