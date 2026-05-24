# Spec 004: Agent & Skill Creation Studio

**Spec Number**: 004
**Status**: `draft`
**Created**: 2026-05-10
**Depends On**: Spec 001 (Common Chat Engine), Spec 002 (Personal Assistant), Spec 003 (WebSocket Engine)
**Source**: `specs/Project-Scope/004-agent-skill-creation-studio-tools.md`

---

## Overview

The Agent & Skill Creation Studio is the workbench where developers and power users build, test, manage, and version the **skills** and **agent templates** that extend YappChat's Personal Assistant (spec 002).

**Skills** are single-function tools — an HTTP endpoint, a name, a description, and a JSON input schema. The PA calls them when a user's request maps to their capability. Spec 004 owns the `skills` table: creating, editing, versioning, testing, and generating starter handler code.

**Agent templates** are reusable subagent configurations: a name, avatar, system prompt, assigned skill set, and AI provider. When the PA needs to spawn a subagent for complex multi-step work, it picks the right template from the library. Spec 004 is where those templates are designed and tested.

This scope is the back-end studio — the forms, editors, test consoles, and version history that let teams extend YappChat without touching core engine code. The PA's conversational skill-creation (spec 002 FR-006) is a lightweight front door to this studio; spec 004 is the full workshop.

---

## Core Design

| Element | Value |
| --- | --- |
| **Primary Actor** | Developer or power user |
| **Secondary Actors** | YappChat administrator, Personal Assistant (spec 002, reads from `skills`) |
| **Key Value** | Any team member can create a new skill or agent template in the Studio and it appears in the PA's tool list immediately with no code changes to the engine. |
| **Scope Boundary** | IN SCOPE: skill CRUD; skill JSON schema editor; skill handler test console; handler code generation (TypeScript, Python, JavaScript); skill version history and rollback; agent template CRUD; agent template test console; skill and agent metrics; skill import/export; community skill publish (delegates to spec 002). OUT OF SCOPE: PA conversation UI (spec 005); community skill marketplace browsing (spec 002); actual skill handler runtime (deployed externally); agent execution engine (spec 002); MCP server management (spec 002). |

---

## User Scenarios & Testing

### US1 — Developer creates and tests a skill from scratch

**Actor**: Developer

**Scenario**:

1. Developer opens the Skill Studio and clicks **New Skill**.
2. Fills in: name `get_jira_sprint`, label "Get Jira Sprint", category `development`, description, handler URL, async: false.
3. Opens the JSON Schema editor and defines two input fields: `projectKey` (string, required) and `includeResolved` (boolean, optional).
4. Clicks **Generate Handler** → selects TypeScript → Studio outputs a starter Express handler with input validation, response shape, and `X-Skill-Token` authentication.
5. Developer deploys the handler, returns to the Studio, clicks **Test**, enters sample inputs, and sees the raw JSON response.
6. Test passes. Developer clicks **Enable**. Skill is immediately in the PA's tool list — no restart.

**Expected outcome**: Skill created, handler generated, tested against live handler, and available to the PA within 5 minutes.

### US2 — Developer creates an agent template for research tasks

**Actor**: Developer

**Scenario**:

1. Developer opens the Agent Studio and clicks **New Agent Template**.
2. Fills in: name "Research Agent", description, avatar, system prompt, AI provider: local Ollama llama3, async: true.
3. Assigns skills: `brave_web_search`, `fetch_webpage_content`, `summarise_text`.
4. Clicks **Test Agent** — enters a test prompt. Studio runs the template in a sandbox and shows the tool calls made and the final response.
5. Satisfied, developer clicks **Enable**. Template appears in the PA's subagent library.

**Expected outcome**: Agent template created, tested, and published to the PA subagent library without engine changes.

### US3 — Power user edits a skill and sees version history

**Actor**: Power user

**Scenario**:

1. User finds `get_jira_sprint` in the Skill Studio and clicks **Edit**.
2. Updates the handler URL and adds a new optional field `maxResults` to the schema.
3. Clicks **Save** — Studio auto-increments to `v1.1.0` and writes a diff record.
4. User clicks **Version History** — sees `1.0.0 → 1.1.0` with changed fields highlighted. Clicks **Rollback to 1.0.0** if needed.

**Expected outcome**: Skill versioned automatically on change. Rollback available in one click.

### US4 — Developer imports a skill bundle

