# Spec 002: Personal Assistant (PA)

**Spec Number**: 002
**Status**: `draft`
**Created**: 2026-05-10
**Depends On**: Spec 001 (Common Chat Engine), Spec 004 (Agent & Skill Creation), Spec 006 (Document Generation)
**Source**: `specs/Project-Scope/002-personal-assistant-that-consumes-registe.md`

---

## Overview

The Personal Assistant (PA) is a **proactive AI avatar** embedded in YappChat. It is not a chatbot you pull up when you need something — it watches over the chat engine continuously and surfaces what matters: pending messages, upcoming calendar events, project items due, and actions taken by YappChat on your behalf.

When you want to interact with it, you can: ask it to build a presentation, create a new skill, show your week ahead, summarize your unread messages, or draft a reply. All of this happens through natural conversation in the PA's dedicated YappChat channel.

The PA is **AI-provider-agnostic**. Any AI that can be registered — Claude, GPT-4, Gemini, a local Ollama model, a self-hosted LLM, or a custom model behind an OpenAI-compatible endpoint — can power the PA. The user configures which AI backs their PA; the PA layer handles routing, context management, and tool invocation the same way regardless of provider.

The PA appears in the YappChat org directory as an avatar with its own channel (registered via spec 001 FR-010). It has a name, an avatar image, and a live status showing what it is currently doing.

---

## Core Design

| Element | Value |
| --- | --- |
| **Primary Actor** | YappChat user |
| **Secondary Actors** | AI provider (any registered), calendar service, email service, skill registry |
| **Key Value** | A single always-on assistant avatar that proactively surfaces what needs attention (messages, meetings, deadlines) and can be talked to for creation tasks (presentations, skills, schedules) using any AI provider the user registers. |
| **Scope Boundary** | IN SCOPE: PA avatar registration and channel; AI provider registry (any compatible provider); proactive monitoring of messages, calendar, and project items; calendar and email binding; skill discovery and interactive skill creation; presentation/content generation via scope 006; day/week/month schedule view; pending message count and summary; PA interactive chat sessions. OUT OF SCOPE: AI Avatar rendering/animation (scope 007); skill execution engine (scope 002 in prior definition, now merged here and scope 004); AI Chat full-screen surface (scope 005); billing. |

---

## User Scenarios & Testing

### US1 — PA surfaces morning briefing proactively

**Actor**: YappChat user (passive — no action required)

**Scenario**:

1. At 8:00 am (user-configured time) the PA wakes, queries: unread message count by channel, today's calendar events, project items due today or overdue.
2. PA composes a morning briefing using its configured AI provider and posts it into its YappChat channel: "Good morning Andy. You have 14 unread messages (3 from Slack #engineering, 7 from Discord), 2 meetings today (standup at 9am, client review at 2pm), and 1 project item overdue: 'Deploy auth service'."
3. PA updates its status badge to `briefing_delivered`.
4. User sees the notification dot on the PA avatar in the sidebar and opens the PA channel to read the briefing.

**Expected outcome**: Briefing appears in the PA channel without any user action. All data is accurate and pulled from live sources.

### US2 — User asks PA to show this week's schedule

**Actor**: YappChat user

**Scenario**:

1. User types in the PA channel: "Show me my week."
2. PA queries the connected calendar for events from today through Sunday. It also queries project items due this week.
3. PA responds with a structured week view: meetings listed by day with time and title, project deadlines interspersed, and any gaps where the user has unscheduled time.
4. User replies: "Move the client review on Thursday to Friday afternoon."
5. PA updates the calendar event via the calendar integration and confirms: "Done — client review moved to Friday at 2pm."

**Expected outcome**: Schedule rendered within 3 seconds. Calendar update confirmed. User never left YappChat.

### US3 — User asks PA to create a presentation

**Actor**: YappChat user

**Scenario**:

1. User types: "Create a presentation on our Q2 engineering progress. Use the last 30 days of messages from #engineering on Slack as source material."
2. PA invokes the `fetch_channel_messages` skill to retrieve the Slack messages, then calls scope 006 (Document Generation) to produce a presentation outline.
3. PA presents the outline: "Here's a 5-slide outline: 1. Summary, 2. Features shipped, 3. Performance improvements, 4. Tech debt tackled, 5. Q3 goals. Shall I fill it in or adjust the structure?"
4. User replies: "Add a slide on incidents and remove the tech debt slide."
5. PA adjusts and generates the full presentation, posting a download link back into the channel.

**Expected outcome**: Presentation generated from live source data, iteratively refined through conversation, delivered as a downloadable file.

### US4 — User asks PA to create a new skill

**Actor**: YappChat user

**Scenario**:

1. User types: "Create a skill that fetches the current Jira sprint status for project YAPP."
2. PA asks clarifying questions: "What's the Jira base URL? Do you want the full sprint or just open issues? Should this be synchronous or async?"
3. User answers. PA generates a skill definition: name (`get_jira_sprint`), description, JSON input schema, and a handler stub (HTTP endpoint spec that a developer or CI pipeline can implement).
4. PA registers the skill in the `skills` table via the skill creation API (spec 004) and confirms: "Skill `get_jira_sprint` is registered and ready. You'll need to deploy the handler at the URL I've suggested."
5. The skill immediately appears in the skill catalog and is available to the PA for future invocations.

**Expected outcome**: New skill created through conversation. Registered and available without writing code directly.

### US5 — User registers a new AI provider and sets it as their PA

**Actor**: YappChat user

**Scenario**:

1. User opens PA settings and clicks "Add AI provider."
2. User selects provider type `ollama` and enters the local Ollama base URL (`http://localhost:11434`) and selects model `llama3`.
3. YappChat pings the endpoint to verify connectivity and capabilities (streaming, tool-use support).
4. User sets this provider as their PA's active model.
5. From the next message, all PA responses are generated by the local Llama3 model. The PA avatar, channel, and all other behavior remain identical.

**Expected outcome**: PA switches AI providers without any service restart. User's data never leaves their network when using a local model.

### US6 — PA notifies user of pending messages by channel

**Actor**: YappChat user (passive)

**Scenario**:

1. User has been away for 2 hours. The PA's monitoring loop detects 23 new inbound messages across 4 channels.
2. PA posts a notification in its channel: "While you were away: 8 messages in Slack #general (2 mentioning you), 6 in Discord #dev, 5 in the Engineering WhatsApp group, 4 direct messages."
3. User replies: "Summarise the #general messages."
4. PA fetches and summarises them using its AI provider and posts the summary.

**Expected outcome**: PA aggregates pending counts by channel with mention detection. Summary generated on demand within 5 seconds.

---

## Functional Requirements

### FR-001 — PA avatar, channel, registration, and interaction entry points

The PA MUST exist as a registered entity in the YappChat system — an avatar with a name, a dedicated internal channel, and a presence in the org directory. It uses spec 001's agent channel infrastructure.

**Interaction entry points** — two ways to open the PA:

| Entry point | Trigger | What opens |
| --- | --- | --- |
| **Notification bubble** | A PA notification arrives | `PANotificationBubble` appears — compact floating card in the corner of the screen. Clicking the bubble opens spec 005 `AIChatPanel` scrolled to that specific notification. |
| **PA Avatar** | User clicks the PA avatar in the sidebar or org directory | Spec 005 `AIChatPanel` opens at the most recent conversation position. |

In both cases the destination is spec 005's `AIChatPanel` — spec 002 owns the *trigger contract* (which entry point fires which open command and with what scroll target) but does NOT own the panel itself. The panel surface is owned by spec 005; the avatar component rendered inside it is owned by spec 007.

**Open-command contract** — both entry points dispatch the same client-side action:

```typescript
type OpenAIChatPanel =
  | { source: "avatar" }                                  // resume last position
  | { source: "bubble"; notificationId: string };         // scroll to + highlight
```

Spec 005 subscribes to this action. Spec 002 is responsible only for emitting it.

**Acceptance Criteria**:

- [ ] On first setup, `POST /api/pa/setup` registers the PA by calling `POST /api/engine/agents` (spec 001 FR-010). The `name` and `avatarurl` passed to spec 001 are resolved by reading spec 007 `GET /api/avatar/current` for the calling user — spec 002 does NOT store its own copy of these values
- [ ] The PA appears in the org directory under an "Assistants" group with the avatar resolved via spec 007 and a live status badge: `idle` | `monitoring` | `responding` | `briefing_delivered` | `error`
- [ ] Clicking the PA avatar in the sidebar or org directory dispatches `OpenAIChatPanel({ source: "avatar" })` — spec 005 handles the open animation and scroll restoration
- [ ] When a notification arrives, a `PANotificationBubble` appears in the bottom-right corner of the screen: PA avatar thumbnail (spec 007), first line of the notification text, a dismiss (×) button. The bubble auto-dismisses after a configurable timeout (default 8 seconds) if not interacted with
- [ ] Clicking anywhere on the `PANotificationBubble` (not the dismiss button) dispatches `OpenAIChatPanel({ source: "bubble", notificationId })` — spec 005 scrolls to and highlights the message linked to that notification
- [ ] If multiple notifications arrive in quick succession, bubbles queue — a maximum of 3 are shown simultaneously, oldest at bottom; each new one animates in from the bottom-right
- [ ] Dismissed bubbles are still accessible in the `AIChatPanel` — dismissing a bubble does not mark the notification as read, it only removes the bubble
- [ ] The PA channel is a standard YappChat internal channel — all spec 001 messaging features apply (encryption, retention, message history). The PA channel is used for *proactive* PA output (briefings, alerts); user-initiated multi-turn conversations live in the named `assistantsessions` introduced in FR-008
- [ ] `PATCH /api/pa/config` lets the user update briefing time, notification preferences, and bubble timeout. `name` and `avatarurl` are out of scope here — they live in spec 007 `PATCH /api/avatar/user`
- [ ] `DELETE /api/pa/setup` deregisters the PA, disconnects all bindings, archives the PA channel, and soft-deletes all `assistantsessions` for the user

### FR-002 — AI provider registry

