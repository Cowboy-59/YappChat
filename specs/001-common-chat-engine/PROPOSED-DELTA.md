# Proposed Delta — Spec 001 Common Chat Engine

**Change**: Add user-initiated message deletion (soft-delete / "unsend for everyone").
**Date**: 2026-07-02
**Status**: approved (2026-07-02) → implemented (migration `0022_message_delete.sql` applied)
**Motivation**: Removing a sent message is table-stakes messenger behavior. The engine currently only purges messages via the automated retention job (FR-012); there is no way for a person to remove a message they (or, as an admin, someone else) sent. This delta adds that capability to the engine so every chat context (Individuals / Groups / Company) inherits it.

---

## FR-015 — User-initiated message deletion (soft-delete, for everyone)

The system MUST let an authorized user delete an individual chat message. Deletion is a **soft delete**: the `messages` row is retained but its content is cleared and it is marked as a tombstone that renders to all participants as *"This message was deleted."* Deletion applies **for everyone** in the conversation (a true unsend), not just the actor's own view.

### Permission model
- The **author** of a message MAY delete their own message.
- A **group / company admin** (a conversation member whose org/conversation role is admin or owner) MAY delete **any** message in that conversation (moderation).
- All other users MAY NOT delete. Authorization is enforced **server-side**; the client only offers the action when the caller is permitted.

### Behavior
1. On delete, the engine sets on the `messages` row: `deletedat = now()`, `deletedby = <actor userid>`, and clears the payload — `content = NULL`, `encryptedpayload = NULL`, `mediaurl = '{}'`. The row itself is NOT removed, so message ordering, pagination, and reply/threading references stay intact.
2. The engine writes one immutable `messageauditlog` row (existing table, FR-012) recording `messageid`, `actorid` (`deletedby`), `action = 'user-delete'`, and timestamp. Retained 90 days, not subject to user retention policy.
3. The engine broadcasts a `message.deleted` event (messageid + conversationid) over the spec 003 WebSocket engine to all conversation members, so open chats update in real time without a reload.
4. A tombstoned message is still subject to the normal retention purge (FR-012); soft-delete does not exempt it.
5. E2E messages (`encryptiontype` `e2e`/`agent-e2e`) delete the same way — the server clears `encryptedpayload` and marks the tombstone without ever needing plaintext.

### Data model change — `messages`
| Column | Type | Notes |
|--------|------|-------|
| `deletedat` | `timestamptz NULL` | NULL = not deleted; set on soft-delete. |
| `deletedby` | `uuid NULL → users.id` | Who deleted it (author or admin). NULL until deleted. |

Migration generated via `npm run db:generate`; validated with `wxkanban-agent dbpush --dry-run`.

### API
- `DELETE /api/chats/messages/:id` — soft-deletes the message. Authz: caller is the author OR an admin/owner member of the message's conversation; otherwise `403`. Returns the tombstoned message shape (`{ id, deletedat, deletedby }`). Idempotent: deleting an already-deleted message is a no-op `200`.

### UI (surfaced first in the Individuals chat; pattern reused by Groups/Company)
- **Right-click** a message bubble (desktop) / **long-press** (mobile) opens a context menu with **Delete message**, shown only when the caller is permitted.
- A confirmation is required: *"Delete this message for everyone? This can't be undone."*
- A tombstoned message renders as muted italic *"This message was deleted."* in place of its content and media.

### Acceptance Criteria
- [ ] An author can delete their own message; it becomes a tombstone for every participant.
- [ ] A conversation admin/owner can delete another member's message; a non-admin non-author gets `403` and no menu entry.
- [ ] Deleting clears `content`/`encryptedpayload`/`mediaurl` and sets `deletedat` + `deletedby`; the row is not physically removed.
- [ ] A `messageauditlog` row is written for every deletion.
- [ ] Other participants with the conversation open see the message become a tombstone in real time via the `message.deleted` WebSocket event.
- [ ] E2E messages delete without the server accessing plaintext.

---

## tasks.md delta

Add task row:

| # | Task | Priority | Status |
|---|------|----------|--------|
| 10 | User-initiated message deletion — soft-delete tombstone, author + admin permissions, `DELETE /api/chats/messages/:id`, `message.deleted` WS broadcast, right-click UI (FR-015) | high | todo |
