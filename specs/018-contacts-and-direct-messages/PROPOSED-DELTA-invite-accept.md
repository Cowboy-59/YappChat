# Proposed Delta — Spec 018 Contacts & Direct Messages

**Change**: Auto-accept a pending email contact-invite when the invitee's email becomes verified, and **notify the inviter** when any invite/request is accepted.
**Date**: 2026-07-02
**Status**: approved (2026-07-02) → implementing
**Motivation**: A real invitee (stefano.sarcletti@gmail.com) signed up and verified his email, but (1) his invite was never consumed — consumption only happened if he clicked the `/invite/contact/{token}` link, which he didn't — so no contact was ever created; and (2) even on the link-click path, `acceptContactInvite` creates the contact **silently**, so the inviter is never told. Result: the inviter (andy@wxperts.com) had no idea he'd joined.

---

## FR-024 — Auto-accept matching invites on email verification

When a user's email becomes **verified**, the system MUST auto-consume any pending (unconsumed, unexpired) email contact-invite whose address matches that verified email, creating the accepted contact + shared DM — without requiring the invitee to click the invite link.

- All the security guards of the existing link-accept already hold at this point: the email is **verified** and matches the invite address **exactly**, and the inviter is not the invitee. So auto-accept is safe.
- Idempotent + atomic: the same consume-first claim (only the row that flips `consumedat` proceeds) prevents double-accept from the link path racing this path.
- Runs at every point email becomes verified: the email-verify link, and verified-on-provision paths (SSO).

## FR-025 — Notify the inviter when an invite/request is accepted

When a contact invite or request is accepted (by auto-accept OR the link-click path), the system MUST notify the inviter:

- **Live** — publish a `contact.accepted` event on the inviter's `user:{id}` WS scope; the inviter's app refreshes its contacts/chats sidebar so the new contact appears immediately.
- **Durable** — post a system line into the shared DM (`"<name> accepted your invitation — you're now connected."`) so it's visible whenever the inviter opens the chat, even if they were offline for the live event.
- (Push notification for offline delivery is deferred to spec 009.)

### Acceptance Criteria
- [ ] An invited user who verifies their email becomes an accepted contact automatically (no link click needed).
- [ ] The inviter's sidebar shows the new contact live via the `contact.accepted` event.
- [ ] A system message records the connection in the shared DM.
- [ ] The link-click accept path also notifies the inviter (no silent accept).
- [ ] Auto-accept and link-accept cannot both create a contact for the same invite (consume-first atomic).

---

## tasks.md delta

| # | Task | Priority | Status |
|---|------|----------|--------|
| (invite-accept) | Auto-accept matching email invites on verification + notify inviter on accept (FR-024/025) | high | todo |