Any AI provider exposing a compatible API MUST be registerable as the PA's intelligence. The PA layer handles provider differences transparently.

**Acceptance Criteria**:

- [ ] `POST /api/pa/providers` registers a provider with: `name`, `type` (`openai-compatible` | `anthropic` | `ollama` | `custom`), `baseurl`, `model`, `apikeyref` (reference to a stored secret — never stored plaintext), `supportstooluse` (boolean), `supportsstreaming` (boolean)
- [ ] On registration, the engine pings the provider's chat endpoint with a test message to verify connectivity; returns `{ connected: true, latencyms }` or an error
- [ ] `PATCH /api/pa/config` with `{ providerid }` sets the active provider — takes effect on the next message, no restart required
- [ ] When `supportstooluse: false`, the PA falls back to a two-step pattern: first generates a tool selection decision as plain text, then parses and invokes — behaviour is identical to the user, response is slower
- [ ] Provider adapter implementations: OpenAI-compatible (single adapter covers OpenAI, Ollama, LM Studio, Groq, local vLLM, etc.); Anthropic (native `@anthropic-ai/sdk`); custom (user provides a request/response transformer function)
- [ ] `GET /api/pa/providers` lists all registered providers with connectivity status
- [ ] `DELETE /api/pa/providers/:id` removes a provider (cannot delete the active provider without switching first)

### FR-003 — Proactive monitoring and notifications

The PA MUST continuously monitor the chat engine, calendar, and project items and surface relevant notifications into its channel without user prompting.

**Acceptance Criteria**:

- [ ] Monitoring loop runs on a configurable interval (default: 5 minutes) — checks unread message counts per channel, mentions of the user, upcoming calendar events (within 15 minutes), and project items newly overdue
- [ ] Each notification type has a user-configurable threshold: e.g., "notify when unread > 10", "notify 15 minutes before calendar events", "notify when project item becomes overdue"
- [ ] Notifications are posted as PA messages in the PA channel with `messagetype: "notification"` and a structured payload: `{ type, count, items[], timestamp }`
- [ ] **Every posted notification also triggers a `PANotificationBubble`** in the bottom-right corner. Exception: if `PAFullChatView` is already open and the user's scroll position is at the bottom (i.e., they are actively reading), the bubble is suppressed — the new message is already visible
- [ ] The PA avatar status badge updates to `monitoring` during the polling loop and `idle` between polls
- [ ] Morning briefing fires a bubble with a short preview: "Good morning — your briefing is ready." Clicking opens `PAFullChatView` scrolled to the briefing message
- [ ] Notifications are deduplicated — the same unread count is not posted twice within a single monitoring window
- [ ] `GET /api/pa/notifications` returns the last 100 PA-generated notifications with read/unread status; `PATCH /api/pa/notifications/:id/read` marks one read; `POST /api/pa/notifications/read-all` marks all read
- [ ] A notification is marked `read: true` automatically when the user opens `PAFullChatView` and scrolls past it, or when they click the bubble that referenced it

### FR-004 — Calendar binding and schedule interaction

The PA MUST connect to one or more calendar services and expose the user's schedule interactively.

**Acceptance Criteria**:

- [ ] `POST /api/pa/calendar/bind` initiates OAuth binding to a calendar provider (Google Calendar, Microsoft Outlook, CalDAV). Stores token ref in `pacalendarbindings`
- [ ] `GET /api/pa/schedule?view=day|week|month&date=<ISO>` returns structured schedule data: events with title, start, end, location, attendees; project items due in the range interleaved by date
- [ ] Natural language schedule queries via PA chat: "What do I have on Thursday?", "Do I have any conflicts next week?", "Schedule a 30-minute call with the engineering team on Friday afternoon" — PA resolves, confirms with user, then calls the calendar API
- [ ] Event creation, update, and deletion via PA chat — PA always confirms the action before committing
- [ ] `DELETE /api/pa/calendar/bind/:id` disconnects a calendar account

### FR-005 — Email binding

The PA MUST connect to an email account and surface relevant emails as PA notifications.

**Acceptance Criteria**:

- [ ] `POST /api/pa/email/bind` initiates OAuth binding to an email provider (Gmail, Outlook, IMAP). Stores token ref in `paemailbindings`
- [ ] PA monitoring loop checks for new emails from VIP senders (user-configurable list) or emails matching user-defined keywords; posts a notification when found
- [ ] Natural language email queries via PA chat: "Do I have any emails from the client today?", "Summarise my inbox from the last 2 hours", "Draft a reply to Sarah's last email saying I'll have the report by Friday"
- [ ] PA can draft email replies and show them to the user for approval before sending — never sends without explicit user confirmation
- [ ] `DELETE /api/pa/email/bind/:id` disconnects an email account

### FR-006 — Skill discovery, interactive creation, community publishing, and update notifications

The PA MUST show available skills, create new skills through conversation, publish skills to a shared Community Skills catalog, allow users to install community skills, and notify users via their PA avatar when an installed community skill is updated.

**Skill categories** (applied to all skills):

| Category | Examples |
| --- | --- |
| `productivity` | Reminders, task creation, scheduling |
| `communication` | Send message, draft email, summarise channel |
| `data` | Fetch records, run query, transform data |
| `development` | Git status, CI/CD trigger, code search |
| `finance` | Invoice lookup, payment status |
| `media` | Image generation, file conversion |
| `integration` | Third-party API calls (Jira, Salesforce, etc.) |
| `custom` | User-defined, uncategorised |

**Acceptance Criteria**:

- [ ] `GET /api/pa/skills` returns the user's private skill catalog — name, description, async flag, category, usage stats, and `communityskillid` (set if the skill was installed from community)
- [ ] Interactive skill creation: user describes a skill → PA asks clarifying questions (endpoint, inputs, output, sync/async, category) → PA generates full skill definition → user approves → PA calls `POST /api/pa/skills/register`; skill created in `skills` table with `visibility: "private"` by default
- [ ] PA can suggest missing skills and can also suggest browsing Community Skills for existing matches before creating a duplicate
- [ ] Skills created via the PA are tagged `createdby: "pa"` and are available immediately
- [ ] **Publish to Community Skills**: when creating or editing a private skill the PA asks "Would you like to share this with the YappChat community?" If yes, the skill is copied to `communityskills` with the user as `authorid`, assigned a category, set to `version: "1.0.0"`, and becomes discoverable to all users
- [ ] **Browse Community Skills**: `GET /api/community/skills` returns the public catalog filterable by `category`, sortable by download count or newest. PA can surface this in conversation: "There are 3 community skills for Jira. The most popular is `get_jira_sprint` by @andy (142 installs). Want to install it?"
- [ ] **Install a community skill**: `POST /api/community/skills/:id/install` copies the skill definition into the user's `skills` table and creates a `communityskillsubscriptions` row. The installed copy is immediately usable by the PA
- [ ] **Community skill update notification**: when an author publishes an update (`PATCH /api/community/skills/:id`), the engine increments `version`, writes a `communityskillversions` diff record, and the PA posts a notification into every subscriber's PA channel:

  > "The community skill **get_jira_sprint** has been updated v1.2 → v1.3 by @andy.
  >
  > **What changed**: Added `includedone` input field; handler URL updated to v2 endpoint.
  >
  > Would you like to update your copy? Reply **yes** to update, **no** to keep your version, or **diff** to see the full change."

- [ ] User replies "yes" → PA calls `POST /api/community/skills/:id/update-installed`; user's skill copy is overwritten with the new version; `communityskillsubscriptions.updatedat` is set
- [ ] User replies "no" → `communityskillsubscriptions.skippedversion` is set to the new version; user is not re-prompted for that version
- [ ] User replies "diff" → PA posts the full before/after JSON schema comparison as a formatted message, then re-asks the yes/no question
- [ ] **Unpublish**: author calls `DELETE /api/community/skills/:id`; existing installed copies retain their local skill definition but `communityskillid` is cleared and subscriptions are removed. PA notifies each subscriber: "The community skill **get_jira_sprint** has been unpublished by its author. Your installed copy still works and is now fully independent."

### FR-007 — Content creation via PA (presentations, documents)

The PA MUST be able to create presentations and documents interactively, using scope 006 for generation and live data sources for content.

**Acceptance Criteria**:

- [ ] User describes content to create in natural language; PA clarifies source data (channels to pull from, date range, audience, format)
- [ ] PA fetches source data via registered skills (e.g., `fetch_channel_messages`, `get_project_status`), then calls scope 006 Document Generation API with the assembled content and format (PDF, PPTX, XLSX)
- [ ] PA presents an outline for user approval before generating the full document — user can modify structure through conversation
- [ ] On approval, PA triggers generation, posts a progress note ("Generating your presentation, ~30 seconds"), then posts the download link when complete
- [ ] PA can iterate: "Add a slide on incidents" → PA re-runs generation with the updated outline

### FR-008 — Multi-session interactive PA chat

Users MUST be able to maintain multiple **named sessions** with the PA — separate conversation threads (e.g., "Q2 report prep", "Engineering standup notes") each retaining their own context. Sessions are the data model behind spec 005's AI Chat surface; the PA channel (FR-001) is reserved for proactive PA output and does not appear in the session list.

**Two surfaces, one backend**:

| Surface | Owner | Storage | Purpose |
| --- | --- | --- | --- |
| **PA channel** (spec 001 internal channel) | Spec 002 FR-001 | spec 001 `messages` | Proactive: briefings, notifications, alerts |
| **Named AI Chat sessions** | Spec 002 FR-008 (this FR) | `assistantsessions` + `assistantmessages` (this spec) | User-initiated multi-turn conversations rendered in spec 005 `AIChatPanel` |

Both surfaces share the same active AI provider, skill catalog, and streaming pipeline — they differ only in storage and entry point.

**Acceptance Criteria**:

