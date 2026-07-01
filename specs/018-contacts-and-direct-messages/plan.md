# Spec 018 — Implementation Plan / Map

**Status**: implemented (retro-scoped). This records what was actually built so the spec and code agree.

## Architecture

A DM is just a spec 001 `conversation` (`person` for 1:1, `group` for ad-hoc multi) on a shared `yappchat-internal` / `direct` channel, with the participants as `conversationmembers`. The new surface is the **contacts graph** that gates and seeds those conversations. Live delivery is unchanged spec 003 (`conversation:{id}` scope, token-handshake auth from spec 003 delta).

## Data model (migration 0018, applied)

- **`contacts`** — `id` (uuid v7), `requesterid`→users, `addresseeid`→users, `status` enum `contactstatus`(pending|accepted|declined), `conversationid` (the 1:1 thread), `createdat`, `respondedat`. Unique index on (requesterid, addresseeid); indexes on each side.
- **`contactinvites`** — `id`, `inviterid`→users, `email`, `tokenhash` (unique), `expiresat`, `consumedat`, `createdat`.
- Registered in `drizzle.config.ts`; schema in `src/lib/db/contacts-schema.ts`.

## Files

**New**
- `src/lib/db/contacts-schema.ts` — tables above.
- `src/lib/contacts/service.ts` — `searchUsers`, `requestContact`, `respondToContact`, `listContacts`, `listIncomingRequests`, `inviteContactByEmail`, `acceptContactInvite`, `createGroupChat`, `listMyChats`, `areContacts` (+ private `getDirectChannel`, `getOrCreateDirectConversation`, `contactBetween`).
- `src/app/api/contacts/route.ts` (GET list+requests), `search/route.ts`, `request/route.ts` (POST {addresseeid}|{email}), `[id]/respond/route.ts` (POST {accept}).
- `src/app/api/chats/route.ts` (GET list, POST group).
- `src/components/chats/ChatsApp.tsx` — Chats UI + `NewChatModal`.
- `src/app/(authenticated)/chats/page.tsx` — `/chats` page.
- `src/app/invite/contact/[token]/page.tsx` — email-invite landing.

**Modified**
- `src/lib/engine/service.ts` — DM send-gate in `sendMessage` (queries `contacts` directly to avoid a circular import).
- `src/components/communities/CommunitiesApp.tsx` — author name → `askToConnect` (POST /api/contacts/request).
- `src/components/shell/IconRail.tsx` — Chats nav icon (MessageCircle).
- `src/lib/auth/return-url.ts` — added `chats` to USER_PATHS (`invite` already present, covers `/invite/contact/...`).

## Verification done
tsc `--noEmit` clean; eslint clean; `/chats` → 307 (auth) ; `/api/contacts` → 401 unauth; migration applied (`contacts`, `contactinvites` exist).

## Not done / follow-ups
- Live end-to-end test by the user (two accounts: connect → accept → DM → group).
- Decide email-invite binding (bearer vs email-bound) — Open Question 1.
- Optional: outgoing-pending request list; block/report; DM E2E (spec 010).
