# Spec 005: AI Chat

**Spec Number**: 005
**Status**: `draft`
**Created**: 2026-05-10
**Depends On**: Spec 002 (Personal Assistant), Spec 003 (WebSocket Engine)
**Source**: `specs/Project-Scope/005-ai-chat-interface-allowing-users.md`

---

## Overview

The AI Chat is a **slide-in panel** that opens whenever a user clicks the PA avatar or a PA notification bubble. It is not a dedicated page — it overlays the existing YappChat view.

**Desktop**: the panel occupies the right **1/3 of the screen** (approximately 33% viewport width). The rest of the application remains visible and interactive behind it. The panel slides in from the right edge.

**Mobile**: the panel expands to **full screen**, covering the full viewport.

This scope is **entirely UI**. The intelligence, session storage, skill invocation, and subagent management all live in spec 002. Spec 005 owns the visual surface: how messages look, how responses stream in, how sessions are managed, how skill results are rendered, and how the user composes and sends messages.

**Entry points** — the only two ways to open the AI Chat panel. Both are dispatched as the `OpenAIChatPanel` action contract owned by spec 002 FR-001:

- **PA notification bubble click** — fires `OpenAIChatPanel({ source: "bubble", notificationId })`. The panel opens scrolled to and highlighting the linked message
- **PA avatar click** — fires `OpenAIChatPanel({ source: "avatar" })`. The panel opens at the most recent conversation position

Spec 002 emits the action; spec 005 (this spec) subscribes to it and owns the open animation, the panel surface, and the scroll-restoration behaviour. There is NO direct coupling between spec 002 components and spec 005 components beyond this typed action.

Clicking outside the panel (desktop) or pressing Back (mobile) closes it without losing state — the session resumes exactly where it was left when reopened.

---

## Core Design

| Element | Value |
| --- | --- |
| **Primary Actor** | YappChat end user |
| **Secondary Actors** | Personal Assistant (spec 002 backend), skill execution results |
| **Key Value** | A clean, dedicated AI chat experience where users can have long, structured conversations with the PA, see skill results rendered richly, manage multiple named sessions, and use voice input — without any of the noise of the broader YappChat feed. |
| **Scope Boundary** | IN SCOPE: right-1/3 slide-in panel (desktop); full-screen overlay (mobile); open/close animation triggered by PA avatar or notification bubble click; session list within the panel; multi-session management (create, rename, delete, search); streaming SSE message rendering; markdown and code block rendering; structured skill result cards; tool-call indicator animations; voice input (browser Speech API); file attachment upload; keyboard shortcuts; suggested follow-up chips. OUT OF SCOPE: dedicated `/chat` route or full-screen desktop mode; PA backend session logic (spec 002); skill invocation engine (spec 002); subagent management (spec 002); PA notification bubbles (spec 002); AI Avatar rendering (spec 007); PA proactive monitoring (spec 002). |

---

## User Scenarios & Testing

### US1 — User has a multi-turn AI conversation with skill invocation

**Actor**: YappChat end user

**Scenario**:

1. User clicks the PA avatar in the YappChat sidebar. The `AIChatPanel` slides in from the right, occupying the right 1/3 of the screen. The rest of YappChat remains visible on the left. The most recent session is active.
2. User types: "Summarise what happened in the #engineering Slack channel this week." and presses Cmd+Enter.
3. The message appears in the thread right-aligned. A `StreamingIndicator` appears below it. The PA's response tokens begin streaming in left-aligned with the PA avatar.
4. Midway through the response, a `ToolCallCard` appears inline: "Fetching messages from Slack #engineering…" with a spinner. When the skill returns, the card collapses to show "Fetched 47 messages."
5. The full summary renders in the thread with markdown formatting — bullet points, bold section headers. Streaming ends.
6. User follows up: "Turn that into a slide outline." The PA responds with a numbered outline, streaming again.
7. User types: "Generate the full presentation." PA acknowledges and spawns a subagent — a `SubagentCard` appears with the subagent's avatar and "Working…" status.

**Expected outcome**: All turns render within 3 seconds of sending. Streaming tokens appear immediately. Skill calls are visible inline with clear status. The session retains full context across all turns.

