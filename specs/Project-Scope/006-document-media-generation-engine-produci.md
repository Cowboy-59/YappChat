# Spec 006: Document & Media Generation Engine

**Spec Number**: 006
**Status**: `draft`
**Created**: 2026-05-10
**Depends On**: Spec 001 (Common Chat Engine), Spec 002 (Personal Assistant)
**Source**: `specs/Project-Scope/006-document-media-generation-engine-produci.md`

---

## Overview

The Document & Media Generation Engine produces files on demand — PDFs, Excel spreadsheets, PowerPoint presentations, and AI-generated images — from content provided by the Personal Assistant, a YappChat user, or an automated workflow.

It is a backend service with a simple REST API. Callers post content and a format; the engine renders the file and returns a download link. Small files are returned synchronously; larger documents run as background jobs with status polling.

**Output formats**:

| Format | Use cases | Library |
| --- | --- | --- |
| PDF (.pdf) | Reports, proposals, invoices, summaries | `@react-pdf/renderer` (MIT) |
| Excel (.xlsx) | Data exports, dashboards, financial models | `exceljs` (MIT) |
| PowerPoint (.pptx) | Presentations, slide decks, pitches | `pptxgenjs` (MIT) |
| Image (PNG/JPG) | AI-generated visuals, diagrams, cover art | OpenAI DALL-E 3 (or any registered image provider) |

The engine also manages **document templates** — reusable layouts and styles that callers reference by template key. Templates can be system-bundled (e.g., `report-standard`, `invoice-basic`, `pitch-deck`) or user-defined.

Callers in YappChat that use this engine:

- **Spec 002 (PA)** — generates presentations and reports from AI-assembled content
- **Spec 004 Studio** — exports skill/agent definitions as PDF reports
- **Spec 005 AI Chat** — exports session transcripts as PDF

---

## Core Design

| Element | Value |
| --- | --- |
| **Primary Actor** | YappChat user, PA (spec 002), or automated skill/workflow |
| **Secondary Actors** | Document template designer, YappChat administrator |
| **Key Value** | Any module in YappChat can request a document or image with a single API call. No external tools, no format-specific code in the calling module. |
| **Scope Boundary** | IN SCOPE: PDF, Excel, PPTX, and AI image generation; document template management (system + user-defined); async job queue for large documents; file storage with expiry; download links delivered via spec 001 chat or direct API response; generation log. OUT OF SCOPE: real-time collaborative editing; version control of generated files; document parsing/OCR; video generation; music generation. |

---

## User Scenarios & Testing

### US1 — PA generates a presentation from an outline

**Actor**: PA (automated, triggered by spec 002)

**Scenario**:

1. The PA assembled a presentation outline using skill results and calls `POST /api/gen/presentation` with the outline JSON, template `pitch-deck`, and format `pptx`.
2. The request has 8 slides — over the 5-slide sync threshold. Engine returns immediately: `{ jobid, status: "queued", estimatedseconds: 25 }`.
3. PA posts a progress note in chat: "Generating your presentation — about 25 seconds."
4. Engine processes the job, stores the PPTX, and POSTs the result to the PA's `callbackurl`.
5. PA posts in the AI Chat thread: "Here's your presentation." A `GeneratedFileCard` with filename and Download button renders inline.

**Expected outcome**: PPTX delivered in chat within 30 seconds.

### US2 — User requests an Excel export of project tasks

**Actor**: YappChat user (via PA)

**Scenario**:

1. PA fetches task data and calls `POST /api/gen/excel` with column definitions and row data using template `data-export-standard`.
2. Under 500 rows — synchronous response with `{ fileurl, filename, sizebytes }` within 10 seconds.
3. PA delivers the download link in the chat.

**Expected outcome**: Excel file delivered within 10 seconds with headers, formatted rows, and auto-filter.

### US3 — User requests an AI-generated image

**Actor**: YappChat user (via AI Chat)

**Scenario**:

1. User types: "Generate a cover image for the Q2 engineering report — tech-themed and professional."
2. PA calls `POST /api/gen/image` with the prompt and `{ size: "1792x1024" }`.
3. DALL-E 3 generates the image within 15 seconds. Engine stores it and returns `{ fileurl, prompt, model }`.
4. PA renders the image inline in the chat with a Download button.

**Expected outcome**: Image visible in chat within 15 seconds.

### US4 — Admin creates a custom document template

**Actor**: YappChat administrator

**Scenario**:

1. Admin opens generation settings, clicks **New Template**, selects format `pdf`, enters key `invoice-custom`, uploads an HTML/CSS template file, and defines the required data schema.
2. Saves. Template immediately available to all callers.

**Expected outcome**: Custom template usable by callers within 60 seconds of saving.

---

## Functional Requirements

### FR-001 — PDF generation

**Acceptance Criteria**:

- [ ] `POST /api/gen/pdf` accepts `{ template, data, options?, async?, callbackurl? }`. `data` must match the template's `dataschema`
- [ ] Files under 1MB returned synchronously (`fileurl` in response) within 5 seconds
- [ ] Files over 1MB (or `async: true`) queued as `genjobs` — returns `{ jobid, status: "queued", estimatedseconds }` immediately
- [ ] PDFs support: text with fonts, tables, images (URL or base64), headers/footers, page numbers, multi-page layout
- [ ] System templates bundled: `report-standard`, `invoice-basic`, `summary-onecolumn`

### FR-002 — Excel generation

**Acceptance Criteria**:

- [ ] `POST /api/gen/excel` accepts `{ template?, sheets: [{ name, columns: [{ key, header, width? }], rows: [...] }], options?, async?, callbackurl? }`
- [ ] Without `template`, engine applies default styling: bold header row, alternating row fill, auto-fit column widths
- [ ] Synchronous for up to 10,000 rows (within 10 seconds); async for larger
- [ ] Supports: multiple sheets, cell formatting, formulas, freeze top row, auto-filter on header row
- [ ] System templates: `data-export-standard`, `financial-summary`

### FR-003 — PowerPoint generation

**Acceptance Criteria**:

- [ ] `POST /api/gen/presentation` accepts `{ template?, slides: [{ title, content, layout?, imageurl? }], options?, async?, callbackurl? }`
- [ ] `content` per slide: text (bold/italic), bullet lists, table data, or image URL
- [ ] Synchronous for 1–5 slides (target 15 seconds); async for > 5 slides
- [ ] System templates: `pitch-deck`, `status-update`, `technical-report`
- [ ] Each template defines: background, fonts, title placement, content area, logo position

### FR-004 — AI image generation

**Acceptance Criteria**:

- [ ] `POST /api/gen/image` accepts `{ prompt, size?, quality?, style? }`. Default: `1024x1024`, `standard` quality
- [ ] Default provider: OpenAI DALL-E 3 via `openai` npm package. Configurable via `GEN_IMAGE_PROVIDER` and `GEN_IMAGE_API_KEY` env vars
- [ ] Always synchronous — returns `{ fileurl, filename, prompt, model, generatedat }` within 15 seconds
- [ ] Prompt policy violation from provider → HTTP 422 `{ error: "prompt_rejected", reason }` — no file created
- [ ] Per-user daily limit: 10 images (configurable via `GEN_IMAGE_DAILY_LIMIT`). Excess requests return HTTP 429
- [ ] If no image provider is configured: HTTP 503 `{ error: "image_generation_not_configured" }` — never returns a placeholder

### FR-005 — Async job queue and status polling

**Acceptance Criteria**:

- [ ] `GET /api/gen/jobs/:id` returns: `{ jobid, status, format, fileurl?, sizebytes?, errormessage?, estimatedseconds, startedat?, completedat? }`
- [ ] On completion with `callbackurl`: engine POSTs `{ jobid, status, fileurl?, errormessage? }` — 3 retry attempts with exponential backoff
- [ ] Jobs queued but not started within 1 hour move to `status: "expired"`
- [ ] Maximum concurrent jobs: configurable via `GEN_MAX_CONCURRENT_JOBS` (default: 5). When at capacity, new requests queue behind existing ones

### FR-006 — File storage, download, and expiry

**Acceptance Criteria**:

- [ ] Files stored in S3-compatible object storage (production) or local filesystem (development). Config: `GEN_STORAGE_PROVIDER`, `GEN_STORAGE_BUCKET`, `GEN_STORAGE_ENDPOINT`
- [ ] `fileurl` values include a short-lived signed token (24-hour validity). Unsigned access to storage is blocked
- [ ] `GET /api/gen/files/:id` validates the signed token and serves file with `Content-Disposition: attachment`
- [ ] Files expire after `GEN_FILE_TTL_DAYS` (default: 7). Daily cleanup job deletes expired `genfiles` rows and storage objects
- [ ] `DELETE /api/gen/files/:id` lets the file owner delete a file before natural expiry