- [ ] `POST /api/pa/sessions` creates a new session — body `{ name? }` (defaults to a date/time stamp). Returns the new session row. `assistantsessions.userid` defaults to the caller; one user may have unlimited sessions
- [ ] `GET /api/pa/sessions` returns the caller's sessions ordered by `lastmessageat DESC`. Each row includes the session id, name, last message preview (first 60 chars of latest assistant or user message, decrypted client-side for E2E), `lastmessageat`, and `createdat`
- [ ] `PATCH /api/pa/sessions/:id` renames a session — body `{ name }`
- [ ] `DELETE /api/pa/sessions/:id` soft-deletes the session (sets `deletedat`); the daily purge job hard-deletes after 30 days. Attached `assistantmessages` and `chatattachments` (spec 005) are cascaded
- [ ] `GET /api/pa/sessions/:id/messages` returns cursor-paginated message history — params `before` (ISO timestamp), `limit` (max 100, default 50). Uses the same encryption rules as spec 001 (`encryptiontype`, `encryptedpayload`, server-side NULL `content` for E2E)
- [ ] `POST /api/pa/sessions/:id/messages` sends a user turn and streams the assistant reply over SSE. The request body accepts `{ content, attachmentids?: string[] }` where `attachmentids` references rows in spec 005's `chatattachments`. The response is `text/event-stream` with delta events (`token`, `tool_call_start`, `tool_call_end`, `subagent_spawned`, `done`)
- [ ] Per-session context window: each request to the AI provider includes the last 20 messages of `assistantmessages` for that session. If the provider's context limit is exceeded, the engine drops the oldest messages first and emits a `context_truncated` SSE event so the client can show a notice
- [ ] During a streamed reply, skill invocations emit `tool_call_start` / `tool_call_end` SSE deltas and write a row to `skillinvocations` (FR-014). Spawned subagents emit a `subagent_spawned` delta and write a row to `subagentexecutions` (FR-015)
- [ ] Streaming token delivery uses spec 003 WebSocket `pa.status` events for the avatar state machine; the SSE channel itself is the message-content delivery path
- [ ] The active AI provider and model are returned in the session detail (`GET /api/pa/sessions/:id`) so spec 005 can render "Powered by Llama3 (local)" in the panel header
- [ ] Session export: `GET /api/pa/sessions/:id/export?format=markdown|pdf|txt` returns the rendered session (delegates PDF generation to spec 006). Implements spec 005 FR-007

### FR-009 — Pending message summary and project dashboard

The PA MUST provide an on-demand and scheduled view of pending messages and project items due.

**Acceptance Criteria**:

- [ ] `GET /api/pa/dashboard` returns a structured payload: `{ pendingMessages: { total, byChannel: [{channelid, name, count, mentions}] }, projectItems: { overdue, dueToday, dueThisWeek }, nextEvent: { title, startsIn } }`
- [ ] PA renders this as a `PADashboardCard` component in its channel on morning briefing and on demand when user asks "What's pending?" or similar
- [ ] Pending message counts are sourced from spec 001's `messages` table — messages with `ackstate: "acked"` that the user has not opened in the conversation view (tracked via `lastreadmessageid` on each `conversations` row)
- [ ] Project items are sourced from the wxKanban MCP server (existing `projecttasks` table in mcp-server) — overdue = `duedate < now()`, due today = `duedate = today`

### FR-010 — Step-by-step third-party setup guidance

Any time a user attempts to connect an external service — calendar, email, AI provider API key, skill handler endpoint, or any OAuth/API integration — the PA MUST be able to provide complete step-by-step setup instructions on request. Instructions are written for non-technical users: plain language, numbered steps, screenshots described in words, and direct links to the correct external pages. No prior developer knowledge is assumed.

This applies to every external connection in this spec: Google Calendar, Microsoft Outlook, CalDAV, Gmail, IMAP, Outlook email, Anthropic API, OpenAI API, Ollama local setup, and any community skill handler endpoint.

**Setup guide library** (static, versioned per provider):

| Provider | Connection type | Guide key |
| --- | --- | --- |
| Google Calendar | OAuth | `google-calendar` |
| Microsoft Outlook Calendar | OAuth | `microsoft-calendar` |
| CalDAV | URL + credentials | `caldav-generic` |
| Gmail | OAuth | `google-gmail` |
| Microsoft Outlook Email | OAuth | `microsoft-outlook-email` |
| IMAP (generic) | Host + credentials | `imap-generic` |
| Anthropic (Claude) | API key | `anthropic-api-key` |
| OpenAI / compatible | API key + base URL | `openai-api-key` |
| Ollama (local) | Local install | `ollama-local-install` |
| Custom AI provider | API key + base URL | `custom-ai-provider` |
| Skill handler endpoint | HTTP endpoint deploy | `skill-handler-deploy` |

**Acceptance Criteria**:

- [ ] Every binding and provider registration flow surfaces a "How do I set this up?" button or link. Clicking it — or typing any natural-language equivalent in the PA channel (e.g., "How do I get a Google Calendar API key?", "I don't know how to connect my email", "What is a client secret?") — triggers the PA to post a `SetupGuideCard` with the relevant guide for that provider
- [ ] Each `SetupGuideCard` contains: a numbered list of steps, each step with a plain-English instruction and (where applicable) a direct URL to the relevant external page (e.g., `https://console.cloud.google.com/apis/credentials`). Steps never say "go to the developer console" — they say exactly which page and what to click
- [ ] Steps are broken into the smallest meaningful actions: "Click **Create Project**" is one step; "Name it anything — for example, 'YappChat Calendar'" is the next step. Each step fits on one line
- [ ] The PA monitors the user's progress through the conversation — if the user says "I'm on the credentials page" or "I see a screen asking for redirect URIs", the PA picks up from that point rather than restarting from step 1
- [ ] Sensitive values (client secrets, API keys) are never asked to be typed into the PA channel — the PA instructs the user to paste them into the secure input field in the `OAuthSetupGuide` component instead. The PA channel only receives a confirmation that the value was saved
- [ ] If the user is partway through setup and leaves the conversation, the PA resumes from the last completed step when the user returns: "Last time we got as far as Step 4 — creating the OAuth credentials. Ready to continue?"
- [ ] Guides are versioned in `setupguides` table — when a provider changes its console UI, an admin updates the guide and the version is bumped. The PA always serves the latest version
- [ ] `GET /api/pa/setup-guides` returns the list of all available guides with provider name, connection type, and version. `GET /api/pa/setup-guides/:key` returns the full step-by-step guide for that provider key
- [ ] If no guide exists for a requested provider, the PA responds: "I don't have a step-by-step guide for that provider yet, but here's what you'll generally need: [generic OAuth/API key checklist]"

### FR-014 — Skill invocation runtime

The PA MUST own the runtime that turns a skill *definition* (owned by spec 004) into an actual HTTP call against the registered handler URL, applies authentication, enforces timeouts, and records the result. Spec 004 explicitly excludes this runtime from its scope; it lives here.

**Acceptance Criteria**:

- [ ] When the AI provider returns a tool-use block selecting a skill `name`, the PA resolves the matching `enabled: true` row from spec 004's `skills` table. Disabled skills produce a `skill_disabled` SSE error event and are not invoked
- [ ] The PA validates the tool-use arguments against `skills.inputschema` (JSON Schema Draft 7, `ajv`). Validation failures return a `tool_result` with `{ ok: false, error: "input_validation_failed", details }` to the AI provider — the model can correct and retry
- [ ] For synchronous skills (`async: false`), the PA POSTs `{ arguments }` to `handlerurl` with headers `X-Skill-Token: <skilltoken>`, `Content-Type: application/json`, `User-Agent: yappchat-pa/<version>`. Timeout: 30 seconds. Response body is returned to the AI provider as the `tool_result`
- [ ] For asynchronous skills (`async: true`), the PA spawns a subagent via FR-015 and returns a `tool_result` containing `{ subagentid, status: "spawned" }` immediately; the model continues without waiting
- [ ] Every invocation writes one row to `skillinvocations` with: `skillid`, `userid`, `sessionid` (nullable — set when invoked from a session), `arguments`, `httpstatus`, `responsebody` (truncated to 32KB), `latencyms`, `success`, `errormessage`, `invokedby` (`"pa"` | `"subagent"` | `"studio_test"` — Studio tests come via spec 004 and tag accordingly), `invokedat`
- [ ] On HTTP 5xx or network error, the PA retries up to 2 times with 1s/3s backoff. On HTTP 4xx the PA does not retry — it returns the error to the model immediately
- [ ] Rate limiting: per-skill concurrency cap of 5 in-flight invocations per user. Excess invocations queue for up to 10 seconds, then fail with `tool_result.error: "skill_busy"`
- [ ] Skill handler URLs MUST be HTTPS in production (matches spec 004 constraint). The runtime rejects HTTP URLs with `error: "insecure_handler_url"` unless `ALLOW_HTTP_SKILL_HANDLERS=true`

### FR-015 — Subagent execution runtime

When the PA needs multi-step background work, it spawns a **subagent** from a spec 004 `agenttemplates` row. Subagents run independently of the originating session, post status updates back over WebSocket, and may invoke skills (FR-014) themselves.

**Acceptance Criteria**:

- [ ] `POST /api/pa/subagents` body `{ agenttemplateid, prompt, parentsessionid? }` spawns a subagent. Returns the new `subagentexecutions` row. The template's `enabled` flag must be true; disabled templates return HTTP 422
- [ ] The subagent runs as a background task (Node.js worker / queued job) with its own AI provider context — built from the template's `systemprompt` plus the spawn `prompt`. The skill set available to the subagent is exactly the template's `agenttemplateskills` join — not the user's full catalog
- [ ] Subagent status is one of `spawned` | `working` | `waiting_for_input` | `completed` | `error`. Status changes are pushed via spec 003 WebSocket `subagent.status` events scoped to `user:{userid}`. Spec 005 renders this in `SubagentCard`
- [ ] Skill invocations made by a subagent write rows to `skillinvocations` with `invokedby: "subagent"` and `subagentexecutionid` set
- [ ] On completion, the subagent's final response is written to `subagentexecutions.result` (jsonb) and a `subagent.status` event with `status: "completed"` is emitted. If `parentsessionid` is set, an `assistantmessages` row is appended to that session with the result so the user sees it inline
- [ ] On error, `subagentexecutions.errormessage` is set and a `subagent.status` event with `status: "error"` is emitted
- [ ] Subagents have a hard runtime limit of 10 minutes (configurable per-template via `agenttemplates.maxruntimeseconds` — spec 004 should add this column). Exceeding the limit moves the row to `status: "error"` with `errormessage: "runtime_limit_exceeded"`
- [ ] `GET /api/pa/subagents/:id` returns the current state. `GET /api/pa/subagents?sessionid=` lists subagents spawned from a session