### US2 — User manages multiple named sessions

**Actor**: YappChat end user

**Scenario**:

1. User has three sessions in the sidebar: "Q2 report prep", "Engineering standup notes", "Personal tasks". The active session is "Q2 report prep".
2. User clicks **New session** — a session named "New conversation" is created and becomes active. The thread clears.
3. User renames it: double-clicks the session name in the sidebar, types "Board presentation May", presses Enter.
4. User searches for "standup" in the session search box — "Engineering standup notes" is highlighted.
5. User clicks it — the full conversation history for that session loads instantly from spec 002's `assistantmessages` table.
6. User deletes the "Personal tasks" session — a confirmation dialog appears ("Delete this session? This cannot be undone."). User confirms.

**Expected outcome**: Sessions create, rename, search, switch, and delete cleanly. Switching sessions loads full history within 1 second.

### US3 — User sends a voice message

**Actor**: YappChat end user

**Scenario**:

1. User clicks the microphone icon in the chat input area. Browser requests microphone permission if not yet granted.
2. User speaks: "What meetings do I have tomorrow?" The browser's Speech Recognition API transcribes in real time — the text appears in the input field as the user speaks.
3. User stops speaking. After 1.5 seconds of silence, the transcription finalises and the message is automatically sent (configurable: auto-send or wait for confirm).
4. The PA responds with tomorrow's schedule from the connected calendar.

**Expected outcome**: Voice input transcribes and sends without the user touching the keyboard.

### US4 — User attaches a file for PA analysis

**Actor**: YappChat end user

**Scenario**:

1. User clicks the attachment icon and selects a PDF — "Q1-financial-report.pdf".
2. The file is uploaded and a `FileAttachmentChip` appears in the input area showing the file name and size.
3. User types: "Summarise the key highlights from this report" and sends.
4. The PA receives the message with the attached file reference, processes it, and returns a structured summary.
5. The file attachment is shown as a chip in the user's sent message in the thread.

**Expected outcome**: File uploads within 5 seconds for PDFs up to 10MB. The PA acknowledges and processes the attachment in the same turn.

### US5 — User asks to create a skill or agent from the AI Chat panel

**Actor**: YappChat end user

**Scenario**:

1. User is chatting with the PA in the 1/3-width `AIChatPanel`. They type: "Create a skill that fetches my latest GitHub PRs."
2. The PA detects the creation intent and responds with a `StudioHandoffCard`: "That sounds like a new skill — want me to open the Skill Builder? I'll pass along what you just told me." with two buttons: **Open Skill Builder** and **Keep chatting**.
3. User clicks **Open Skill Builder**. The `AIChatPanel` expands to full-screen (or the Studio opens as a full-screen overlay), covering the entire viewport — exactly the same layout as spec 004.
4. The Studio Assistant (Archie) is already waiting with the user's description pre-filled: "Create a skill that fetches my latest GitHub PRs." Archie has already run the community similarity search and presents results (or "let's build from scratch" if none found) — exactly per spec 004 FR-010.
5. The user completes skill creation through the full Studio experience (spec 004 FRs apply in full).
6. When the user clicks **Done** or closes the Studio (Escape or a close button in the top-right), the full-screen Studio collapses back to the 1/3-width `AIChatPanel`. A confirmation message from the PA appears in the thread: "Skill `get_github_prs` has been created and is ready to use."

**Expected outcome**: Creation intent in the AI Chat seamlessly hands off to the full Studio. The user's description is not re-typed. When done, they are back in the AI Chat context with the result confirmed.

---

## Functional Requirements

### FR-001 — AI Chat panel layout

The AI Chat is a **slide-in panel**, not a dedicated page. It opens over the existing YappChat view when triggered and closes without navigating away.

**Desktop layout** (≥ 768px):

```text
┌────────────────────────────────┬──────────────────────┐
│                                │  Session sidebar      │
│   YappChat main view           │  (collapsible, ~80px) │
│   (still visible & usable)     ├──────────────────────┤
│                                │  Message thread       │
│                                │                       │
│                                │  (scrollable)         │
│                                ├──────────────────────┤
│                                │  Input area           │
└────────────────────────────────┴──────────────────────┘
         ~67% of viewport                ~33%
```