**Actor**: Developer

**Scenario**:

1. Developer receives a `skills-bundle.json` with 5 skill definitions, clicks **Import**, selects the file.
2. Studio validates each definition and shows: "5 skills found — 4 will be created, 1 already exists (will be skipped)."
3. Developer confirms. 4 skills created in `enabled: false` state. Developer enables them after testing each handler.

**Expected outcome**: Bulk import with validation preview. New skills created disabled — no live impact until explicitly enabled.

### US5 — Studio Assistant guides a new skill from description to registration

**Actor**: Developer or power user (may not know JSON Schema or handler patterns)

**Scenario**:

1. User opens the Skill Studio. In the sidebar, the **Studio Assistant** avatar is visible — a persona named "Archie" with an avatar, status dot, and a prompt: "Tell me what you want your skill to do and I'll help you build it."
2. User types: "I want a skill that looks up the current weather for a given city."
3. Archie immediately runs a similarity search against the community skills catalog. It finds a match: `get_weather_openweathermap` (147 installs, community, `integration` category, by @sasha).
4. Archie responds:

   > "I found a community skill that does something similar: **get_weather_openweathermap** by @sasha (147 installs). It fetches current weather via the OpenWeatherMap API.
   >
   > What would you like to do?
   > - **Use it as-is** — install directly to your catalog
   > - **Start from this** — copy it as a base and customise
   > - **Build from scratch** — I'll guide you through creating your own"

5. User replies: "Start from this." Archie copies the community skill into a draft with the user's private catalog, pre-fills the form fields, and says:

   > "I've pre-filled the form from the community skill. Let's customise it. First — does the handler URL stay the same, or do you have your own weather API endpoint?"

6. User provides their endpoint. Archie updates the `handlerurl` field in the form live, then asks about schema changes ("Do you want to add any extra inputs, like `units: metric|imperial`?").
7. Once the user is satisfied, Archie says: "Ready to register — shall I save this? I'll keep it disabled until you've tested the handler." User confirms. Skill is saved.

**Expected outcome**: A non-expert user creates a production-ready skill through conversation with Archie. The form is filled collaboratively — the user never needs to write JSON Schema directly unless they want to.

---

## Functional Requirements

### FR-001 — Skill CRUD and lifecycle management

The Studio MUST be the authoritative source for all skill definitions. The `skills` table is owned by this spec; spec 002 reads from it.

**Acceptance Criteria**:

- [ ] `POST /api/studio/skills` creates a skill with required fields; skill starts `enabled: false`
- [ ] `GET /api/studio/skills` returns full org catalog — filterable by `category`, `enabled`, `async`, `createdby`; searchable by `name`, `label`, `description`
- [ ] `GET /api/studio/skills/:id` returns full skill detail including usage stats summary and version history summary
- [ ] `PATCH /api/studio/skills/:id` updates editable fields. Each save changing `inputschema` or `handlerurl` auto-increments semver patch version and writes a `skillversions` record
- [ ] `DELETE /api/studio/skills/:id` permanently deletes skill and associated records. Blocked if invoked within the last 24 hours — requires explicit override confirmation
- [ ] `PATCH /api/studio/skills/:id/enable` and `disable` toggle `enabled` immediately — no restart. Disabled skills are instantly removed from the PA tool list
- [ ] Skill `name` must be unique within org, snake_case, 1–64 characters. Enforced at API layer.

### FR-002 — JSON Schema editor and input validation

The Studio MUST provide a structured editor for the skill's `inputschema` (JSON Schema Draft 7) and validate test inputs against it before sending to the handler.

**Acceptance Criteria**:

- [ ] `JSONSchemaEditor` supports: field add/remove, name, type (`string`, `number`, `boolean`, `array`, `object`), required toggle, description, enum values, number min/max, string minLength/maxLength
- [ ] Editor shows a live preview of the generated JSON Schema as the user builds it
- [ ] Schemas validated with `ajv` before saving — invalid schemas rejected with plain-English error
- [ ] Test console validates inputs against current `inputschema` before calling the handler — per-field errors shown, not a raw 422

### FR-003 — Skill handler test console

The Studio MUST let developers send test requests to their skill handler and see the full exchange.

**Acceptance Criteria**:

- [ ] `POST /api/studio/skills/:id/test` sends a POST to the handler URL with test arguments and `X-Skill-Token` header; returns `{ status, latencyms, responseBody, requestSent }` regardless of success or failure
- [ ] Test timeout: 30 seconds — same as live invocations
- [ ] Test results stored in `skilltestlogs` — visible in skill detail as test history
- [ ] Console shows: exact JSON sent, HTTP status code, response body (syntax-highlighted), round-trip latency
- [ ] Unreachable handler shows clear error: "Handler URL not reachable — check the URL and that your server is running"
- [ ] Test invocations tagged `invokedby: "studio_test"` in `skillinvocations` — distinct from live PA calls

### FR-004 — Handler code generation

The Studio MUST generate working starter handler code so developers do not write boilerplate.

**Acceptance Criteria**:

- [ ] `POST /api/studio/skills/:id/generate-handler` returns handler source in requested language (`typescript` | `python` | `javascript`)
- [ ] TypeScript handler: Express route, `X-Skill-Token` validation, request body typed from `inputschema`, response typed as `{ result: unknown }`, error handling
- [ ] Python handler: FastAPI route, `X-Skill-Token` header check, Pydantic model generated from `inputschema`
- [ ] Generated code includes inline comments explaining each section — written for a developer unfamiliar with YappChat skill handlers
- [ ] Studio shows a **Deploy checklist** alongside generated code: deploy handler, verify it is reachable from the YappChat server, paste URL back into skill form, run a test

### FR-005 — Skill version history and rollback

Every behavioural change to a skill MUST be versioned and reversible.

**Acceptance Criteria**:

- [ ] `skillversions` records created automatically on every `PATCH` changing `inputschema` or `handlerurl`. Stores: version, previousversion, changedfields, schemadiff (before/after), updatedat, updatedby
- [ ] `GET /api/studio/skills/:id/versions` returns full history newest-first
- [ ] `POST /api/studio/skills/:id/rollback` with `{ version }` restores schema and URL from that version as a new version record — does not delete history
- [ ] Version numbers follow semver patch auto-increment. Users may request minor or major bump via `PATCH` with `{ versionbump: "minor" | "major" }`

### FR-006 — Agent template creation and management

The Studio MUST let developers define reusable subagent templates the PA can spawn.

**Acceptance Criteria**:

- [ ] `POST /api/studio/agents` creates a template with: `name`, `description`, `avatarurl`, `systemprompt`, `providerid` (FK → aiproviders), `async`, `skillids[]`
- [ ] `GET /api/studio/agents` lists all templates with skill count, async flag, enabled state
- [ ] `PATCH /api/studio/agents/:id` updates any field. Skill list changes take effect on next spawn
- [ ] `DELETE /api/studio/agents/:id` blocked if active `subagentexecutions` row references this template
- [ ] Templates may only include `enabled: true` skills — blocked at API layer if disabled skill is included

### FR-007 — Agent template test console

The Studio MUST let developers test a template by running it against a sandbox session.

**Acceptance Criteria**:

- [ ] `POST /api/studio/agents/:id/test` creates a temporary sandbox PA session, runs the template against the test prompt, returns: response text, tool call trace (skill name → inputs → output per call), token counts, total latency
- [ ] Sandbox tests stored in `agenttestlogs` (7-day retention) — not in `assistantsessions`
- [ ] Unavailable AI provider returns clear error rather than hanging

### FR-008 — Skill import and export

**Acceptance Criteria**:

- [ ] `GET /api/studio/skills/export` returns all org skills as a portable JSON bundle. `skilltoken` values are never exported
- [ ] `POST /api/studio/skills/import` validates bundle and returns preview: `{ toCreate, toSkip, errors }` — no creation until confirmed
- [ ] `POST /api/studio/skills/import/confirm` creates all `toCreate` skills in `enabled: false` state, tagged `createdby: "import"`

### FR-009 — Skill and agent metrics

**Acceptance Criteria**:

- [ ] `GET /api/studio/skills/:id/stats` returns: `{ totalInvocations, successRate, avgLatencyMs, p95LatencyMs, errorCount, lastInvokedAt }` — read from spec 002's `skillinvocations` table (FR-014). This spec NEVER writes to `skillinvocations`; it only reads
- [ ] `GET /api/studio/agents/:id/stats` returns: `{ totalSpawns, completedCount, errorCount, avgRuntimeMs, lastSpawnedAt }` — read from spec 002's `subagentexecutions` table (FR-015). This spec NEVER writes to `subagentexecutions`; it only reads
- [ ] Skills with error rate > 20% over the last 7 days are highlighted with a warning badge in the catalog

