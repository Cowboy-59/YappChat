# YappChat integration change — agent (Claude) posts as itself

**Audience:** the wxKanban kit / headless bridge that posts Claude status + output into a YappChat room.
**Change:** switch from *"mint a user session from an email and post as the room owner"* to *"authenticate with a per-room agent token and post as **Claude**."*
**Status:** live on `https://www.yappchatt.com` (spec 091 slice #1). No wxKanban schema change; this is a bridge/config change only.

---

## TL;DR

- Stop minting a `yc_session` from `WXKANBAN_CHAT_EMAIL`. **Delete that path.**
- Get a **per-room agent token** (`yca_…`) once, from the YappChat web app → open the project room → **"Connect Claude"** bar → Copy.
- Post messages with `Authorization: Bearer <yca_token>`. Messages are now authored by **"Claude"** (not the owner) and render on the left automatically.
- The `🤖` prefix in the content is **no longer required** (kept working for backward-compat).

---

## Env vars

```dotenv
# KEEP
WXKANBAN_YAPPCHAT_BASE_URL=https://www.yappchatt.com
WXKANBAN_REMOTE_ROOM_ID=<conversationId of the project room>

# ADD (replaces the email/session identity)
WXKANBAN_YAPPCHAT_TOKEN=yca_xxxxxxxxxxxxxxxxxxxxxxxx

# DROP
# WXKANBAN_CHAT_EMAIL          -> the token is the identity now (posts as "Claude", not the owner)
# WXKANBAN_CHAT_DISPLAY_NAME   -> author name is "Claude", set server-side (not overridable)
# WXKANBAN_WS_URL              -> one-way REST posting; YappChat is not the control channel
# WXKANBAN_CONSUMER_SECRET     -> the broker/consumer-session seam is no longer used for posting

# KEEP ONLY IF the bridge calls the wxKanban app itself (not needed to post to YappChat)
# WXKANBAN_APP_BASE_URL=https://wxkanban.wxperts.com
```

| Var | Verdict |
| --- | --- |
| `WXKANBAN_YAPPCHAT_BASE_URL` | keep |
| `WXKANBAN_REMOTE_ROOM_ID` | keep |
| `WXKANBAN_YAPPCHAT_TOKEN` | **add** (`yca_…`) |
| `WXKANBAN_CHAT_EMAIL` | drop |
| `WXKANBAN_CHAT_DISPLAY_NAME` | drop |
| `WXKANBAN_WS_URL` | drop |
| `WXKANBAN_CONSUMER_SECRET` | drop (for this) |
| `WXKANBAN_APP_BASE_URL` | keep only if used for wxKanban-side calls |

---

## Getting the token (one-time, per room)

Human step, done once per project room:

1. Sign in to `https://www.yappchatt.com` as the room owner.
2. Open the project room (the solo/`projects`-grouping room).
3. In the **"Connect Claude"** bar at the top of the conversation, click **Connect Claude**.
4. **Copy** the `yca_…` token shown (shown once) into `WXKANBAN_YAPPCHAT_TOKEN`.

The token is **per-room and revocable**. It can only post to the room it was minted for.

(Programmatic equivalent, if the bridge ever needs to self-provision — requires the owner's session cookie, not the agent token: `POST /api/chats/{roomId}/agent` → `{ "ok": true, "token": "yca_…" }`.)

---

## Posting a message (the only call the bridge needs)

```
POST {WXKANBAN_YAPPCHAT_BASE_URL}/api/engine/conversations/{WXKANBAN_REMOTE_ROOM_ID}/messages
Authorization: Bearer {WXKANBAN_YAPPCHAT_TOKEN}
Content-Type: application/json

{ "content": "on project wxKanban is connected" }
```

Notes:
- **Path:** the room id is `WXKANBAN_REMOTE_ROOM_ID` (a `conversationId`).
- **Auth:** the literal header is `Authorization: Bearer yca_…`.
- **Body:** `{ "content": string }`. Optional `"mediaurl": string[]` (pre-uploaded S3 keys) — not needed for status.
- **No `🤖` prefix needed.** The message is authored by the Claude agent, so YappChat renders it on the **left** as **"🤖 Claude"** on its own. (A leading `🤖 Claude` in the content is stripped for display if present — harmless.)

### curl

```bash
curl -sS -X POST \
  "$WXKANBAN_YAPPCHAT_BASE_URL/api/engine/conversations/$WXKANBAN_REMOTE_ROOM_ID/messages" \
  -H "Authorization: Bearer $WXKANBAN_YAPPCHAT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"on project wxKanban is connected"}'
```

### Node (fetch)

```js
await fetch(
  `${process.env.WXKANBAN_YAPPCHAT_BASE_URL}/api/engine/conversations/${process.env.WXKANBAN_REMOTE_ROOM_ID}/messages`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WXKANBAN_YAPPCHAT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content: "on project wxKanban is connected" }),
  },
);
```

### Success response — `201`

```json
{
  "message": {
    "id": "…",
    "conversationid": "…",
    "authorid": "<claude agent user id>",
    "authorname": "Claude",
    "isagent": true,
    "content": "on project wxKanban is connected",
    "createdat": "2026-07-19T…Z"
  }
}
```

`isagent: true` is how every client (web + mobile) knows to render it as Claude.

### Error responses

| Status | body `error` | Meaning / fix |
| --- | --- | --- |
| `400` | `content_required` | Empty content and no media. Send non-empty `content`. |
| `401` | `Unauthorized` | Missing/blank bearer. Set the header. |
| `403` | `forbidden` | Token valid but not bound to **this** room (wrong `REMOTE_ROOM_ID`, or Claude not a member). Re-mint the token for the correct room. |
| `404` | `conversation_not_found` | Bad room id. |

---

## Behavioural changes for the kit to be aware of

- **Author is "Claude", not the owner.** Prior messages posted as the owner still exist and still render (legacy `🤖`-string heuristic); new token-posted messages are authored by the agent.
- **One agent membership per room.** Binding adds a `kind='agent'` "Claude" user as a room member. This does **not** affect the room's "solo/project" status (agent members are excluded from that count) and never appears in the owner's contacts/DM lists.
- **Prose-only translation.** YappChat auto-translates Claude's **prose** status lines into members' languages; **code/command output/diffs are left untranslated** (detected by a code heuristic). No action needed from the bridge — send content as-is.
- **Posting only.** The agent token is accepted on the **POST messages** endpoint only. Reading history (`GET …/messages`) still requires a user session — the bridge doesn't need it for a one-way status feed. YappChat is **not** the control channel.
- **Token lifecycle.** Per-room, hashed server-side, shown once, revocable (re-mint via "Connect Claude" to rotate). If a token leaks, revoke by minting a new one / revoking the old via the agent-tokens admin path.

---

## Migration checklist (bridge)

- [ ] Remove the email→`yc_session` broker call and the `WXKANBAN_CHAT_EMAIL` / `WXKANBAN_CONSUMER_SECRET` usage from the post path.
- [ ] Add `WXKANBAN_YAPPCHAT_TOKEN` and read it into the POST `Authorization: Bearer` header.
- [ ] Drop the `🤖 Claude` content prefix (optional — leave it and it's stripped).
- [ ] Drop `WXKANBAN_CHAT_DISPLAY_NAME` and `WXKANBAN_WS_URL` from the post path.
- [ ] Verify a test post returns `201` with `"isagent": true` and appears on the left as **"🤖 Claude"** in the YappChat room (web + mobile).