### FR-017 — Internal "post-to-PA-channel" SDK

Server-side code in OTHER scopes (capacity alerts in spec 003 FR-007, recovery-attempt alerts in spec 010 FR-004, monitoring loops here in FR-003, future scopes that need to surface a system message to a user) MUST be able to publish into a user's PA channel without making a self-loopback HTTP call. This FR defines the internal API every server-side scope imports.

**SDK surface** (TypeScript, importable from any server-side scope):

```typescript
// packages/server/pa-notify/index.ts
export async function postPANotification(opts: {
  userid: string
  type: PANotificationType  // matches panotifications.type enum
  payload: Record<string, unknown>
  previewtext: string       // shown in bubble + push body
  bypassQuietHours?: boolean // for urgent alerts (default false)
}): Promise<{ notificationid: string }>
```

**Acceptance Criteria**:

- [ ] `postPANotification` writes a row to `panotifications`, then publishes a `pa.notification` WSEvent scoped to `user:{userid}` via spec 003's `WSBroker.publish`. The push fanout (spec 009) picks it up automatically — no extra wiring needed
- [ ] The SDK is the ONLY supported way for non-PA server code to add to the PA channel. Direct INSERT into `panotifications` from another scope is a hard violation — bypasses WS publish, audit, and rate limits
- [ ] Per-user rate limit: 60 system-posted notifications per hour per user. Excess calls log a warning and return without writing. This protects against a runaway publisher (e.g., a buggy monitoring loop)
- [ ] Each call writes a `pasystemnotificationaudit` row: `{ id, userid, type, callerscope (e.g., "ws-engine-capacity-alert"), createdat }`. Used to attribute floods to the responsible scope. Retained 30 days
- [ ] `bypassQuietHours: true` sets a flag on the WSEvent payload that spec 009 FR-007 reads when deciding whether to push during the user's quiet-hours window. Capacity alerts and recovery alerts both set this true
- [ ] When the WS engine is in `LocalBroker` mode (spec 003 FR-007), the call is in-process. When in `RedisBroker` mode, the call publishes to Redis and the receiving WS-engine instance fans out to connected clients — same SDK surface either way

**New table** for caller attribution:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `userid` | text | Recipient |
| `type` | text | The PA notification type |
| `callerscope` | text | Identifier of the calling scope — e.g., `"ws-capacity"`, `"keybackup-recovery"`, `"pa-monitoring"` |
| `createdat` | timestamptz | |
| `expiresat` | timestamptz | `createdat + 30 days` |

Table name: `pasystemnotificationaudit`.

### FR-016 — OAuth callback handler

External-service bindings (FR-004 calendar, FR-005 email, plus any future OAuth-based MCP server) MUST share a single OAuth callback endpoint. The PA-specific binding routes (`/api/pa/calendar/bind`, `/api/pa/email/bind`) initiate the flow; the callback endpoint completes it.

**Acceptance Criteria**:

- [ ] `GET /api/integrations/oauth/callback/:provider` accepts standard OAuth 2.0 query params (`code`, `state`, `error?`). The `:provider` path segment matches a key from the OAuth provider registry chosen during library evaluation (Notes section: Better Auth / Arctic / Nango)
- [ ] The `state` parameter is a signed token created when `POST /api/pa/calendar/bind` (or `/email/bind`) starts the flow. It encodes `userid`, `bindingtype`, and a 10-minute expiry. Mismatched or expired state → HTTP 400, no token storage
- [ ] On success, the callback exchanges the code for tokens, stores `accesstoken` and `refreshtoken` as references in the secrets store, and writes the `pacalendarbindings` or `paemailbindings` row. The user is redirected back to a deep link the PA channel sends them to
- [ ] Token refresh: a background job runs every 10 minutes scanning bindings whose access token expires within 15 minutes; refreshes them via the provider's refresh endpoint and updates the secret. On refresh failure (revoked, expired refresh token) the binding is marked `status: "revoked"` and the PA posts a notification: "Your Google Calendar connection needs to be reconnected"
- [ ] All redirect URIs are registered with each provider in advance — the callback endpoint MUST validate that `state.expectedredirect` matches the post-callback redirect target

### FR-011 — Multiple MCP server registration and tool aggregation

The PA MUST be able to connect to any number of registered MCP (Model Context Protocol) servers simultaneously. Tools exposed by those servers are merged with the registered skill catalog and presented to the AI provider as a unified tool list. The user manages MCP servers the same way they manage skills — register, connect, discover, use.

MCP is the open standard protocol (Apache 2.0, published by Anthropic) for connecting AI models to external tools, data sources, and services. YappChat already ships `@modelcontextprotocol/sdk` in its MCP server — the same SDK is used here on the client side to connect to external MCP servers.

**Supported MCP transport types**:

| Type | When to use | Example |
| --- | --- | --- |
| `stdio` | Local process running on the same machine | `npx @modelcontextprotocol/server-filesystem` |
| `http` | Remote MCP server with Streamable HTTP transport | Self-hosted or third-party HTTP MCP server |
| `sse` | Remote MCP server with SSE transport (older protocol) | Legacy MCP servers |

**Well-known MCP servers the PA can connect to out of the box** (as examples; any MCP-compatible server works):

| Server | What it exposes | Install |
| --- | --- | --- |
| `@modelcontextprotocol/server-filesystem` | Read/write local files and directories | `npx` |
| `@modelcontextprotocol/server-github` | GitHub repos, issues, PRs, file content | `npx` |
| `@modelcontextprotocol/server-slack` | Slack channels, messages, users | `npx` |
| `@modelcontextprotocol/server-postgres` | Query a PostgreSQL database | `npx` |
| `@modelcontextprotocol/server-brave-search` | Web search via Brave Search API | `npx` |
| Any custom MCP server | Whatever the server implements | User-deployed |

**Acceptance Criteria**:

- [ ] `POST /api/pa/mcp` registers an MCP server with: `name`, `transport` (`stdio` | `http` | `sse`), `command` (for stdio: e.g., `npx @modelcontextprotocol/server-filesystem /home/user/docs`), `url` (for http/sse), `headers` (optional auth headers for http/sse), `enabled`
- [ ] On registration the PA backend connects to the MCP server using `@modelcontextprotocol/sdk`'s `Client` class and calls `list_tools()`, `list_resources()`, and `list_prompts()`. The results are cached in `mcptooldiscovery`
- [ ] At PA startup, the engine connects to all `enabled: true` MCP servers and maintains persistent connections — `stdio` servers are kept as subprocesses; `http`/`sse` servers maintain the transport session
- [ ] All tools from all connected MCP servers are merged with the registered `skills` table when building the Claude tool list. The merged set is de-duplicated by tool name (MCP tools take precedence over skills with the same name, with a warning logged)
- [ ] When the PA invokes an MCP tool (because the AI provider selected it), it calls the MCP server's `call_tool(name, arguments)` method and returns the result as a `tool_result` message to the AI provider — identical flow to skill invocation
- [ ] `GET /api/pa/mcp/:id/tools` returns the cached tool list from a specific server — name, description, input schema for each tool
- [ ] `GET /api/pa/mcp/:id/resources` returns the resource list — URI, name, description, MIME type for each resource. PA can fetch a resource's content via `read_resource(uri)` and include it in context
- [ ] If an MCP server disconnects, the PA marks it `status: "offline"`, removes its tools from the merged tool list, and posts a PA notification: "MCP server **Filesystem** went offline. Its tools are temporarily unavailable." The PA reconnects automatically with exponential backoff
- [ ] `POST /api/pa/mcp/:id/reconnect` triggers an immediate reconnect attempt
- [ ] MCP server secrets (API keys in headers) are stored as secret references — never in plaintext in `mcpservers.headers`
- [ ] Setup guidance (FR-010) applies to MCP servers: if a user asks "How do I connect the GitHub MCP server?", the PA provides step-by-step instructions for that server's prerequisites (API key, install command, etc.) using a guide from `setupguides` with key `mcp-github`, `mcp-filesystem`, etc.
- [ ] `GET /api/pa/mcp` returns all registered servers with: name, transport type, connection status (`connected` | `offline` | `error`), tool count, last connected timestamp

---

## Data Requirements

New tables introduced by this scope. Naming: plural, lowercase, no camelCase. PKs are UUID v7.

| Table | Purpose |
| --- | --- |
| `paconfigs` | One row per user — active provider, avatar, briefing time, notification prefs |
| `aiproviders` | Registered AI providers — type, baseurl, model, capabilities |
| `pacalendarbindings` | OAuth calendar connections per user |
| `paemailbindings` | OAuth email connections per user |
| `panotifications` | PA-generated notifications — type, payload, read status |
| `assistantsessions` | Named multi-turn chat sessions per user — backs spec 005 AI Chat surface |
| `assistantmessages` | Persistent message history per session — encryption rules mirror spec 001 |
| `skillinvocations` | One row per skill HTTP call — referenced by spec 004 stats endpoints |
| `subagentexecutions` | One row per spawned subagent run — status, parent session, result |
| `communityskills` | Public shared skill catalog — published by users, discoverable by all |
| `communityskillversions` | Immutable version history per community skill — diff, change summary |
| `communityskillsubscriptions` | Tracks which users installed which community skill and at which version |
| `setupguides` | Versioned step-by-step setup guides per provider — steps JSON, URLs, screenshot descriptions |
| `pasetupprogress` | Per-user resume state for in-progress setup guides |
| `mcpservers` | Registered MCP servers per user — transport type, command/URL, connection status |
| `mcptooldiscovery` | Cached tools, resources, and prompts discovered from each MCP server |