### FR-010 — Studio Assistant persona, similarity detection, and guided creation

The Studio MUST embed a conversational AI assistant — the **Studio Assistant** (default persona name: "Archie") — as a persistent avatar in the Studio sidebar. Before any creation begins, Archie runs a similarity search against the community skills/agents catalog and presents the result with three clear paths. Creation then proceeds conversationally: Archie fills the form live as the user answers questions, so non-expert users never need to write JSON Schema directly.

**Persona**:

- Name: "Archie" (configurable by admin via `studioassistantconfig`)
- Avatar: configurable image — defaults to a robot/wrench icon
- Tone: friendly, knowledgeable, concise — never condescending
- Role: "I'm your Agent & Skill Builder. Tell me what you want and I'll help you build it."
- Powered by the same AI provider the user has configured for their PA (spec 002 `paconfigs.activeproviderid`). If the user has no PA set up yet, Archie falls back to the **system default provider** — the first row in `aiproviders` flagged with `isdefault: true` (added below). Deployments configure exactly one default provider at install time; if none is configured, `POST /api/studio/assistant/chat` returns HTTP 503 `{ error: "no_assistant_provider_configured" }` and `StudioAssistant` shows: "Set up a personal AI provider to use Archie."

**Similarity detection** — runs before creation begins, always:

> Archie searches community skills/agents using semantic similarity (embedding comparison or AI-powered description matching against `communityskills.description` + `communityskills.name`). If a match above a configurable threshold is found (default: 0.75 cosine similarity), Archie presents it before doing anything else.

**Three starting paths** (presented when a community match is found):

| Option | What happens |
| --- | --- |
| **Use as-is** | Installs the community skill directly via `POST /api/community/skills/:id/install` — no new skill created |
| **Start from this** | Copies community skill definition into a new private draft (all fields pre-filled, `communityskillid` set, `enabled: false`) — user then customises with Archie's guidance |
| **Build from scratch** | Ignores the match, Archie starts the guided creation flow from step 1 |

When no community match is found:
> "I didn't find anything similar in the community catalog — let's build from scratch!"

**Guided creation flow** (both "Start from this" and "Build from scratch" paths):

Archie asks a fixed sequence of clarifying questions, each mapped to a skill/agent field. As the user answers, Archie writes the value into the live form in real time — the user can see the form fill in as they chat. They can switch to the form at any time to edit directly.

Questions for a skill:

1. "What should this skill be called? Give me a short snake_case name — like `send_slack_message` or `get_weather`."
2. "Describe what it does in 1–2 sentences, as if explaining to the AI assistant that will use it."
3. "What category fits best? [shows category list]"
4. "What inputs does it need? List them — I'll handle the JSON Schema. Example: 'city name (required text), units (optional, metric or imperial)'."
5. "What URL should I call to run it? (Leave blank for now if you haven't deployed yet)"
6. "Should this run instantly (synchronous) or in the background as a subagent (asynchronous)?"
7. "Ready to save? I'll keep it disabled until you've tested the handler."

Questions for an agent template follow the same pattern (name, description, system prompt phrasing, skills to include, AI provider, async).

**Acceptance Criteria**:

- [ ] Archie's avatar and chat panel are permanently visible in the Studio sidebar — always accessible without navigating away from the form
- [ ] `POST /api/studio/assistant/describe` accepts `{ description, type: "skill"|"agent" }` and returns `{ matches: [{ communityskillid, name, label, similarity, installcount }], topMatch?: {...} }` — the similarity search result that Archie presents to the user
- [ ] Similarity search runs as soon as the user submits their initial description — before any form is shown. Results returned within 3 seconds
- [ ] If `topMatch.similarity >= 0.75` Archie presents the three-path card (`SimilarityMatchCard`). If no match above threshold, Archie immediately starts the guided creation flow
- [ ] `POST /api/studio/assistant/chat` accepts the current conversation history and current form state, and returns Archie's next message plus `{ fieldUpdates: { fieldname: value, ... } }` — the fields to apply to the live form. The Studio applies `fieldUpdates` to the form in real time as each Archie response arrives
- [ ] Every Archie response includes a `suggestedNextQuestion` so the UI can show a one-click reply button if the user wants to accept Archie's suggested phrasing
- [ ] When Archie has collected enough information to produce a complete, valid skill definition, it presents a **confirmation card** showing all fields as a summary — user must explicitly confirm before anything is saved
- [ ] Archie never saves, enables, or publishes anything without explicit user confirmation
- [ ] Admin can configure the persona name and avatar via `PATCH /api/studio/assistant/config`
- [ ] Archie's conversation history is session-local — not stored in the database after the Studio tab is closed

