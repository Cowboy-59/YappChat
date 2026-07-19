# YappChat integration change — agent (Claude) two-way channel

**Audience:** the wxKanban kit / headless bridge that connects Claude to a YappChat room.
**Change:** replace *"mint a user session from an email and post as the owner"* with a single **per-room agent token** that both **reads the user's commands** and **posts Claude's output** (authored as "Claude").
**Status:** live on `https://www.yappchatt.com` (spec 091). Bridge/config change only.

---

## The loop

```
  YOU (in the YappChat app)  ──▶  type a command in the room  ──▶  bridge READS it (GET)
                                                                     │
                                                                     ▼
  YappChat room  ◀── bridge POSTS Claude's output/status ◀──  Claude runs it on your machine
```

- **You → Claude:** you post a message in the room **as yourself** (via the app). That message is the command that tells Claude what to do — the bridge reads it.
- **Claude → you:** the bridge posts Claude's status/output **as "Claude"** with the agent token.
- **One token does both** read (GET) and write (POST). No user session, no email, no WebSocket.

---

## Env vars

```dotenv
# KEEP (posting + reading)
YAPPCHAT_URL=https://www.yappchatt.com
YAPPCHAT_ROOM=<conversationId of the project room>
YAPPCHAT_TOKEN=yca_xxxxxxxxxxxxxxxxxxxxxxxx    # from "Connect Claude" in that room

# DROP
# YAPPCHAT_CHAT_EMAIL          -> the token is the identity now (reads + posts). No session mint.
# YAPPCHAT_WS_URL              -> commands are read by polling GET; no WebSocket needed.
# WXKANBAN_CONSUMER_SECRET     -> the broker/session path is gone.

# KEEP for the wxKanban side (unrelated to YappChat)
# WXKANBAN_API_TOKEN=…
# DATABASE_URL=…
```

> The token is **per-room**: mint it via **Connect Claude** *while viewing the room whose id is `YAPPCHAT_ROOM`*. A token for a different room returns `403`.

---

## 1) Read the user's commands (GET)

Poll for new messages and act on the human ones (i.e. `isagent === false` and not your own agent id).

```
GET {YAPPCHAT_URL}/api/engine/conversations/{YAPPCHAT_ROOM}/messages
Authorization: Bearer {YAPPCHAT_TOKEN}
```

Response: `{ "messages": NormalizedMessage[], "myrole": string|null }`, oldest→newest (max 200). Each message:

```json
{ "id": "…", "authorid": "…", "authorname": "Andy", "isagent": false,
  "content": "deploy the web app", "createdat": "2026-07-19T…Z", "deletedat": null }
```

Bridge logic:
- Track the last processed message `id` (or `createdat`).
- New **command** = a message with **`isagent: false`** (a human — the user) newer than your cursor. Ignore `isagent: true` (Claude's own posts) and system messages.
- Poll every few seconds (e.g. 3–5s).

## 2) Post Claude's output (POST)

```
POST {YAPPCHAT_URL}/api/engine/conversations/{YAPPCHAT_ROOM}/messages
Authorization: Bearer {YAPPCHAT_TOKEN}
Content-Type: application/json

{ "content": "on project wxKanban is connected" }
```

- Body: `{ "content": string }` (optional `"mediaurl": string[]`).
- **No `🤖` prefix needed** — the token authors the message as **Claude**, so it renders on the left as "🤖 Claude" automatically.
- Success: `201` with `{ "message": { …, "authorname": "Claude", "isagent": true } }`.

### curl (both directions)

```bash
# read commands
curl -sS "$YAPPCHAT_URL/api/engine/conversations/$YAPPCHAT_ROOM/messages" \
  -H "Authorization: Bearer $YAPPCHAT_TOKEN"

# post output
curl -sS -X POST "$YAPPCHAT_URL/api/engine/conversations/$YAPPCHAT_ROOM/messages" \
  -H "Authorization: Bearer $YAPPCHAT_TOKEN" -H "Content-Type: application/json" \
  -d '{"content":"branch is main; deploying now"}'
```

### Errors

| Status | `error` | Fix |
| --- | --- | --- |
| `400` | `content_required` | Empty content on POST. |
| `401` | `Unauthorized` | Missing/blank bearer, or a non-`yca_` token. |
| `403` | `forbidden` | Token not bound to **this** room — re-mint via Connect Claude in the right room. |
| `404` | `conversation_not_found` | Bad `YAPPCHAT_ROOM`. |

---

## Behavioural notes

- **Author is "Claude", not you.** Your posts stay yours (they're the commands); Claude's posts are the agent.
- **Read + write with one token.** GET and POST both accept the `yca_…` bearer (member-scoped).
- **Prose-only translation.** Claude's prose status lines auto-translate into members' languages; code/command output/diffs are left untranslated.
- **Token lifecycle.** Per-room, hashed server-side, shown once, revocable (re-mint to rotate).
- **Push (when it lands):** posting a message notifies other human members via push (spec 009) — agents don't get pushed.

---

## Migration checklist (bridge)

- [ ] Remove the email→`yc_session` broker call; delete `YAPPCHAT_CHAT_EMAIL`, `YAPPCHAT_WS_URL`, `WXKANBAN_CONSUMER_SECRET` from the post/read path.
- [ ] Add `YAPPCHAT_TOKEN` (from Connect Claude) and send it as `Authorization: Bearer` on **both** GET and POST.
- [ ] Poll `GET …/messages`; treat `isagent === false` messages newer than your cursor as commands.
- [ ] Post output with `POST …/messages`; drop the `🤖 Claude` content prefix (optional).
- [ ] Verify: a test POST returns `201` with `"isagent": true` and shows as **🤖 Claude** on the left; a message you type in the app shows up in the GET with `"isagent": false`.