### `paconfigs`

`name` and `avatarurl` are intentionally absent — spec 007 `avatarconfigs` is the source of truth for both. The PA always renders with the user's resolved avatar persona.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `userid` | text | Owning user (UNIQUE) |
| `agentid` | uuid | FK → agents.id (spec 001) — the PA's agent registration |
| `activeproviderid` | uuid | FK → aiproviders.id |
| `briefingtimeutc` | time | Daily briefing time in UTC |
| `monitorintervalmin` | integer | Monitoring poll interval in minutes (default 5) |
| `notificationprefs` | jsonb | Thresholds per notification type |
| `bubbletimeoutms` | integer | `PANotificationBubble` auto-dismiss timeout (default 8000) |
| `createdat` | timestamptz | |
| `updatedat` | timestamptz | |

### `aiproviders`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `userid` | text | Owning user — providers are per-user. Nullable when `isdefault: true` (system-default providers have no owner) |
| `name` | text | User-assigned label (e.g., "Local Llama3", "Work Claude") |
| `type` | text | `"openai-compatible"` \| `"anthropic"` \| `"ollama"` \| `"custom"` |
| `baseurl` | text | API base URL |
| `model` | text | Model identifier (e.g., `llama3`, `claude-sonnet-4-6`, `gpt-4o`) |
| `apikeyref` | text | Reference to stored secret — never the key itself |
| `supportstooluse` | boolean | Whether the provider supports function/tool calling |
| `supportsstreaming` | boolean | Whether the provider supports SSE streaming |
| `isdefault` | boolean | When true and `userid IS NULL`, this row is the deployment-wide system default used by spec 004 Archie when the caller has no personal PA configured. At most one row may have `isdefault: true`. **Setting / clearing this flag is gated to callers with `users.issystemadmin = true` (spec 011 FR-009).** Implemented via a separate route `PATCH /api/pa/providers/system-default` (system admin only, body `{ providerid }`) — the per-user `POST /api/pa/providers` route MUST NOT accept `isdefault` from the request body |
| `lastpingedat` | timestamptz | Last successful connectivity check |
| `lastpinglatencyms` | integer | |
| `createdat` | timestamptz | |

Partial unique index: `CREATE UNIQUE INDEX aiproviders_one_default ON aiproviders ((1)) WHERE isdefault = true` to enforce the single-default rule.

### `pacalendarbindings`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `userid` | text | |
| `provider` | text | `"google"` \| `"outlook"` \| `"caldav"` |
| `accountemail` | text | The calendar account email |
| `tokenref` | text | Encrypted OAuth token reference |
| `scopes` | text[] | Granted OAuth scopes |
| `createdat` | timestamptz | |

### `paemailbindings`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `userid` | text | |
| `provider` | text | `"gmail"` \| `"outlook"` \| `"imap"` |
| `accountemail` | text | |
| `tokenref` | text | Encrypted OAuth token reference |
| `vipsenders` | text[] | Email addresses that always trigger notifications |
| `keywords` | text[] | Subject/body keywords that trigger notifications |
| `createdat` | timestamptz | |

### `panotifications`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `userid` | text | |
| `type` | text | `"briefing"` \| `"pending_messages"` \| `"calendar_reminder"` \| `"project_overdue"` \| `"email_alert"` |
| `payload` | jsonb | Structured notification data |
| `read` | boolean | Default false |
| `createdat` | timestamptz | |

### `assistantsessions`

Named multi-turn chat sessions. One user has many sessions. Backs spec 005's session sidebar and message thread.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `userid` | text | Owning user |
| `name` | text | User-assigned name (default: timestamp like "May 10, 4:32pm") |
| `providerid` | uuid | FK → aiproviders.id — provider active when session was created (frozen at create; user can re-create a session against a different provider) |
| `lastmessageat` | timestamptz | Updated whenever a message is appended — used for sidebar ordering |
| `deletedat` | timestamptz | Nullable — soft-delete timestamp; row hard-deleted by daily job 30 days after this is set |
| `createdat` | timestamptz | |

Index on `(userid, deletedat NULLS FIRST, lastmessageat DESC)` for the session list query.

### `assistantmessages`

One row per turn (user or assistant). Encryption follows spec 001's rules — YappChat→YappChat E2E by default, plaintext only for messages bridged from external services.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `sessionid` | uuid | FK → assistantsessions.id |
| `role` | text | `"user"` \| `"assistant"` \| `"tool_result"` (raw skill output kept for context) |
| `encryptiontype` | text | `"e2e"` \| `"platform"` — mirrors spec 001 column |
| `content` | text | Plaintext — NULL when `encryptiontype = "e2e"` |
| `encryptedpayload` | bytea | Ciphertext — set when `encryptiontype = "e2e"` |
| `encryptionkeyid` | uuid | FK → spec 001 `userencryptionkeys.id` for E2E rows |
| `attachmentids` | uuid[] | FK array → spec 005 `chatattachments.id` (nullable) |
| `toolcalls` | jsonb | Nullable — for `role = "assistant"`, structured record of skills invoked during this turn (skillid, arguments digest, success, latencyms) |
| `subagentexecutionid` | uuid | Nullable — set when this assistant turn spawned a subagent |
| `prompttokens` | integer | Nullable — usage metering |
| `completiontokens` | integer | Nullable |
| `createdat` | timestamptz | |

Index on `(sessionid, createdat DESC)` for cursor pagination.

### `skillinvocations`

Audit + stats record for every skill HTTP call. Read by spec 004's `/api/studio/skills/:id/stats`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `skillid` | uuid | FK → spec 004 `skills.id` |
| `userid` | text | Owning user (skill owner OR caller — same in v1) |
| `sessionid` | uuid | Nullable FK → assistantsessions.id (set when invoked from a session) |
| `subagentexecutionid` | uuid | Nullable FK → subagentexecutions.id |
| `invokedby` | text | `"pa"` \| `"subagent"` \| `"studio_test"` |
| `arguments` | jsonb | Tool-use arguments sent to the handler |
| `httpstatus` | integer | Nullable when network error |
| `responsebody` | jsonb | Nullable — truncated to 32KB |
| `errormessage` | text | Nullable |
| `latencyms` | integer | |
| `success` | boolean | True for 2xx |
| `invokedat` | timestamptz | |

Index on `(skillid, invokedat DESC)` — drives spec 004 stats and the "skills with > 20% error rate over last 7 days" warning.

### `subagentexecutions`

One row per subagent spawn. Drives spec 005's `SubagentCard` and spec 004's `/api/studio/agents/:id/stats`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `agenttemplateid` | uuid | FK → spec 004 `agenttemplates.id` |
| `userid` | text | User who triggered the spawn |
| `parentsessionid` | uuid | Nullable FK → assistantsessions.id |
| `prompt` | text | The spawn prompt |
| `status` | text | `"spawned"` \| `"working"` \| `"waiting_for_input"` \| `"completed"` \| `"error"` |
| `result` | jsonb | Nullable — final structured result on `completed` |
| `errormessage` | text | Nullable |
| `prompttokens` | integer | Nullable — total across the run |
| `completiontokens` | integer | Nullable |
| `runtimems` | integer | Nullable — total wall time |
| `startedat` | timestamptz | Set when status moves to `working` |
| `completedat` | timestamptz | Nullable |
| `createdat` | timestamptz | |

### `communityskills`

The shared public catalog. Each row is a published copy of a skill owned by its author.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `authorid` | text | YappChat user who published the skill |
| `sourceskillid` | uuid | FK → skills.id — the author's original private skill |
| `name` | text | Unique snake_case tool name (e.g., `get_jira_sprint`) |
| `label` | text | Human-readable label |
| `description` | text | Tool description (sent to AI providers as tool definition) |
| `category` | text | `productivity` \| `communication` \| `data` \| `development` \| `finance` \| `media` \| `integration` \| `custom` |
| `inputschema` | jsonb | JSON Schema for tool inputs |
| `handlerurl` | text | HTTP POST handler endpoint |
| `async` | boolean | Synchronous or subagent-based |
| `version` | text | Semver — incremented on each published update (e.g., `1.0.0`) |
| `downloadcount` | integer | Total installs across all users |
| `published` | boolean | False when author unpublishes — existing installations unaffected |
| `createdat` | timestamptz | |
| `updatedat` | timestamptz | Set on each version bump |

### `communityskillversions`

Immutable version history. One row per published update — stores what changed.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `communityskillid` | uuid | FK → communityskills.id |
| `version` | text | The new version string |
| `previousversion` | text | The version being replaced |
| `changesummary` | text | Author-written or PA-generated plain-text summary of changes |
| `schemadiff` | jsonb | Structured diff: `{ added: [...], removed: [...], modified: [...] }` |
| `handlerurlchanged` | boolean | True if the handler URL changed in this version |
| `publishedat` | timestamptz | |

### `communityskillsubscriptions`

Tracks which users have installed which community skills, and their update preferences.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `userid` | text | The user who installed the skill |
| `communityskillid` | uuid | FK → communityskills.id |
| `localskillid` | uuid | FK → skills.id — the user's installed local copy |
| `installedversion` | text | The version that was installed |
| `skippedversion` | text | Nullable — most recent update the user declined |
| `updatedat` | timestamptz | Set when user accepts an update |
| `createdat` | timestamptz | |

UNIQUE constraint on `(userid, communityskillid)`.

### `setupguides`

Versioned step-by-step setup guides for every external provider. One row per provider key. Admins update guide content when provider UIs change; the PA always serves the latest version.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `guidekey` | text | Unique slug (e.g., `google-calendar`, `anthropic-api-key`) — UNIQUE |
| `providername` | text | Human label (e.g., "Google Calendar", "Anthropic Claude") |
| `connectiontype` | text | `"oauth"` \| `"apikey"` \| `"url-credentials"` \| `"local-install"` |
| `version` | text | Semver — incremented when steps are edited |
| `steps` | jsonb | Ordered array of step objects: `{ stepnumber, title, instruction, url?, screenshotdesc? }` |
| `notes` | text | Nullable — additional context shown after the steps (e.g., "If you don't see this option, your account may need admin permissions") |
| `updatedat` | timestamptz | |