---

## Data Requirements

| Table | Purpose |
| --- | --- |
| `skills` | **Owned by this spec** — skill catalog with name, schema, handler, version, enabled, category |
| `skillversions` | Immutable diff history per skill change |
| `skilltestlogs` | Studio test console results — distinct from live PA invocations |
| `agenttemplates` | Reusable subagent configurations — system prompt, provider, assigned skills |
| `agenttemplateskills` | Join table — which skills belong to which template |
| `agenttestlogs` | Agent template sandbox test results |

### `skills`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `name` | text | Unique snake_case tool name within org |
| `label` | text | Human-readable label |
| `description` | text | Tool description sent to AI providers |
| `category` | text | `productivity` \| `communication` \| `data` \| `development` \| `finance` \| `media` \| `integration` \| `custom` |
| `inputschema` | jsonb | JSON Schema Draft 7 for tool inputs |
| `handlerurl` | text | HTTP POST endpoint |
| `skilltoken` | text | Stored hashed — sent as `X-Skill-Token` header to handler |
| `async` | boolean | True → subagent launch instead of sync invocation |
| `enabled` | boolean | False → excluded from PA tool list immediately |
| `version` | text | Semver — auto-incremented on schema/URL change |
| `createdby` | text | `"studio"` \| `"pa"` \| `"import"` |
| `communityskillid` | uuid | Nullable FK → communityskills.id |
| `createdat` | timestamptz | |
| `updatedat` | timestamptz | |

### `skillversions`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `skillid` | uuid | FK → skills.id |
| `version` | text | Version at time of record |
| `previousversion` | text | |
| `changedfields` | text[] | Fields that changed |
| `schemadiff` | jsonb | `{ before, after }` |
| `updatedat` | timestamptz | |
| `updatedby` | text | userid |

### `skilltestlogs`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `skillid` | uuid | FK → skills.id |
| `testedinput` | jsonb | Arguments sent |
| `httpstatus` | integer | HTTP status returned |
| `responsebody` | jsonb | Full response |
| `latencyms` | integer | |
| `success` | boolean | True if 2xx |
| `testedat` | timestamptz | |
| `testedby` | text | userid |

### `agenttemplates`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `name` | text | Template display name |
| `description` | text | |
| `avatarurl` | text | |
| `systemprompt` | text | Full system prompt |
| `providerid` | uuid | FK → aiproviders.id (spec 002) |
| `async` | boolean | Whether spawned instances run asynchronously |
| `enabled` | boolean | |
| `maxruntimeseconds` | integer | Hard runtime cap for spawned subagents — spec 002 FR-015 enforces. Default 600 (10 minutes). Allowed range: 60–3600 |
| `createdat` | timestamptz | |
| `updatedat` | timestamptz | |

### `agenttemplateskills`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `agenttemplateid` | uuid | FK → agenttemplates.id |
| `skillid` | uuid | FK → skills.id |

UNIQUE constraint on `(agenttemplateid, skillid)`.

### `agenttestlogs`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `agenttemplateid` | uuid | FK → agenttemplates.id |
| `testprompt` | text | |
| `toolcalls` | jsonb | Ordered array of `{ skillname, input, output, latencyms }` |
| `responsetext` | text | |
| `prompttokens` | integer | |
| `completiontokens` | integer | |
| `totallatencyms` | integer | |
| `testedat` | timestamptz | |
| `testedby` | text | userid |

---

## API Routes