### FR-007 — Document template management

**Acceptance Criteria**:

- [ ] `GET /api/gen/templates` returns all templates (system + org-specific) with key, format, name, description, and `dataschema`
- [ ] `POST /api/gen/templates` (admin only) creates a custom template: key, format, name, description, `dataschema` (JSON Schema), template file upload
- [ ] `PATCH /api/gen/templates/:key` (admin only) updates a custom template. System templates are read-only — attempts return HTTP 403
- [ ] `DELETE /api/gen/templates/:key` (admin only) removes a custom template. System templates cannot be deleted
- [ ] Template `key` must be unique per org. System keys are globally reserved (prefixed `system:`)

### FR-009 — AI image edit (image-to-image)

In addition to text-to-image (FR-004), the engine MUST expose an image-to-image endpoint that takes a source image plus a style prompt and returns a stylised output. This is a separate endpoint because not every image provider supports image edits — the engine returns a clear capability error rather than silently falling back.

**Acceptance Criteria**:

- [ ] `POST /api/gen/image-edit` accepts a multipart upload: `image` (source — JPG/PNG/WebP, ≤ 10MB), `prompt` (text instruction), and optional `size` (default `1024x1024`), `background` (`"opaque"` \| `"transparent"`, default `"opaque"`), `mask?` (optional inpainting mask image)
- [ ] **Provider capability check**: each registered image provider declares `supportsImageEdit: boolean`. The default OpenAI provider routes to `POST /v1/images/edits` with `model: "gpt-image-1"`. If `GEN_IMAGE_PROVIDER` is configured to a provider with `supportsImageEdit: false` (e.g., a stable-diffusion-only deployment that hasn't enabled the img2img endpoint), the engine returns HTTP 501 `{ error: "image_edit_not_supported_by_provider", provider }` — no file created
- [ ] If no image provider is configured at all: HTTP 503 `{ error: "image_generation_not_configured" }` — same error as FR-004
- [ ] Synchronous when source image ≤ 2MB — returns `{ fileurl, filename, prompt, model, generatedat }` within 30 seconds. Asynchronous for sources over 2MB — returns `{ jobid, status: "queued", estimatedseconds }` and posts to `callbackurl` on completion (same job mechanism as FR-005)
- [ ] Prompt policy violation from provider → HTTP 422 `{ error: "prompt_rejected", reason }` — no file created
- [ ] **Shared daily limit**: image-edit calls count against the SAME `GEN_IMAGE_DAILY_LIMIT` bucket as FR-004 text-to-image generations (default 10/user/day). When exceeded, HTTP 429 with `{ error: "daily_limit_reached" }`. There is no separate cap for edits
- [ ] Source image is buffered in memory only — not written to long-term storage. The output file is stored normally per FR-006 (signed URL, expiry, etc.)
- [ ] Each image-edit invocation writes a `genlog` row exactly like FR-004 — `format: "image"`, `prompttruncated` (first 200 chars of `prompt`), `sizebytes`, `latencyms`. The source image is never logged
- [ ] Caller `userid` is included in the `genlog` row even when the call originates from another scope (e.g., spec 007 avatar conversion forwards the end-user's `userid`)

### FR-008 — Generation log

**Acceptance Criteria**:

- [ ] Every `POST /api/gen/*` request creates a `genlog` row: `userid`, `format`, `templatekey?`, `prompttruncated?` (first 200 chars only), `jobid?`, `status`, `sizebytes?`, `latencyms`, `createdat`
- [ ] `GET /api/gen/log` (admin only) returns paginated log — filterable by `userid`, `format`, `status`, date range
- [ ] Log rows purged after 90 days by the daily cleanup job

---

## Data Requirements

| Table | Purpose |
| --- | --- |
| `gentemplates` | Document templates — key, format, data schema, template file reference |
| `genjobs` | Async generation jobs — status, format, callback URL, output file reference |
| `genfiles` | Generated file metadata — storage key, format, expiry |
| `genlog` | Generation audit log — per-request record, 90-day retention |

### `gentemplates`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `key` | text | Unique template identifier — UNIQUE globally |
| `format` | text | `"pdf"` \| `"excel"` \| `"pptx"` |
| `name` | text | Human-readable label |
| `description` | text | |
| `dataschema` | jsonb | JSON Schema callers must satisfy |
| `templatefilekey` | text | Storage path of template file |
| `issystem` | boolean | True for bundled system templates — read-only |
| `createdat` | timestamptz | |
| `updatedat` | timestamptz | |

### `genjobs`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK — the `jobid` returned to callers |
| `userid` | text | Requesting user or system actor |
| `format` | text | `"pdf"` \| `"excel"` \| `"pptx"` \| `"image"` |
| `templatekey` | text | Nullable |
| `callbackurl` | text | Nullable |
| `status` | text | `"queued"` \| `"processing"` \| `"complete"` \| `"error"` \| `"expired"` |
| `fileid` | uuid | Nullable FK → genfiles.id |
| `errormessage` | text | Nullable |
| `estimatedseconds` | integer | |
| `startedat` | timestamptz | Nullable |
| `completedat` | timestamptz | Nullable |
| `createdat` | timestamptz | |
| `expiresat` | timestamptz | `createdat + 1 hour` |

### `genfiles`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `userid` | text | |
| `format` | text | |
| `filename` | text | e.g., `Q2-engineering-2026-05-10.pptx` |
| `sizebytes` | integer | |
| `storagekey` | text | Internal path — never a public URL |
| `createdat` | timestamptz | |
| `expiresat` | timestamptz | `createdat + GEN_FILE_TTL_DAYS days` |

### `genlog`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `userid` | text | |
| `format` | text | |
| `templatekey` | text | Nullable |
| `prompttruncated` | text | Nullable — first 200 chars of image prompt only |
| `jobid` | uuid | Nullable |
| `status` | text | Final status |
| `sizebytes` | integer | Nullable |
| `latencyms` | integer | |
| `createdat` | timestamptz | |
| `expiresat` | timestamptz | `createdat + 90 days` |

---

## API Routes

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/gen/pdf` | Generate PDF — sync if small, async job if large |
| POST | `/api/gen/excel` | Generate Excel — sync for ≤ 10k rows |
| POST | `/api/gen/presentation` | Generate PPTX — sync for ≤ 5 slides, async otherwise |
| POST | `/api/gen/image` | Generate AI image from a text prompt — always synchronous |
| POST | `/api/gen/image-edit` | Image-to-image — multipart `{ image, prompt, size?, background?, mask? }`. Sync ≤ 2MB; async otherwise. Returns 501 if the configured provider does not support image edits |
| GET | `/api/gen/jobs/:id` | Poll async job status |
| GET | `/api/gen/files/:id` | Download generated file — authenticated signed URL |
| DELETE | `/api/gen/files/:id` | Delete file before natural expiry |
| GET | `/api/gen/templates` | List all templates with data schema |
| GET | `/api/gen/templates/:key` | Template detail |
| POST | `/api/gen/templates` | Admin only — create custom template |
| PATCH | `/api/gen/templates/:key` | Admin only — update custom template |
| DELETE | `/api/gen/templates/:key` | Admin only — delete custom template |
| GET | `/api/gen/log` | Admin only — paginated generation log |

---

## Frontend Components

The engine is primarily a backend service. Only a few shared components are needed — used by spec 002, spec 004, and spec 005 wherever files are delivered.

### Shared Result Components

| Component | Path | Description |
| --- | --- | --- |
| `GeneratedFileCard` | `src/ui/components/gen/GeneratedFileCard.tsx` | Rendered in AI Chat and PA channel when a file is ready — file type icon, filename, size, Download button, expiry note ("Link expires in 6 days"). |
| `GenerationProgressCard` | `src/ui/components/gen/GenerationProgressCard.tsx` | Shown during async jobs — format icon, "Generating your [PDF/Excel/presentation]…", estimated time remaining, progress bar. Polls `GET /api/gen/jobs/:id` every 3 seconds. Transitions to `GeneratedFileCard` on completion. |
| `GeneratedImageCard` | `src/ui/components/gen/GeneratedImageCard.tsx` | Inline image result — preview thumbnail, prompt text (truncated), model label, full-size view button, Download button. |

### Template Management (Admin)

| Component | Path | Description |
| --- | --- | --- |
| `GenTemplateManager` | `src/ui/components/gen/GenTemplateManager.tsx` | Admin page — list of all templates with format badge and system/custom label. Create, edit, delete custom templates. System templates read-only. |
| `GenTemplateForm` | `src/ui/components/gen/GenTemplateForm.tsx` | Create/edit form — key, format, name, description, JSON Schema editor for `dataschema`, template file upload. |

---

## Success Criteria

1. PDF generated from `report-standard` template with 3 sections of content within 5 seconds.
2. Excel file with 1,000 rows exported with headers, formatting, and auto-filter within 10 seconds.
3. PPTX with 8 slides generated as an async job, delivered via callback URL, within 30 seconds.
4. AI image generated from a text prompt and delivered inline in the chat within 15 seconds.
5. Custom template registered by an admin is usable by callers within 60 seconds.
6. Generated files are served via authenticated download links. Anonymous access returns 403.

---

## Key Entities

| Entity | Location | Description |
| --- | --- | --- |
| `GenTemplate` | `gentemplates` | Reusable document layout — system or org-defined. Callers reference by `key`. |
| `GenJob` | `genjobs` | Async generation request — tracks status, calls back on completion. |
| `GenFile` | `genfiles` | Generated output file — authenticated URL, expires after TTL. |
| `GenLog` | `genlog` | One audit record per request — 90-day retention. Image prompts truncated to 200 chars. |

---

## Constraints

- All files MUST be served via authenticated signed URLs — no unsigned public storage access.
- Image prompts stored in `genlog` are truncated to 200 characters. Full prompts are never persisted.
- System templates are read-only via all API routes.
- If generation fails, no partial file is stored. `genjobs.status` is set to `"error"`.
- S3-compatible storage is required in production. Local filesystem is development-only.
- If no image provider is configured, `POST /api/gen/image` returns HTTP 503 — no placeholder fallback.
- This engine generates files only. It does not parse uploaded documents (that is spec 005 attachment handling).

---

## Notes

### Libraries

| Format | Library | License |
| --- | --- | --- |
| PDF | `@react-pdf/renderer` | MIT — JSX-based: `<Page>`, `<Text>`, `<Image>` components |
| Excel | `exceljs` | MIT — full XLSX authoring with styles, formulas, charts |
| PPTX | `pptxgenjs` | MIT — programmatic slide generation |
| Image | `openai` (DALL-E 3) | MIT — `client.images.generate(...)` |

Fallback for complex PDF layouts: `puppeteer` (HTML-to-PDF) — heavier but supports any CSS layout.

### Integration points

| Caller | How they use this engine |
| --- | --- |
| Spec 002 (PA) | `POST /api/gen/presentation` or `/pdf` after assembling content from skills. Uses `callbackurl` for async result delivery into the PA session. |
| Spec 004 (Studio) | `POST /api/gen/pdf` to export skill/agent definitions. |
| Spec 005 (AI Chat) | `POST /api/gen/pdf` for session PDF export (FR-007). |
| Spec 007 (Avatar) | `POST /api/gen/image-edit` (FR-009 here) for photo-to-avatar style conversion. The caller's `userid` is forwarded for `genlog` and daily-limit attribution. |
| Skills (spec 004) | Skills can call this engine directly and return `fileurl` to the PA. |

### Risks

- **`@react-pdf/renderer` layout limits**: multi-column and floating elements are not supported. For complex templates, use `puppeteer` fallback.
- **DALL-E 3 cost**: per-image billing. The 10-image daily per-user limit (`GEN_IMAGE_DAILY_LIMIT`) is the primary cost control.
- **Large document generation time**: hundreds of slides or tens of thousands of rows may take several minutes. Job expiry and estimated time fields must be calibrated against benchmarks before production.

---

## Clarifications

### Session 2026-05-10

| # | Question | Decision |
| --- | --- | --- |
| 1 | Output formats? | PDF, Excel (.xlsx), PowerPoint (.pptx), AI images (PNG/JPG) |
| 2 | Libraries? | `@react-pdf/renderer`, `exceljs`, `pptxgenjs`, `openai` — all MIT |
| 3 | Sync or async? | Small: sync. Large: async job with polling and optional callback. |
| 4 | File storage? | S3-compatible (production), local filesystem (dev). Authenticated signed URLs only. |
| 5 | File retention? | 7 days default (`GEN_FILE_TTL_DAYS`) |
| 6 | Who creates templates? | Admin only for custom templates. System templates are read-only. |
| 7 | Image edit (image-to-image) included? | Yes — FR-009. Separate endpoint from FR-004 text-to-image. Uses the same provider abstraction; returns HTTP 501 when the configured provider lacks `supportsImageEdit`. |
| 8 | Separate daily limit for image edits? | No. Shared `GEN_IMAGE_DAILY_LIMIT` bucket — text-to-image and image-edit both count against it. |