**Step object shape**:

```json
{
  "stepnumber": 3,
  "title": "Create an OAuth Client ID",
  "instruction": "In the left sidebar click **APIs & Services**, then click **Credentials**. At the top of the page click **+ Create Credentials** and choose **OAuth client ID**.",
  "url": "https://console.cloud.google.com/apis/credentials",
  "screenshotdesc": "A blue button labelled '+ Create Credentials' appears near the top-left of the page"
}
```

### `pasetupprogress`

Tracks where a user is in a multi-step setup guide so the PA can resume from the last completed step on return.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `userid` | text | |
| `guidekey` | text | FK → setupguides.guidekey |
| `laststepnumber` | integer | Last step the user confirmed completing |
| `completed` | boolean | True when all steps done and binding/registration succeeded |
| `startedat` | timestamptz | |
| `updatedat` | timestamptz | |

UNIQUE constraint on `(userid, guidekey)`.

### `mcpservers`

One row per registered MCP server per user. Stores connection config; secrets are references only.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `userid` | text | Owning user |
| `name` | text | User-assigned label (e.g., "Local Filesystem", "GitHub MCP") |
| `transport` | text | `"stdio"` \| `"http"` \| `"sse"` |
| `command` | text | Nullable — full shell command for stdio transport (e.g., `npx -y @modelcontextprotocol/server-filesystem /home/docs`) |
| `url` | text | Nullable — base URL for http/sse transport |
| `headersref` | text | Nullable — reference to stored secret containing auth headers JSON |
| `enabled` | boolean | Whether the PA connects to this server on startup |
| `status` | text | `"connected"` \| `"offline"` \| `"error"` |
| `lastconnectedat` | timestamptz | Nullable |
| `lasterrorat` | timestamptz | Nullable |
| `lasterrormessage` | text | Nullable — most recent connection error |
| `createdat` | timestamptz | |

### `mcptooldiscovery`

Cached tool, resource, and prompt definitions from each MCP server — refreshed on connect and on-demand.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `mcpserverid` | uuid | FK → mcpservers.id |
| `itemtype` | text | `"tool"` \| `"resource"` \| `"prompt"` |
| `name` | text | Tool/resource/prompt name as reported by the server |
| `description` | text | Description for display and AI provider tool list |
| `inputschema` | jsonb | Nullable — JSON Schema for tool inputs; null for resources/prompts |
| `uri` | text | Nullable — resource URI (for `itemtype: "resource"`) |
| `mimetype` | text | Nullable — MIME type for resources |
| `discoveredat` | timestamptz | When this item was last fetched from the server |

UNIQUE constraint on `(mcpserverid, itemtype, name)`.

---

## API Routes

### PA Setup and Config

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/pa/setup` | First-time PA registration — creates agent, channel, paconfig |
| GET | `/api/pa/config` | Get current PA config |
| PATCH | `/api/pa/config` | Update PA name, avatar, briefing time, active provider, notification prefs |
| DELETE | `/api/pa/setup` | Deregister PA — disconnects all bindings, archives channel |

### AI Providers

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/pa/providers` | List registered providers with connectivity status |
| POST | `/api/pa/providers` | Register a new AI provider — pings endpoint on creation |
| PATCH | `/api/pa/providers/:id` | Update provider config |
| DELETE | `/api/pa/providers/:id` | Remove provider (must not be active) |
| POST | `/api/pa/providers/:id/ping` | Test connectivity — returns `{ connected, latencyms }` |
| PATCH | `/api/pa/providers/system-default` | **System admin only** (spec 011 FR-009 `issystemadmin`) — set / clear the deployment-wide default provider; body `{ providerid }` or `{ providerid: null }` to clear. Enforces single-default constraint via partial unique index. The per-user `POST /api/pa/providers` route MUST reject any `isdefault` field in the body — only this route can write the flag |

### Calendar and Email

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/pa/calendar/bind` | Initiate OAuth calendar binding |
| GET | `/api/pa/calendar/bindings` | List connected calendar accounts |
| DELETE | `/api/pa/calendar/bind/:id` | Disconnect calendar account |
| GET | `/api/pa/schedule` | Schedule data — params: `view` (day, week, or month), `date` (ISO-8601) |
| POST | `/api/pa/email/bind` | Initiate OAuth email binding |
| GET | `/api/pa/email/bindings` | List connected email accounts |
| DELETE | `/api/pa/email/bind/:id` | Disconnect email account |

### Dashboard and Notifications

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/pa/dashboard` | Structured pending messages + project items + next event |
| GET | `/api/pa/notifications` | Last 100 PA notifications with read status |
| PATCH | `/api/pa/notifications/:id/read` | Mark one notification read |
| POST | `/api/pa/notifications/read-all` | Mark all notifications read |

### Private Skills

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/pa/skills` | User's private skill catalog — name, description, category, usage stats, communityskillid if installed |
| POST | `/api/pa/skills/register` | Register a skill created via PA conversation (writes to spec 004 skills table) |

### Community Skills

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/community/skills` | Browse public catalog — filterable by `category`, sortable by `downloadcount` or `createdat` |
| GET | `/api/community/skills/:id` | Community skill detail — current version, author, install count, version history |
| GET | `/api/community/skills/:id/versions` | Full version history for a community skill |
| POST | `/api/community/skills/:id/install` | Install a community skill — copies definition to user's `skills` table, creates subscription |
| POST | `/api/community/skills/:id/update-installed` | Accept a pending update — overwrites user's local copy with latest version |
| POST | `/api/pa/skills/:id/publish` | Publish a private skill to Community Skills — sets category, creates `communityskills` row at v1.0.0 |
| PATCH | `/api/community/skills/:id` | Author publishes an update — increments version, writes diff to `communityskillversions`, triggers PA notifications to all subscribers |
| DELETE | `/api/community/skills/:id` | Author unpublishes — clears subscriptions, notifies subscribers that their copy is now independent |

### Setup Guides

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/pa/setup-guides` | List all available guides — guidekey, providername, connectiontype, version |
| GET | `/api/pa/setup-guides/:key` | Full guide — all steps with instructions, URLs, screenshot descriptions |
| GET | `/api/pa/setup-guides/:key/progress` | User's current progress through a guide — laststepnumber, completed |
| PATCH | `/api/pa/setup-guides/:key/progress` | Update progress — `{ laststepnumber }` — called as user confirms each step |
| POST | `/api/pa/setup-guides/:key/reset` | Reset guide progress to step 0 (user wants to start over) |

### MCP Servers

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/pa/mcp` | List all registered MCP servers — name, transport, status, tool count, last connected |
| POST | `/api/pa/mcp` | Register a new MCP server — transport, command or URL, name, optional auth headers ref |
| GET | `/api/pa/mcp/:id` | Server detail — config, connection status, error message if offline |
| PATCH | `/api/pa/mcp/:id` | Update server config (name, command, URL, enabled flag) |
| DELETE | `/api/pa/mcp/:id` | Remove server — disconnects subprocess or HTTP session, deletes discovery cache |
| POST | `/api/pa/mcp/:id/reconnect` | Trigger an immediate reconnect attempt |
| GET | `/api/pa/mcp/:id/tools` | Cached tool list from this server — name, description, input schema per tool |
| GET | `/api/pa/mcp/:id/resources` | Cached resource list — URI, name, description, MIME type per resource |
| POST | `/api/pa/mcp/:id/discover` | Re-run tool/resource/prompt discovery — refreshes `mcptooldiscovery` cache |

### AI Chat sessions (FR-008) — backs spec 005

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/pa/sessions` | List caller's sessions ordered by `lastmessageat DESC` — soft-deleted excluded |
| POST | `/api/pa/sessions` | Create a new named session — returns the row |
| GET | `/api/pa/sessions/:id` | Session detail — name, providerid, message counts, current provider label |
| PATCH | `/api/pa/sessions/:id` | Rename — body `{ name }` |
| DELETE | `/api/pa/sessions/:id` | Soft-delete — row hard-deleted 30 days later |
| GET | `/api/pa/sessions/:id/messages` | Cursor-paginated history — params `before`, `limit` |
| POST | `/api/pa/sessions/:id/messages` | Send user turn; SSE-streams the assistant reply |
| GET | `/api/pa/sessions/:id/export` | Export session — params `format` (`markdown` \| `pdf` \| `txt`); PDF delegates to spec 006 |

### PA channel (proactive output, FR-001)

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/pa/messages` | Used by the PA backend itself to post into the PA channel — not for user-initiated chat |
| GET | `/api/pa/messages` | PA channel message history (briefings, alerts) — cursor-based |

### Subagents (FR-015)

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/pa/subagents` | Spawn a subagent from an agent template — body `{ agenttemplateid, prompt, parentsessionid? }` |
| GET | `/api/pa/subagents/:id` | Current state — status, result, errormessage |
| GET | `/api/pa/subagents` | List subagents — filter `?sessionid=` or `?status=` |
| POST | `/api/pa/subagents/:id/cancel` | Cancel a running subagent — sets status to `error` with `errormessage: "cancelled"` |

### OAuth callback (FR-016)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/integrations/oauth/callback/:provider` | Shared OAuth 2.0 callback — completes calendar / email / MCP bindings using a signed `state` param |

---

## Frontend Components

### Core PA UI

**Interaction flow**:

```text
Notification arrives
       │
       ▼
PANotificationBubble  ──── user clicks bubble ──▶  dispatch OpenAIChatPanel
(bottom-right corner)                              ({ source: "bubble", notificationId })
       │                                                    │
       │ user clicks ×                                      ▼
       ▼                                          spec 005 AIChatPanel opens,
   (dismissed —                                   scrolled to + highlighting
   notification still                             the linked message
   unread)


PAAvatar (sidebar)  ──── user clicks avatar ──▶  dispatch OpenAIChatPanel
                                                 ({ source: "avatar" })
                                                          │
                                                          ▼
                                                spec 005 AIChatPanel opens
                                                at last scroll position
```