### Skills

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/studio/skills` | List catalog — filterable, searchable |
| POST | `/api/studio/skills` | Create skill — starts disabled |
| GET | `/api/studio/skills/:id` | Skill detail with stats and version summary |
| PATCH | `/api/studio/skills/:id` | Update — auto-versions on schema/URL changes |
| DELETE | `/api/studio/skills/:id` | Delete — blocked if recently active |
| PATCH | `/api/studio/skills/:id/enable` | Enable — immediately live in PA |
| PATCH | `/api/studio/skills/:id/disable` | Disable — immediately removed from PA |
| POST | `/api/studio/skills/:id/test` | Send test request to handler |
| GET | `/api/studio/skills/:id/testlogs` | Test history |
| GET | `/api/studio/skills/:id/versions` | Full version history newest-first |
| POST | `/api/studio/skills/:id/rollback` | Restore a previous version — `{ version }` |
| POST | `/api/studio/skills/:id/generate-handler` | Starter handler code — `{ language }` |
| GET | `/api/studio/skills/:id/stats` | Usage metrics |
| GET | `/api/studio/skills/export` | Export all skills as JSON bundle |
| POST | `/api/studio/skills/import` | Validate import bundle — returns preview |
| POST | `/api/studio/skills/import/confirm` | Execute confirmed import |

### Agent Templates

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/studio/agents` | List templates |
| POST | `/api/studio/agents` | Create template |
| GET | `/api/studio/agents/:id` | Template detail with skills and stats |
| PATCH | `/api/studio/agents/:id` | Update |
| DELETE | `/api/studio/agents/:id` | Delete — blocked if active spawns exist |
| PATCH | `/api/studio/agents/:id/enable` | Enable |
| PATCH | `/api/studio/agents/:id/disable` | Disable |
| POST | `/api/studio/agents/:id/test` | Sandbox test with prompt |
| GET | `/api/studio/agents/:id/testlogs` | Sandbox test history |
| GET | `/api/studio/agents/:id/stats` | Spawn metrics |