**Mobile layout** (< 768px):

```text
┌──────────────────────────────────┐
│  Full-screen AI Chat panel       │
│  (covers entire viewport)        │
│                                  │
│  Back button top-left returns    │
│  to underlying YappChat view     │
└──────────────────────────────────┘
```

**Acceptance Criteria**:

- [ ] `AIChatPanel` renders as a fixed-position overlay anchored to the right edge of the viewport — `position: fixed; right: 0; top: 0; height: 100vh; width: 33vw` (desktop)
- [ ] On mobile (< 768px): panel width is `100vw`, covering the full screen
- [ ] Panel opens with a slide-in animation from the right (200ms ease-out). Closes with a slide-out animation to the right.
- [ ] Panel is triggered **only** by clicking the PA avatar or a PA notification bubble — there is no standalone `/chat` route
- [ ] Desktop: clicking outside the panel (on the underlying YappChat view) closes it. The underlying view remains interactive and receives clicks normally.
- [ ] Mobile: the panel includes a Back button (top-left) that closes it and returns to the underlying view
- [ ] Panel state is preserved across open/close cycles — scroll position, active session, and partial draft input are retained when the panel is closed and reopened
- [ ] The panel contains two sub-areas stacked vertically: a **session sidebar strip** (collapsible, ~80px wide when collapsed showing session avatars/icons, ~220px when expanded) on the left of the panel, and the **conversation area** (thread + input) taking the remaining width
- [ ] On first open with no sessions: empty state with PA avatar, name, and "What can I help you with?" prompt centred in the conversation area

### FR-002 — Session management

The AI Chat MUST support multiple named sessions that persist across page loads and device switches.

**Acceptance Criteria**:

- [ ] `GET /api/pa/sessions` (spec 002 API) populates the session list on load
- [ ] **New session**: a **+ New** button at the top of the sidebar creates a session via `POST /api/pa/sessions`. New session name defaults to the date/time ("May 10, 4:32pm"). Session becomes active immediately
- [ ] **Rename**: double-clicking any session name in the sidebar makes it editable inline. Enter or blur saves via `PATCH /api/pa/sessions/:id`
- [ ] **Delete**: right-click or swipe-left on a session shows a **Delete** action. Confirmation dialog required. `DELETE /api/pa/sessions/:id`
- [ ] **Search**: text input at the top of the sidebar filters sessions by name and last message content in real time (client-side filter from loaded sessions list)
- [ ] **Switch**: clicking a session in the sidebar loads its full message history from `GET /api/pa/sessions/:id/messages` — cursor-based, matching spec 002 FR-001 pagination. History loads within 1 second.
- [ ] Session list shows: session name, last message preview (truncated to 60 chars), relative timestamp ("3 hours ago")

### FR-003 — Streaming message rendering

Responses from the PA MUST stream token-by-token into the chat thread. The user sees words appearing in real time rather than waiting for the full response.

**Acceptance Criteria**:

- [ ] `POST /api/pa/sessions/:id/messages` is called with `Accept: text/event-stream`. The response is an SSE stream of token deltas
- [ ] Each SSE delta is appended to the streaming bubble in real time — the bubble grows as tokens arrive
- [ ] While streaming, a `StreamingCursor` (blinking caret) is visible at the end of the last token
- [ ] If the stream is interrupted (network error), the partial response is displayed with a "Response interrupted — retry?" action button
- [ ] Streaming is visually smooth — no layout thrash or scroll jump as the bubble grows. The thread auto-scrolls to keep the streaming bubble in view unless the user has manually scrolled up
- [ ] After streaming ends, markdown is re-rendered in full (code blocks, tables, bold/italic) — the streaming phase renders plain text for performance, the final render applies full markdown

### FR-004 — Rich content rendering

The AI Chat MUST render the full range of PA response types — not just plain text.

**Acceptance Criteria**:

- [ ] **Markdown**: headings, bold, italic, bullet/numbered lists, blockquotes, horizontal rules — rendered via a markdown library (e.g., `react-markdown`)
- [ ] **Code blocks**: syntax-highlighted via `highlight.js` or `prism`. Language label shown in the block header. Copy-to-clipboard button in the top-right of every code block.
- [ ] **Inline code**: rendered in a monospace font with a subtle background
- [ ] **Tables**: rendered as HTML tables with a horizontal scroll wrapper for wide tables
- [ ] **ToolCallCard**: inline card shown when the PA invokes a skill — shows skill label, spinner while running, collapses to a one-line summary on completion (e.g., "Fetched 47 messages from Slack #engineering")
- [ ] **SubagentCard**: inline card when the PA spawns a subagent — shows subagent avatar, name, current status (`working` / `waiting_for_input` / `completed`), and a link to the agent's channel
- [ ] **SkillResultCard**: when a skill returns a structured result (JSON with a known schema), renders it as a formatted card rather than raw JSON — e.g., a calendar event, a Jira ticket, a file download link
- [ ] **DashboardCard** and **ScheduleCard** from spec 002 are rendered inline when the PA returns those payloads
- [ ] **FileAttachmentChip**: files attached to user messages are shown as a chip with file icon, name, and size

### FR-005 — Message input and composition

The chat input area MUST support plain text, file attachments, voice input, and keyboard shortcuts.

**Acceptance Criteria**:

- [ ] Multi-line text input (auto-expands up to 6 lines, then scrolls). Shift+Enter for new line, Enter to send (configurable to reverse)
- [ ] **Send** button active only when input is non-empty or a file is attached
- [ ] **Cmd+Enter** (Mac) / **Ctrl+Enter** (Windows) always sends regardless of Enter key mode
- [ ] **File attachment**: paperclip icon opens file picker. Accepted: PDF, DOCX, XLSX, PNG, JPG, TXT. Max 10MB per file, max 5 files per message. Uploaded via `POST /api/chat/attachments` — returns an `attachmentid` included in the message payload
- [ ] **Voice input**: microphone icon triggers `SpeechRecognition` API (Chrome/Edge). Transcription renders in real time in the input field. Auto-send after 1.5s of silence is configurable in user settings (default: off — user must press Send)
- [ ] **Suggested follow-ups**: after each PA response, up to 3 `SuggestedReplyChip` items appear below the response — generated by the PA alongside its reply. Clicking one fills and immediately sends that message
- [ ] Character limit: 4,000 characters per message. Counter shown when within 500 chars of limit
- [ ] Input is disabled while the PA is streaming a response — a "Stop generating" button appears in its place. Clicking it aborts the SSE stream and delivers the partial response

### FR-006 — Keyboard shortcuts

The AI Chat MUST be fully keyboard-navigable with discoverable shortcuts.

**Acceptance Criteria**:

- [ ] **Cmd/Ctrl + K**: create a new session
- [ ] **Cmd/Ctrl + Shift + K**: open session search / session switcher
- [ ] **Cmd/Ctrl + Enter**: send message
- [ ] **Escape**: cancel editing a session name / dismiss any open dialogs
- [ ] **/** at the start of input: opens a command palette with quick actions (e.g., `/new`, `/clear`, `/export`)
- [ ] **?** key (when input is empty and focused): shows a keyboard shortcut reference overlay `KeyboardShortcutsOverlay`
- [ ] All shortcuts are shown in tooltips on hover of the relevant buttons

### FR-007 — Session export

Users MUST be able to export a conversation as a readable file.

**Acceptance Criteria**:

- [ ] Session overflow menu (⋯ in the sidebar) includes **Export** → `{ format: "markdown" | "pdf" | "txt" }`
- [ ] `GET /api/pa/sessions/:id/export?format=markdown` returns the full session as a Markdown document with timestamps, role labels, and inline skill call summaries
- [ ] PDF export renders the same content as the markdown export via a headless renderer — delivered as a downloadable file
- [ ] Exported file is named: `{session-name}-{YYYY-MM-DD}.{ext}`

### FR-008 — Studio handoff for agent and skill creation

When the user expresses a creation intent (new skill or agent) in the AI Chat, the panel MUST detect it, present a handoff prompt, and — if confirmed — expand to full-screen and open the spec 004 Studio with the user's description pre-loaded into Archie.

**Intent detection** — the PA backend (spec 002) is responsible for recognising creation intents. When it does, it returns a response with `actiontype: "studio_handoff"` alongside the reply text and a `handoffpayload`:

```json
{
  "actiontype": "studio_handoff",
  "handoffpayload": {
    "type": "skill",
    "description": "Create a skill that fetches my latest GitHub PRs"
  }
}
```

**Acceptance Criteria**:

- [ ] When the PA response includes `actiontype: "studio_handoff"`, the `AIChatPanel` renders a `StudioHandoffCard` below the PA's response message. The card shows the detected type ("skill" or "agent"), the description that will be passed, and two buttons: **Open Skill Builder** / **Open Agent Builder** and **Keep chatting**
- [ ] Clicking **Keep chatting** dismisses the card and the conversation continues normally in the panel
- [ ] Clicking **Open Skill Builder** or **Open Agent Builder**:
  - The `AIChatPanel` transitions to full-screen (animation: panel expands from 33vw to 100vw over 250ms)
  - The full Studio layout (spec 004) renders inside the now-full-screen panel — `SkillStudio` or `AgentStudio` depending on `handoffpayload.type`
  - The Studio Assistant (Archie) is initialised with `handoffpayload.description` as if the user had typed it into Archie's input — the community similarity search fires immediately
  - All spec 004 FRs apply in full while the Studio is active
- [ ] The full-screen Studio shows a **← Back to chat** button in the top-left. Clicking it (or pressing Escape) collapses back to 33vw panel with a reverse animation
- [ ] On **Back to chat** after a skill/agent was saved: the PA sends a confirmation message into the session thread: "Skill `{name}` has been created and is available to use." or "Agent template `{name}` is ready." The session context is preserved exactly as it was before the Studio opened
- [ ] On **Back to chat** after cancelling without saving: no message is added to the thread; the panel simply resumes
- [ ] The Escape shortcut (FR-006) now also collapses the Studio back to the panel when the Studio is active — it does NOT close the entire panel

---

## Data Requirements

Spec 005 is a UI layer. All session and message data lives in spec 002's `assistantsessions` and `assistantmessages` tables (defined in spec 002 FR-008). Only two new tables are owned here — file attachments and per-user UI preferences.

| Table | Purpose |
| --- | --- |
| `chatattachments` | Files uploaded for PA analysis — reference attached to the message, retained for the session lifetime |
| `userchatpreferences` | Per-user UI preferences — Enter key mode, voice auto-send, compact/spacious layout |

### `chatattachments`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `userid` | text | Uploader |
| `sessionid` | uuid | FK → spec 002 `assistantsessions.id` |
| `messageid` | uuid | Nullable FK → spec 002 `assistantmessages.id` — set when the message is sent. Spec 002 `assistantmessages.attachmentids` carries the reverse reference as a uuid array |
| `filename` | text | Original filename |
| `mimetype` | text | e.g., `application/pdf`, `image/png` |
| `sizebytes` | integer | |
| `storagekey` | text | Internal storage path/key (never exposed as a public URL) |
| `createdat` | timestamptz | |
| `expiresat` | timestamptz | Set to session retention expiry — purged when the parent session is hard-deleted (30 days after `assistantsessions.deletedat`) |

### `userchatpreferences`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `userid` | text | UNIQUE |
| `enterkeysends` | boolean | Default: true — Enter sends, Shift+Enter for new line |
| `voiceautosend` | boolean | Default: false — require explicit send after voice transcription |
| `layout` | text | `"spacious"` \| `"compact"` — message density |
| `updatedat` | timestamptz | |

---

## API Routes

Spec 005 delegates almost all calls to spec 002's `/api/pa/*` routes. Only two new routes are added.

### New routes (spec 005 only)

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/chat/attachments` | Upload a file for PA analysis — returns `{ attachmentid, filename, sizebytes }`. The `attachmentid` is included in the next `POST /api/pa/sessions/:id/messages` call as part of `attachmentids`. |
| GET | `/api/chat/attachments/:id` | Authenticated download of an uploaded attachment — never served via public URL. |
| GET | `/api/chat/preferences` | Get current user's chat UI preferences |
| PATCH | `/api/chat/preferences` | Update preferences — `{ enterkeysends, voiceautosend, layout }` |

> Session export (`GET /api/pa/sessions/:id/export`) is owned by spec 002 — not duplicated here.

### Delegated to Spec 002 (FR-008)

All session and message routes are owned by spec 002. Spec 005 calls them; it does not define them.

| Spec 002 route used | Purpose |
| --- | --- |
| `GET /api/pa/sessions` | Load session list (sorted by `lastmessageat DESC`) |
| `POST /api/pa/sessions` | Create new named session |
| `GET /api/pa/sessions/:id` | Session detail — provider label, message count |
| `PATCH /api/pa/sessions/:id` | Rename session |
| `DELETE /api/pa/sessions/:id` | Soft-delete session |
| `GET /api/pa/sessions/:id/messages` | Cursor-paginated history |
| `POST /api/pa/sessions/:id/messages` | Send user turn — SSE streamed reply with `tool_call_*` / `subagent_spawned` deltas |
| `GET /api/pa/sessions/:id/export` | Export session — implements FR-007 (PDF delegates to spec 006) |

---

## Frontend Components

### Panel Layout

| Component | Path | Description |
| --- | --- | --- |
| `AIChatPanel` | `src/ui/components/chat/AIChatPanel.tsx` | The root panel component. Fixed-position overlay anchored to the right edge of the viewport. **Desktop**: 33vw wide, full height. **Mobile**: full-screen. Manages open/close animation (slide-in/out from right), outside-click dismissal (desktop), and Back button (mobile). Preserves all internal state across open/close cycles. |
| `AIChatLayout` | `src/ui/components/chat/AIChatLayout.tsx` | Inner split: `ChatSessionStrip` on the left edge of the panel (80px collapsed, 220px expanded), `ChatMain` taking the remaining width. |
| `ChatSessionStrip` | `src/ui/components/chat/ChatSessionStrip.tsx` | Narrow left strip within the panel — collapsed: shows session icon/avatar stubs and a + button. Expanded: full `ChatSessionSidebar`. Toggles with a chevron button. |
| `ChatMain` | `src/ui/components/chat/ChatMain.tsx` | Conversation area — stacks `ChatMessageThread` above `ChatInputArea`. Shows `ChatEmptyState` when no messages exist. |

### Session Sidebar

| Component | Path | Description |
| --- | --- | --- |
| `ChatSessionSidebar` | `src/ui/components/chat/ChatSessionSidebar.tsx` | Left pane — New session button, search box, scrollable `ChatSessionList`. |
| `ChatSessionList` | `src/ui/components/chat/ChatSessionList.tsx` | Filtered/sorted list of `ChatSessionItem` rows. |
| `ChatSessionItem` | `src/ui/components/chat/ChatSessionItem.tsx` | Single session row — name (double-click to rename inline), last message preview, relative timestamp, active highlight, swipe/right-click to delete. |
| `ChatSessionSearch` | `src/ui/components/chat/ChatSessionSearch.tsx` | Live client-side filter input over the session list — highlights matched text. |

### Message Thread

| Component | Path | Description |
| --- | --- | --- |
| `ChatMessageThread` | `src/ui/components/chat/ChatMessageThread.tsx` | Virtualised scrollable message list. Auto-scrolls to bottom on new messages unless user has scrolled up. Renders `ChatMessage` per row. |
| `ChatMessage` | `src/ui/components/chat/ChatMessage.tsx` | Single message row — user messages right-aligned (no avatar), PA messages left-aligned with PA avatar. Routes content to the correct renderer. |
| `ChatMessageRenderer` | `src/ui/components/chat/ChatMessageRenderer.tsx` | Renders a PA message's content — plain streaming text (during stream), then full markdown (post-stream), inline cards. |
| `StreamingCursor` | `src/ui/components/chat/StreamingCursor.tsx` | Blinking caret appended to the last token during active streaming. Disappears when stream ends. |
| `ToolCallCard` | `src/ui/components/chat/ToolCallCard.tsx` | Inline skill invocation indicator — skill label + spinner → collapses to one-line summary on completion. Expandable to show raw input/output. |
| `SubagentCard` | `src/ui/components/chat/SubagentCard.tsx` | Inline subagent launch card — avatar, name, live status badge (`working` / `waiting_for_input` / `completed`), link to agent channel. |
| `SkillResultCard` | `src/ui/components/chat/SkillResultCard.tsx` | Renders a structured skill result as a formatted card rather than raw JSON — calendar event, Jira ticket, file download, etc. Card type is determined by a `resulttype` field in the skill response. |
| `FileAttachmentChip` | `src/ui/components/chat/FileAttachmentChip.tsx` | Compact chip in user messages showing attached file icon, name, size. Click downloads/previews the file. |
| `SuggestedReplyChip` | `src/ui/components/chat/SuggestedReplyChip.tsx` | One-click suggested follow-up — shown below PA responses. Click fills input and sends immediately. |

### Message Input

| Component | Path | Description |
| --- | --- | --- |
| `ChatInputArea` | `src/ui/components/chat/ChatInputArea.tsx` | Bottom bar — orchestrates `ChatTextInput`, `VoiceInputButton`, `AttachmentButton`, `SendButton`, `SuggestedReplyChips`, and `CharacterCounter`. Shows "Stop generating" button while PA is streaming. |
| `ChatTextInput` | `src/ui/components/chat/ChatTextInput.tsx` | Auto-expanding textarea (max 6 lines). Handles Enter/Shift+Enter mode per `userchatpreferences`. Shows character counter near limit. |
| `VoiceInputButton` | `src/ui/components/chat/VoiceInputButton.tsx` | Microphone icon — triggers `SpeechRecognition`. Pulses while recording. Transcription populates `ChatTextInput` in real time. |
| `AttachmentButton` | `src/ui/components/chat/AttachmentButton.tsx` | Paperclip icon — opens file picker with type/size validation. Uploads on select, shows `FileAttachmentChip` in the input area pre-send. |
| `AttachmentPreviewBar` | `src/ui/components/chat/AttachmentPreviewBar.tsx` | Shown above the input when files are attached — list of `FileAttachmentChip` items with individual remove buttons. |
| `SendButton` | `src/ui/components/chat/SendButton.tsx` | Send arrow — active only when input is non-empty or file attached. Shows "Stop generating" variant during streaming. |

### Utilities

| Component | Path | Description |
| --- | --- | --- |
| `KeyboardShortcutsOverlay` | `src/ui/components/chat/KeyboardShortcutsOverlay.tsx` | Modal showing all keyboard shortcuts — triggered by `?` when input is empty. |
| `ChatCommandPalette` | `src/ui/components/chat/ChatCommandPalette.tsx` | Quick-action palette triggered by `/` at the start of input — lists `/new`, `/clear`, `/export`, `/settings`. |
| `ChatEmptyState` | `src/ui/components/chat/ChatEmptyState.tsx` | Shown when a session has no messages — PA avatar, name, and input prompt "What can I help you with?" |

---

## Success Criteria

1. Clicking the PA avatar or a notification bubble opens the `AIChatPanel` within 200ms — slides in from the right, occupying 1/3 of the desktop viewport. The underlying YappChat view stays visible and interactive.
2. Clicking outside the panel (desktop) closes it with a slide-out animation. On mobile the panel is full-screen and closes via the Back button.
3. Closing and reopening the panel restores the exact previous state — scroll position, active session, and any unsent draft text.
4. A user sends a message and the first streaming token appears within 1 second.
5. The full PA response (including skill result cards) renders correctly with markdown, code highlighting, and inline tool-call cards.
6. Switching between sessions loads the full message history within 1 second.
7. Voice input transcribes and populates the input field in real time. Sending via voice requires no keyboard interaction.
8. The AI Chat panel is fully usable on mobile at full screen — touch targets meet minimum 44px, session strip collapses to icons only.
9. Exporting a session as Markdown produces a readable file with all messages, timestamps, and skill call summaries within 5 seconds.

---

## Key Entities

| Entity | Location | Description |
| --- | --- | --- |
| `ChatAttachment` | `chatattachments` table | A file uploaded for PA analysis — tied to a session and (after sending) a message. Purged when the parent session is hard-deleted. |
| `UserChatPreferences` | `userchatpreferences` table | Per-user UI settings for the AI Chat surface — enter key mode, voice auto-send, layout density. |

All conversation data (`AssistantSession`, `AssistantMessage`) is owned by spec 002 FR-008. All skill-invocation and subagent-execution records are owned by spec 002 FR-014/FR-015 — spec 005 only renders them via `ToolCallCard` and `SubagentCard`.

---

## Constraints

- Spec 005 MUST NOT implement any AI logic, skill invocation, or session storage — all delegated to spec 002.
- File attachments are stored server-side with a reference in `chatattachments`. Files are NEVER served via a public URL — only via authenticated API routes.
- Voice input uses the browser's native `SpeechRecognition` API — no external transcription service is required in v1. This limits voice input to Chrome and Edge (Firefox not supported as of 2026).
- The AI Chat surface does not show messages from external YappChat channels (Slack, Discord, etc.) — it shows only `assistantmessages` from spec 002. The `UnifiedMessageFeed` (spec 001) handles external channel messages.
- The Stop-generating button calls `AbortController.abort()` on the SSE stream — it does NOT call a server-side cancel endpoint. The partial response is persisted as-is.
- Attachment file size cap: 10MB per file, 5 files per message. Enforced on both client (pre-upload) and server (during upload).

---

## Notes

### Integration with Spec 002

The AI Chat calls spec 002's `/api/pa/*` routes exclusively for session and message management. The PA's `AssistantPanel` component (spec 002) is the logical component this surface wraps — spec 005 provides the full-screen shell, session sidebar, and rich rendering layer around it.

### Structured skill result rendering

The `SkillResultCard` component maps `resulttype` values to specific card layouts. These mappings are defined in a registry in `src/lib/skill-result-renderers.ts`. Third-party skills can register custom renderers. Default mappings:

| resulttype | Card renders |
| --- | --- |
| `calendar_event` | Title, date/time, location, attendees, Add to Calendar button |
| `jira_issue` | Issue key, title, status badge, assignee, priority, link |
| `file` | Filename, size, Download button |
| `weather` | City, temperature, condition icon, high/low |
| `generic_table` | Rendered as a sortable HTML table |

### Risks

- **SSE streaming in browsers**: some corporate proxies and firewalls buffer SSE streams, causing the user to see a blank response for several seconds then the full response at once. A fallback to long-polling should be considered if this is reported in testing.
- **Speech Recognition availability**: Chrome and Edge support `SpeechRecognition`; Firefox and Safari have partial/no support. The microphone button is hidden on unsupported browsers with a tooltip explaining why.
- **Large session histories**: sessions with 200+ messages may cause scroll performance issues in non-virtualised list implementations. `ChatMessageThread` MUST use a virtual list library (e.g., `react-virtual` or `@tanstack/react-virtual`).

---

## Clarifications

### Session 2026-05-10

| # | Question | Decision |
| --- | --- | --- |
| 1 | Does spec 005 have its own backend? | No — entirely a UI layer over spec 002's API. Minimal new routes for attachments and preferences only. |
| 2 | Is the PA avatar shown in AI Chat? | Yes — the PA avatar from spec 002 `paconfigs.avatarurl` is shown on every PA message bubble and in the empty state. |
| 3 | Does voice input use an external service? | No — browser `SpeechRecognition` API only in v1. Chrome/Edge only. |
| 4 | Does this replace the PA channel? | No — the PA channel (spec 002) remains. AI Chat is a dedicated richer surface; PA channel is integrated into the message feed. |
| 5 | What markdown library? | `react-markdown` with `remark-gfm` plugin for GitHub-Flavored Markdown (tables, strikethrough, etc.). |
| 6 | What code highlighting library? | `highlight.js` via `rehype-highlight` plugin — lighter than Prism for our use case. |