| Component | Path | Description |
| --- | --- | --- |
| `PAAvatar` | `src/ui/components/pa/PAAvatar.tsx` | PA avatar in the sidebar — wraps spec 007 `AvatarDisplay size={64}` with a status-badge overlay (`idle`, `monitoring`, `responding`, etc.) and an unread notification dot. **Click → dispatches `OpenAIChatPanel({ source: "avatar" })`.** |
| `PANotificationBubble` | `src/ui/components/pa/PANotificationBubble.tsx` | Compact floating card in the bottom-right corner — spec 007 avatar thumbnail (`size={24}`), first line of notification text, dismiss (×) button. **Click (not ×) → dispatches `OpenAIChatPanel({ source: "bubble", notificationId })`.** Up to 3 bubbles stack vertically; each auto-dismisses after `paconfigs.bubbletimeoutms`. |
| `PANotificationBubbleStack` | `src/ui/components/pa/PANotificationBubbleStack.tsx` | Container managing the queue of up to 3 simultaneous `PANotificationBubble` instances — handles stacking order, animation, and the overflow indicator ("+ 2 more") when more than 3 are pending. |
| `PAMessageBubble` | `src/ui/components/pa/PAMessageBubble.tsx` | Single message row used inside spec 005's `AIChatPanel` and inside the PA channel feed — renders text, structured cards (`PADashboardCard`, `PAScheduleCard`), download links, and tool-call indicators. |
| `PADashboardCard` | `src/ui/components/pa/PADashboardCard.tsx` | Inline card showing pending message counts by channel, project items due, next calendar event. |
| `PAScheduleCard` | `src/ui/components/pa/PAScheduleCard.tsx` | Inline day/week/month schedule rendered wherever the PA posts. |

> The full chat surface (`AIChatPanel`, message thread, session sidebar) is OWNED BY SPEC 005. Spec 002 components above are the *triggers* and the *content cards* embedded within the spec-005 surface.

### Settings and Configuration

| Component | Path | Description |
| --- | --- | --- |
| `PASetupWizard` | `src/ui/components/pa/PASetupWizard.tsx` | First-time setup — name, avatar, choose AI provider, connect calendar/email, set briefing time |
| `PAProviderManager` | `src/ui/components/pa/PAProviderManager.tsx` | List, add, edit, test, and delete AI providers; set active provider |
| `PANotificationSettings` | `src/ui/components/pa/PANotificationSettings.tsx` | Configure per-type notification thresholds and briefing time |
| `PACalendarSettings` | `src/ui/components/pa/PACalendarSettings.tsx` | Connect/disconnect calendar accounts, view binding status |
| `PAEmailSettings` | `src/ui/components/pa/PAEmailSettings.tsx` | Connect/disconnect email, configure VIP senders and keywords |

### Notifications and Dashboard

| Component | Path | Description |
| --- | --- | --- |
| `PANotificationFeed` | `src/ui/components/pa/PANotificationFeed.tsx` | Scrollable list of PA-generated notifications — briefings, alerts, reminders — with read/unread state |
| `PAPendingSummary` | `src/ui/components/pa/PAPendingSummary.tsx` | Compact widget showing total pending messages, next meeting, and overdue item count — lives in the main sidebar |

### Community Skill UI

| Component | Path | Description |
| --- | --- | --- |
| `CommunitySkillBrowser` | `src/ui/components/pa/CommunitySkillBrowser.tsx` | Full-page catalog view — category filter sidebar, skill cards sorted by installs or newest, search bar |
| `CommunitySkillCard` | `src/ui/components/pa/CommunitySkillCard.tsx` | Single catalog card — skill name, author avatar, category badge, install count, version, one-line description, Install button |
| `CommunitySkillDetail` | `src/ui/components/pa/CommunitySkillDetail.tsx` | Expanded skill view — full description, JSON schema, version history list, author profile, Install / Already installed badge |
| `SkillPublishFlow` | `src/ui/components/pa/SkillPublishFlow.tsx` | Step-by-step publish wizard — select category, review auto-generated description, preview how it appears in the catalog, confirm publish |
| `SkillUpdatePromptCard` | `src/ui/components/pa/SkillUpdatePromptCard.tsx` | Inline PA channel card rendered when a subscribed community skill is updated — shows version delta (old → new), change summary, Yes / No / Show Diff action buttons |
| `SkillDiffView` | `src/ui/components/pa/SkillDiffView.tsx` | Side-by-side or unified diff of JSON input schema between two versions — rendered inline in the PA channel when user requests diff |
| `CommunitySkillVersionHistory` | `src/ui/components/pa/CommunitySkillVersionHistory.tsx` | Expandable timeline of all published versions for a skill — each entry shows version, date, change summary, and a link to view the diff |

### MCP Server UI

| Component | Path | Description |
| --- | --- | --- |
| `MCPServerManager` | `src/ui/components/pa/MCPServerManager.tsx` | Full settings panel — list of registered servers with status badges, Add Server button, per-server connect/disconnect/delete controls |
| `MCPServerCard` | `src/ui/components/pa/MCPServerCard.tsx` | Single server row — name, transport badge (`stdio` / `http` / `sse`), connection status dot, tool count, last connected time, expand to show tool list |
| `MCPServerStatusBadge` | `src/ui/components/pa/MCPServerStatusBadge.tsx` | Inline status indicator: `connected` (green), `offline` (amber with reconnect button), `error` (red with error tooltip) |
| `MCPToolList` | `src/ui/components/pa/MCPToolList.tsx` | Expandable list of tools/resources discovered from one server — name, description, input schema peek; collapsible per server in `MCPServerCard` |
| `MCPAddServerForm` | `src/ui/components/pa/MCPAddServerForm.tsx` | Form to register a new MCP server — transport type selector, conditional fields (command for stdio, URL for http/sse), optional auth headers, test connection button |
| `MCPOfflineNotificationCard` | `src/ui/components/pa/MCPOfflineNotificationCard.tsx` | Rendered in the PA channel when an MCP server goes offline — server name, error, Reconnect Now button, link to MCPServerManager |

---

### Setup Guidance UI

| Component | Path | Description |
| --- | --- | --- |
| `SetupGuideCard` | `src/ui/components/pa/SetupGuideCard.tsx` | Rendered in the PA channel when setup guidance is triggered — shows provider logo, connection type badge, numbered step list, and a progress indicator (Step 3 of 7). Each step has a title, plain-English instruction, and a clickable external URL button where applicable. |
| `SetupStep` | `src/ui/components/pa/SetupStep.tsx` | Single step row inside `SetupGuideCard` — step number circle, instruction text, optional "Open this page" link button, checkbox to mark complete. Checking the checkbox advances `pasetupprogress.laststepnumber`. |
| `SecureInputPrompt` | `src/ui/components/pa/SecureInputPrompt.tsx` | Rendered when a step requires a secret value (API key, client secret). Shows a masked password-style input field separate from the chat — value is POST'd directly to the binding API, never exposed in the PA channel message history. |
| `SetupResumeCard` | `src/ui/components/pa/SetupResumeCard.tsx` | Shown at the top of a PA channel conversation when the user has an incomplete guide in progress — "You were setting up Google Calendar and got to Step 4. Continue?" with Resume and Start Over buttons. |
| `OAuthConsentRedirect` | `src/ui/components/pa/OAuthConsentRedirect.tsx` | Modal shown when an OAuth flow requires the user to visit the provider's consent screen — "You'll be taken to Google to approve access. YappChat will complete the setup when you return." with a countdown and the redirect URL clearly displayed. |

## Success Criteria

1. PA morning briefing is delivered at the configured time with accurate counts from live sources — no manual trigger required.
2. A user can switch AI providers (e.g., from Claude to a local Ollama model) and have the next PA response generated by the new provider — no restart, under 5 seconds to switch.
3. Calendar queries ("Show me my week") return accurate schedule data within 3 seconds.
4. A new skill created through PA conversation is registered and invocable by the PA within the same session.
5. A presentation created via PA conversation is generated and delivered as a downloadable file within 60 seconds of user approval.
6. Pending message counts displayed by the PA match the actual unread counts in spec 001's `messages` table.
7. The PA's AI provider is never called with more context than the last 20 turns — token cost is bounded.
8. A skill published to Community Skills is discoverable by other users within 30 seconds of publishing.
9. When a community skill is updated, every subscriber receives a PA channel notification with the change summary within 60 seconds of the author publishing the update.
10. A user who installs a community skill can invoke it immediately — no restart, no manual configuration required.
11. A non-technical user who types "how do I connect my Google Calendar?" receives a complete numbered setup guide in the PA channel within 2 seconds, with progress tracked so they can resume from where they left off across sessions.
12. Tools from all connected MCP servers appear in the PA's tool list and are invokable within the same conversation turn as registered skills. Adding a new MCP server makes its tools available without restarting the PA.

---

## Key Entities

| Entity | Location | Description |
| --- | --- | --- |
| `PAConfig` | `paconfigs` | User's PA configuration — active provider, avatar, monitoring prefs. One per user. |
| `AIProvider` | `aiproviders` | A registered AI backend. Type-agnostic — OpenAI-compatible, Anthropic, Ollama, or custom. |
| `CalendarBinding` | `pacalendarbindings` | OAuth connection to a calendar service. Used by the schedule view and monitoring loop. |
| `EmailBinding` | `paemailbindings` | OAuth connection to an email account. Used for VIP notifications and draft replies. |
| `PANotification` | `panotifications` | A single PA-generated alert — morning briefing, pending message spike, calendar reminder, project overdue. |
| `AssistantSession` | `assistantsessions` | One named multi-turn chat session. A user has many. Backs spec 005 AI Chat sidebar. |
| `AssistantMessage` | `assistantmessages` | One turn within a session — user, assistant, or tool result. E2E-encrypted by default. |
| `SkillInvocation` | `skillinvocations` | One skill HTTP call — drives spec 004 stats. |
| `SubagentExecution` | `subagentexecutions` | One subagent spawn — status, result, parent session. |
| `MCPServer` | `mcpservers` | A registered MCP server — transport type, connection command or URL, status. One connection maintained per enabled server. |
| `MCPToolDiscovery` | `mcptooldiscovery` | Cached tools, resources, and prompts from one MCP server. Refreshed on connect and on-demand. Merged with registered skills as the unified PA tool list. |
| `SetupGuide` | `setupguides` | Versioned step-by-step setup instructions for one provider or integration. Served by the PA when users ask how to connect a service. |