### Studio Assistant

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/studio/assistant/describe` | Similarity search — `{ description, type: "skill"\|"agent" }` → returns community matches with similarity scores. Called as soon as user submits initial description. |
| POST | `/api/studio/assistant/chat` | One conversation turn — `{ history, formstate, message }` → returns `{ reply, fieldUpdates, suggestedNextQuestion, readyToSave? }`. `fieldUpdates` are applied to the live form immediately. |
| GET | `/api/studio/assistant/config` | Current assistant persona config — name, avatarurl, providerid |
| PATCH | `/api/studio/assistant/config` | Admin only — update persona name, avatar, provider |

---

## Frontend Components

### Skill Studio

| Component | Path | Description |
| --- | --- | --- |
| `SkillStudio` | `src/ui/components/studio/SkillStudio.tsx` | Main layout — sidebar skill list, detail panel. Resizable split view. |
| `SkillList` | `src/ui/components/studio/SkillList.tsx` | Scrollable catalog — name, category badge, enabled toggle, error-rate warning badge, last used. |
| `SkillForm` | `src/ui/components/studio/SkillForm.tsx` | Full skill editor — all fields including embedded JSONSchemaEditor. Save auto-versions. |
| `JSONSchemaEditor` | `src/ui/components/studio/JSONSchemaEditor.tsx` | Visual JSON Schema Draft 7 editor — field list, type selector, required toggle, constraints. Live schema preview pane. |
| `SkillTestConsole` | `src/ui/components/studio/SkillTestConsole.tsx` | Auto-generated input form from `inputschema`, Send button, response panel with status, latency, request/response JSON syntax-highlighted. |
| `HandlerCodeGenerator` | `src/ui/components/studio/HandlerCodeGenerator.tsx` | Language selector, generated code with syntax highlighting, copy button, Deploy checklist panel. |
| `SkillVersionHistory` | `src/ui/components/studio/SkillVersionHistory.tsx` | Timeline — each entry shows version, date, changed fields, expandable diff. Rollback button per entry. |
| `SkillMetricsBadges` | `src/ui/components/studio/SkillMetricsBadges.tsx` | Compact inline badges: success rate %, avg latency, last used. Yellow warning when error rate > 20%. |
| `SkillImportFlow` | `src/ui/components/studio/SkillImportFlow.tsx` | File picker → validation results table (create/skip/error) → confirm button. |

### Agent Studio

| Component | Path | Description |
| --- | --- | --- |
| `AgentStudio` | `src/ui/components/studio/AgentStudio.tsx` | Split-view layout — template list sidebar, detail panel. |
| `AgentTemplateList` | `src/ui/components/studio/AgentTemplateList.tsx` | Template list — avatar, name, async badge, skill count, enabled toggle. |
| `AgentTemplateForm` | `src/ui/components/studio/AgentTemplateForm.tsx` | Full editor — name, avatar upload, description, system prompt textarea, AI provider picker, async toggle, skill multi-select from catalog. |
| `AgentTestConsole` | `src/ui/components/studio/AgentTestConsole.tsx` | Test prompt textarea, Run button. Results: response text, collapsible tool-call trace per skill call, token counts, total latency. |

### Studio Assistant UI

| Component | Path | Description |
| --- | --- | --- |
| `StudioAssistant` | `src/ui/components/studio/StudioAssistant.tsx` | Persistent sidebar panel present in both Skill Studio and Agent Studio. Shows Archie's avatar (configurable), name, status dot (`thinking` / `ready`), and the conversation thread. Always visible — does not require navigating away from the form. |
| `StudioAssistantBubble` | `src/ui/components/studio/StudioAssistantBubble.tsx` | Single message bubble in the assistant thread — Archie messages left-aligned with avatar, user replies right-aligned. Renders plain text, the `SimilarityMatchCard` when a community match is found, and the `SkillConfirmationCard` when Archie is ready to save. |
| `SimilarityMatchCard` | `src/ui/components/studio/SimilarityMatchCard.tsx` | Rendered by Archie when a community match is found. Shows: matched skill name, author, install count, one-line description, similarity confidence badge. Three action buttons: **Use as-is**, **Start from this**, **Build from scratch**. |
| `StudioAssistantInput` | `src/ui/components/studio/StudioAssistantInput.tsx` | Message composer at the bottom of the assistant panel. Text field, Send button, and a `SuggestedReply` chip showing Archie's `suggestedNextQuestion` — clicking the chip populates and sends it in one tap. |
| `LiveFormHighlight` | `src/ui/components/studio/LiveFormHighlight.tsx` | Wrapper applied to any form field that was just updated by Archie — briefly highlights the field with a pulse animation so the user can see what changed. Applied automatically from `fieldUpdates` in the `/api/studio/assistant/chat` response. |
| `SkillConfirmationCard` | `src/ui/components/studio/SkillConfirmationCard.tsx` | Rendered by Archie when all required fields are collected. Shows a summary of all skill/agent fields in a read-only card. Two buttons: **Save (keep disabled)** and **Edit first** (returns to the form). Archie never saves without this confirmation. |

---

## Success Criteria

1. A developer creates a skill, generates handler code, deploys it, tests it successfully from the Studio, and has it available to the PA within 5 minutes.
2. A skill update (new handler URL or schema change) is versioned automatically and the previous version is accessible with rollback completing in one click.
3. An agent template enabled in the Studio is invokable by the PA as a subagent within 30 seconds.
4. A 10-skill JSON import shows a validation preview before committing; all valid skills are created in disabled state.
5. A skill with error rate > 20% over the last 7 days is visibly flagged in the catalog without querying the database.
6. Skills and agent templates are searchable by name, label, description, and category — results within 500ms.
7. A non-technical user can describe a skill in plain language, be shown a community match (when one exists) within 3 seconds, and complete creation through conversation with Archie without writing a single line of JSON Schema.

---

## Key Entities

| Entity | Location | Description |
| --- | --- | --- |
| `Skill` | `skills` table | Single registered tool — name, JSON schema, HTTP handler, category, version. Owned by this spec; read by spec 002. |
| `SkillVersion` | `skillversions` table | Immutable record of a skill change — before/after diff, who changed it. |
| `SkillTestLog` | `skilltestlogs` table | One Studio test invocation result — distinct from live PA invocations. |
| `AgentTemplate` | `agenttemplates` table | Reusable subagent config — system prompt, skill set, AI provider. PA spawns from this for multi-step work. |
| `AgentTestLog` | `agenttestlogs` table | One sandbox agent template test — prompt, tool call trace, response, tokens. |

---

## Constraints

- The `skills` table is owned exclusively by this spec. No other spec writes to it directly.
- Skills start `enabled: false` regardless of creation method. A user must explicitly enable each skill.
- Skill names must be unique within the org, snake_case, 1–64 characters. Enforced at API layer, not only UI.
- `skilltoken` is stored hashed and never returned in API responses after creation.
- Agent templates may only reference `enabled: true` skills — validated at template create and enable time.
- `DELETE` on a skill or template is blocked if invoked/spawned within the last 24 hours — explicit override required.
- Skill handler URLs must be HTTPS in production. HTTP only permitted when `ALLOW_HTTP_SKILL_HANDLERS=true` (dev only).
- Handler code generation is read-only — it does not deploy. The developer is responsible for deploying the generated handler.

---

## Notes

### Relationship to Spec 002 (PA)

- Spec 002 FR-006's conversational skill creation calls `POST /api/pa/skills/register` → which calls `POST /api/studio/skills`. All skill creation writes through spec 004's API.
- `agenttemplates` defined here are the templates the PA uses when spawning subagents (spec 002 FR-015). The `maxruntimeseconds` column added in this spec is read by spec 002's subagent runtime to enforce the per-template runtime cap.
- **Skill execution is owned by spec 002** (FR-014), not this scope. This studio defines, tests, versions, and exports skill *definitions*; spec 002 is the runtime that actually POSTs to `handlerurl` with `X-Skill-Token`. Test invocations from `POST /api/studio/skills/:id/test` are tagged `invokedby: "studio_test"` in `skillinvocations` so the runtime path is shared but the source is distinguishable.
- **Subagent execution is owned by spec 002** (FR-015), not this scope. The `agenttemplate` rows defined here are *templates*; spec 002's runtime spawns and supervises the actual subagent instances.
- Read-only access to spec 002's `skillinvocations` and `subagentexecutions` tables drives the stats endpoints (FR-009 here).
- Community skill publishing from this studio delegates to spec 002's publish API.
- **Spec 005 (AI Chat) FR-008**: when a user expresses creation intent in the AI Chat panel, the panel expands to full screen and mounts the spec 004 Studio with the user's description pre-loaded into the Studio Assistant (Archie). All spec 004 FRs apply in full during that session. The Studio MUST accept an optional `initialDescription` prop so the AI Chat can pass the user's message directly to Archie without requiring re-entry.

### Handler Authentication

Every handler authenticates using `X-Skill-Token`. The Studio generates this on creation (shown once, not retrievable), stores a bcrypt hash, and includes the validation pattern in generated code:

```typescript
const token = req.headers['x-skill-token'];
if (!token || token !== process.env.SKILL_TOKEN) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