---

## Constraints

- The PA MUST NOT be locked to any specific AI provider. The `aiproviders` table and provider adapter layer MUST support any compliant AI backend.
- When a provider does not support tool-use (`supportstooluse: false`), the PA MUST still function — it falls back to text-based tool selection, with degraded response speed. This is not an error.
- The PA MUST NOT send email or create calendar events without explicit user confirmation within the conversation — always show the proposed action and wait for approval.
- The PA channel uses spec 001 encryption and retention rules — no exceptions for PA messages.
- `assistantmessages` follow the same E2E rules as spec 001 `messages` — server stores ciphertext only for `encryptiontype: "e2e"`. The 20-turn context window sent to the AI provider is assembled CLIENT-SIDE (the browser decrypts then forwards plaintext to the configured provider) — the server never sees the plaintext for E2E sessions.
- Skill creation via the PA writes to the `skills` table (managed by spec 004) — the PA does not maintain a separate skill store.
- Skill invocation runtime (FR-014) and subagent runtime (FR-015) are owned by this spec — spec 004 explicitly excludes them. No other scope may invoke a skill handler directly.
- The PA does NOT store its own display name or avatar URL. Both are resolved at runtime from spec 007 `GET /api/avatar/current`. `paconfigs` carries only behavioural config (provider, briefing time, monitoring interval, notification prefs).
- The full-screen / slide-in chat surface is owned by spec 005 (`AIChatPanel`). Spec 002 owns the trigger contract (`OpenAIChatPanel`) but does NOT define the panel UI — `PAFullChatView` is no longer used in this spec.
- Project items sourced from the wxKanban MCP server are read-only in this scope — the PA can surface them but not modify task status.
- The AI provider's API key is stored as a reference to a secrets store entry — never persisted in plaintext in `aiproviders.apikeyref`.
- MCP server auth headers (API keys) are stored as secret references in `mcpservers.headersref` — never in plaintext. stdio MCP servers run as subprocesses with the same OS user as the PA service — deployment must ensure the PA process has no more permissions than needed.
- MCP tool names MUST be unique across all sources (registered skills + all MCP servers) in the merged tool list. On conflict, MCP tools take precedence and a warning is logged. The PA MUST surface name conflicts in `MCPServerManager` so admins can rename the conflicting skill.
- The `@modelcontextprotocol/sdk` package is already present in the YappChat `mcp-server` workspace package — reuse it from the workspace rather than installing a separate copy.

---

## Notes

### Integration with Spec 001

- PA is registered as an agent via spec 001 `POST /api/engine/agents` (FR-010).
- All PA messages flow through spec 001's internal `yappchat-agent` channel — encryption, retention, and message history apply automatically.
- Pending message counts read from spec 001 `messages` and `conversations` tables.

### Integration with Spec 004

- `skills` table is created and owned by spec 004.
- PA reads skills for invocation (FR-006 here) and writes new skill definitions via `POST /api/pa/skills/register` which delegates to spec 004's creation API.

### Integration with Spec 006

- Content creation (presentations, documents) calls spec 006 Document Generation API.
- The PA handles the conversational UX (outline review, iteration); spec 006 handles file production.

### AI Provider Adapter Pattern

All providers are normalised through a single internal adapter interface:

```
interface PAProviderAdapter {
  chat(messages: Message[], tools?: Tool[]): AsyncIterable<Delta>
  selectTool(messages: Message[], tools: Tool[]): Promise<ToolCall | null>  // fallback for non-tool providers
}
```

Adapter implementations:
- `OpenAICompatibleAdapter` — covers OpenAI, Ollama, LM Studio, Groq, vLLM, any `/v1/chat/completions` endpoint
- `AnthropicAdapter` — uses `@anthropic-ai/sdk`, maps tool-use to the above interface
- `CustomAdapter` — user provides a request/response transformer function

### OAuth and API Connection Libraries — Evaluated Options

The following open-source libraries were evaluated for handling OAuth 2.0 flows, token management, and provider connections. One of these MUST be chosen before implementation begins.

#### Option A — Better Auth + Custom React UI (Recommended)

| What | Package | License | Notes |
| --- | --- | --- | --- |
| Backend auth + OAuth | `better-auth` | MIT | 30+ built-in providers (Google, Microsoft, Discord, Slack…); auto token refresh; type-safe; framework-agnostic; works with Express |
| Extra providers | `better-auth` generic OAuth plugin | MIT | Covers any OAuth 2.0 provider not in the built-in list |
| React client | `better-auth/client` | MIT | Type-safe hooks for binding status, session state |

**Pros**: Single dependency, 30+ providers out of the box, fully self-hosted, MIT, token refresh handled automatically, type-safe throughout.
**Cons**: 30-provider ceiling without the generic plugin; larger footprint than arctic.

#### Option B — Arctic + Custom Token Management (Lightweight)

| What | Package | License | Notes |
| --- | --- | --- | --- |
| OAuth flows | `arctic` | MIT | 50+ providers (Google, Microsoft, GitHub, Discord…); PKCE; token refresh; no dependencies; Web Fetch API |
| JWT / sessions | `jose` | MIT | JWT signing/verification for stored tokens |
| React UI | Custom components + `@react-oauth/google` for Google | MIT | Build per-provider; more work but maximum control |

**Pros**: Minimal footprint, true zero-dependency per provider, runtime-agnostic (works on Node, edge, Bun).
**Cons**: More manual wiring for refresh token scheduling and secure storage; no built-in UI.

#### Option C — Nango Self-Hosted (If providers exceed 30)

| What | Package | License | Notes |
| --- | --- | --- | --- |
| OAuth platform | Nango (self-hosted Docker) | Elastic License 2.0 | 700+ providers; white-label Connect UI; REST API for token retrieval; token refresh managed |

**Pros**: 700+ providers without writing any OAuth logic; includes embeddable white-label "Connect" UI that handles the full setup flow including redirects and consent screens.
**Cons**: Elastic License (check for commercial use); additional service to deploy and maintain; free tier excludes sync/webhooks.

#### Decision gate (before implementation)

- If provider count ≤ 30 and team prefers minimal dependencies → **Option A (Better Auth)**
- If edge/serverless runtimes are required or footprint matters → **Option B (Arctic)**
- If provider count > 30 or white-label connect UI is a priority → **Option C (Nango)**

The chosen library determines how `pacalendarbindings.tokenref` and `paemailbindings.tokenref` are managed — token storage and refresh must be consistent across all providers.

### Risks

- **Monitoring loop reliability**: if the monitoring loop crashes, the user stops receiving notifications silently. The loop must be supervised with automatic restart and a dead-man alert after 2 missed cycles.
- **Calendar/email OAuth token expiry**: long-lived OAuth tokens expire. The binding must detect `401` responses and notify the user to re-authenticate rather than silently stopping notifications.
- **Context window overflow**: the 20-turn rolling window may still exceed a small local model's context limit. The adapter must detect context-too-long errors and automatically truncate to the last 10 turns with a user notice.
- **Skill creation quality**: skills created via PA conversation depend on the AI provider's ability to generate accurate JSON schemas. Low-capability models may produce invalid schemas — the PA must validate before registering and surface errors to the user for correction.

---

## Clarifications

### Session 2026-05-10

| # | Question | Decision |
| --- | --- | --- |
| 1 | Is the PA tied to Claude specifically? | No — any registered AI provider. Claude, GPT-4, Gemini, Ollama, custom — all supported via the provider adapter layer. |
| 2 | Is the PA reactive or proactive? | Both — proactive monitoring loop posts notifications; users can also chat with it interactively. |
| 3 | Does the PA have a visual avatar? | Yes — registered as a spec 001 agent with avatar, name, and status badge. |
| 4 | Can the PA create skills? | Yes — through conversation, with user approval before registration. |
| 5 | Can the PA send emails? | Draft and propose only — never sends without explicit user confirmation per message. |
| 6 | Where does presentation generation happen? | Spec 006 handles file production; this spec handles the conversational UX around it. |
| 7 | What project system does the PA read? | wxKanban MCP server (`projecttasks` table) — read-only in this scope. |
| 8 | One PA session per user, or many named sessions? | Many. The single rolling-window `pasessions` model is dropped; replaced by `assistantsessions` + `assistantmessages` (FR-008) so spec 005's named-session sidebar has real persistence. |
| 9 | Does spec 002 own the chat panel UI? | No. Spec 005 owns `AIChatPanel`. Spec 002 owns the trigger contract (`OpenAIChatPanel` action), the proactive PA channel, the avatar/notification bubbles, and the content cards. `PAFullChatView` is removed. |
| 10 | Does spec 002 store the PA's name/avatar? | No. Both are resolved at runtime from spec 007 `GET /api/avatar/current`. `paconfigs` carries only behavioural config. |
| 11 | Where does skill execution actually happen? | Here. FR-014 defines the runtime; spec 004 is design/test only. The skill-handler HTTP call, retries, validation, and audit row in `skillinvocations` all live in spec 002. |
| 12 | Where does subagent execution happen? | Here. FR-015 defines the worker model; `subagentexecutions` rows are owned by this spec and consumed by spec 004 stats. |
| 13 | Does each binding (calendar, email, MCP) have its own callback? | No. FR-016 introduces a shared `/api/integrations/oauth/callback/:provider` with signed `state` carrying the binding type. |