### Risks

- **Handler URL availability**: the Studio cannot verify a handler will be reachable in production. The test console catches this at test time; skill error rate monitoring (FR-009) is the production safety net.
- **Schema breaking changes**: removing required fields from `inputschema` may silently break existing PA tool calls. Version history records this but does not block it — developers own backwards compatibility.
- **Template skill staleness**: if a skill assigned to a template is disabled after the template is enabled, spawned agents will fail to invoke that skill. This gap is not blocked in v1 — flagged as a follow-on scope item.

---

## Clarifications

### Session 2026-05-10

| # | Question | Decision |
| --- | --- | --- |
| 1 | Who owns the `skills` table? | This spec (004). Spec 002 reads and writes only via this spec's API. |
| 2 | Is PA conversational skill creation separate? | No — it calls this spec's API as the back-end. |
| 3 | What is an agent template vs an agent instance? | Template = reusable config. Instance = running subagent spawned from a template by the PA. |
| 4 | Does this spec handle running agents? | No — spec 002 owns execution. This spec owns template definition and testing. |
| 5 | Are community skills managed here? | No — community skills are spec 002. Publish from here delegates to spec 002's API. |
| 6 | Handler generation languages in v1? | TypeScript, Python, JavaScript. |
| 7 | Who owns skill execution at runtime? | Spec 002 FR-014. This studio defines, tests, versions, and exports — but the actual HTTP call to `handlerurl` (with retries, validation, audit) lives in spec 002. |
| 8 | Who owns subagent execution at runtime? | Spec 002 FR-015. This studio defines templates; spec 002 spawns and supervises instances. |
| 9 | Are `skillinvocations` and `subagentexecutions` writable from here? | No — read-only. Spec 002 owns both tables. |
| 10 | What if the user has no PA / no AI provider for Archie? | Falls back to a `aiproviders` row marked `isdefault: true`. If none exists, Archie disables itself with a clear setup message. |
| 11 | Where is the per-template runtime cap stored? | `agenttemplates.maxruntimeseconds` (added in this spec, range 60–3600, default 600). Spec 002 enforces. |
