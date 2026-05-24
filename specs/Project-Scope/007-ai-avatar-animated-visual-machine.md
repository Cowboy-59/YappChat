# Spec 007: AI Avatar

**Spec Number**: 007
**Status**: `draft`
**Created**: 2026-05-10
**Depends On**: Spec 002 (Personal Assistant), Spec 003 (WebSocket Engine), Spec 005 (AI Chat)
**Source**: `specs/Project-Scope/007-ai-avatar-animated-visual-machine.md`

---

## Overview

The AI Avatar gives the Personal Assistant (spec 002) a visual identity — an animated character that represents the assistant across YappChat. The avatar reacts to the assistant's state in real time: idle when waiting, animated ears when listening, pulsing when thinking, speaking animation when the assistant is responding.

The starter avatar library ships with **Molty** — the pixel lobster from OpenClaw (already in the YappChat workspace at `packages/openclaw/docs/assets/pixel-lobster.svg`) — plus **30 animals from the Kenney Animal Pack Redux** (CC0 public domain, SVG format). Admins pick one as the deployment-wide default; users can pick their own personal avatar from the same library.

Avatars are used in four places across YappChat:

- **PA sidebar avatar** — the small status-bearing icon in the navigation sidebar (spec 002)
- **AIChatPanel header** — displayed large at the top of the spec 005 AI Chat panel
- **OrgDirectoryTree** — the PA appears in the "Assistants" group like any org member (spec 001)
- **Video call tiles** — if the PA is a participant in a call (spec 001 FR-007)

The avatar is purely presentational — it reads state from the PA's real-time status (spec 003 WebSocket `pa.status` events) and animates accordingly. No AI logic lives here.

---

## Starter Avatar Library

### Default: Molty the Pixel Lobster

| Item | Value |
| --- | --- |
| **Name** | Molty |
| **File** | `packages/openclaw/docs/assets/pixel-lobster.svg` |
| **Size** | 16×16 pixel art SVG |
| **License** | MIT (OpenClaw project) |
| **Lore** | The original OpenClaw mascot — a lobster chosen because molting is how lobsters grow. Already in the YappChat workspace. |

### Kenney Animal Pack Redux (Primary Collection)

| Item | Value |
| --- | --- |
| **Source** | [kenney.nl/assets/animal-pack-redux](https://kenney.nl/assets/animal-pack-redux) |
| **License** | CC0 (Public Domain — no attribution required, full commercial use) |
| **Animals** | 30 base animals × 8 style variants = 240 total sprites |
| **Format** | PNG + SVG vector versions available |
| **Size** | Multiple sizes; SVG is resolution-independent |
| **Selected animals for v1** | Cat, Dog, Fox, Rabbit, Penguin, Panda, Parrot, Monkey, Elephant, Pig (10 of 30 — rest available as expansion) |

### Supplementary: Vairus Studio Animals

| Item | Value |
| --- | --- |
| **Source** | [opengameart.org/content/pixel-animals](https://opengameart.org/content/pixel-animals) |
| **License** | CC0 (Public Domain) |
| **Animals** | 10 animals with color variants |
| **Format** | PNG sprite sheets, 16×16 base grid |
| **Animations** | Walk, eat, idle |

### Starter library (v1 — 12 avatars total)

| Key | Name | Source | Format |
| --- | --- | --- | --- |
| `molty` | Molty (Lobster) | OpenClaw | 16×16 SVG |
| `cat` | Cat | Kenney | SVG |
| `dog` | Dog | Kenney | SVG |
| `fox` | Fox | Kenney | SVG |
| `rabbit` | Rabbit | Kenney | SVG |
| `penguin` | Penguin | Kenney | SVG |
| `panda` | Panda | Kenney | SVG |
| `parrot` | Parrot | Kenney | SVG |
| `monkey` | Monkey | Kenney | SVG |
| `elephant` | Elephant | Kenney | SVG |
| `pig` | Pig | Kenney | SVG |
| `frog` | Frog | Vairus | 16×16 PNG |

All 12 are CC0 or MIT — no attribution required, safe for commercial use.

---

## Avatar States and Animations

The avatar has 5 named states. Each state has a CSS animation applied to the image element. States are driven by spec 003 `pa.status` WebSocket events.

| State | Trigger | Animation |
| --- | --- | --- |
| `idle` | PA is waiting, no active task | Gentle vertical float (2px up/down, 3s ease-in-out loop) + slow blink (every 4s) |
| `listening` | User is speaking (voice input active) | Ears/top of avatar pulse upward; subtle glow ring expands and contracts (1.5s loop) |
| `thinking` | PA received input, waiting for AI response | Three-dot shimmer overlay below avatar; avatar itself slowly rotates ±5° (2s ease-in-out) |
| `speaking` | PA is streaming a response | Avatar bounces slightly on each word (driven by response token events); speech wave arcs appear beside mouth area |
| `error` | PA returned an error | Avatar droops (CSS transform rotate + translate downward); muted colour overlay |

Transitions between states are 200ms cross-fade. The animation library is CSS keyframes only — no external animation runtime required in v1.

---

## Core Design

| Element | Value |
| --- | --- |
| **Primary Actor** | YappChat end user |
| **Secondary Actors** | YappChat administrator (configures deployment avatar), Org admin (configures company avatar) |
| **Key Value** | The PA has a visual face that responds in real time — users feel they are talking to a character, not submitting forms. |
| **Scope Boundary** | IN SCOPE: avatar image library (12 starters); avatar state animations (5 states); PA sidebar avatar; PAFullChatView header avatar; OrgDirectoryTree avatar; per-user avatar selection; per-company default avatar; admin avatar upload; voice input animation (listening state); speaking animation driven by token streaming; avatar persona name and vibe text. OUT OF SCOPE: 3D avatars; full lip-sync with TTS audio waveform; video-based avatars; generative AI avatar creation; avatar marketplace/store; VR/AR avatar rendering. |

---

## User Scenarios & Testing

### US1 — Avatar reacts to PA thinking and speaking

**Actor**: YappChat end user

**Scenario**:

1. User opens the AI Chat panel (spec 005 `AIChatPanel`). The avatar is displayed large in the panel header — Molty the lobster, `idle` state, gently floating.
2. User sends a message. The avatar instantly transitions to `thinking` state: slow rotation animation, dots pulsing below it.
3. First streaming token arrives. Avatar transitions to `speaking` state: small bounce on each token, speech arcs appear beside it.
4. Response finishes. Avatar returns to `idle` — gentle float resumes.

**Expected outcome**: State transitions happen within 200ms of the triggering event. The avatar visually reinforces what the PA is doing without distracting from the text response.

### US2 — User picks a personal avatar

**Actor**: YappChat end user

**Scenario**:

1. User opens PA settings, clicks **Choose avatar**.
2. `AvatarPicker` opens — a grid of the 12 starter avatars, each with its name below it. The current selection is highlighted.
3. User clicks the Fox avatar. A preview shows the Fox in all 5 animation states cycling through.
4. User confirms. From now on their PA uses the Fox avatar everywhere — sidebar, chat header, org directory.

**Expected outcome**: Avatar change takes effect immediately across all views. No page reload needed.

### US3 — Company admin sets deployment-wide default avatar

**Actor**: YappChat administrator

**Scenario**:

1. Admin opens company settings and navigates to **AI Assistant → Avatar**.
2. Sees the 12 starter avatars plus an **Upload custom** option.
3. Admin selects "Panda" as the company default. This sets `companyavatar` in `avatarconfigs`.
4. For any user who has not chosen a personal avatar, the Panda now appears as their PA avatar.
5. Admin also uploads a custom SVG — their company's mascot. It is validated (square, ≤ 512KB, SVG/PNG/WebP) and added to the library as a company-specific avatar.

**Expected outcome**: Company default applies to all users without a personal avatar selection. Custom upload validated and usable within 30 seconds.

### US4 — Listening animation activates during voice input

**Actor**: YappChat end user

**Scenario**:

1. User clicks the microphone button in the AI Chat composer (spec 005 FR-005).
2. The avatar immediately transitions from `idle` to `listening` — glow ring expands, ears animate upward.
3. While the user is speaking, the listening animation loops.
4. User stops speaking. After 1.5 seconds of silence, voice recognition completes and the message is sent. Avatar transitions to `thinking`.

**Expected outcome**: `listening` state activates within 100ms of the microphone opening. The visual feedback confirms the avatar is actively receiving input.

---

## Functional Requirements

### FR-001 — Avatar image library and storage

The system MUST ship a curated library of 12 starter avatars (Molty + 10 Kenney + 1 Vairus) stored in the YappChat static assets directory, served from the same origin.

**Acceptance Criteria**:

- [ ] All starter avatar files are stored in `src/assets/avatars/` — SVGs for vector avatars, PNGs accepted for raster avatars
- [ ] `GET /api/avatar/library` returns the full list of available avatars: `{ key, name, source, format, fileurl }`
- [ ] File URLs are served from the YappChat static asset server — not from external CDNs. Avatars load without an internet connection in self-hosted deployments
- [ ] Custom uploaded avatars are stored in the same file storage as spec 006 generated files (`genfiles` store) and returned alongside the built-in library
- [ ] **Format and size rules**:
  - SVG: no pixel dimension constraint — vector scales to any display size without quality loss
  - PNG / WebP / GIF: accepted only if ≤ 64×64 pixels. If a raster image larger than 64×64 is submitted (upload or URL import), the server **automatically resizes it to 64×64** before storing — the caller receives the resized file, not an error
  - Maximum file size: 512KB (checked after any resize)
  - Aspect ratio: square ±10% (enforced before resize; non-square images are rejected with HTTP 422)
- [ ] The 64×64 cap is the **largest accepted raster size**. PNG avatars of any size ≤ 64×64 are stored as-is; larger ones are silently downsampled to 64×64 using nearest-neighbour interpolation (preserves pixel art detail)

### FR-002 — Per-user avatar selection and per-company default

**Acceptance Criteria**:

- [ ] `PATCH /api/avatar/user` sets the authenticated user's chosen avatar — `{ avatarkey }` where `avatarkey` references the library. Stored in `avatarconfigs` with `scope: "user"`
- [ ] `PATCH /api/avatar/company` (admin only) sets the company-wide default avatar — `{ avatarkey }`. Stored in `avatarconfigs` with `scope: "company"`
- [ ] Resolution order: user selection → company default → system default (`molty`)
- [ ] Avatar change propagates immediately via spec 003 WebSocket `pa.status` event — no page reload needed. All open sessions update within 1 second
- [ ] `GET /api/avatar/current` returns the resolved avatar for the authenticated user: `{ key, name, fileurl, source }`

### FR-003 — Avatar state machine, animation, and display sizes

**Allowed display sizes** — the `AvatarDisplay` component accepts only these four values for its `size` prop. No other sizes are permitted.

| Size | Value | Used in |
| --- | --- | --- |
| `24` | 24×24 px | Compact rows — chat message sender icon, small directory entries |
| `32` | 32×32 px | OrgDirectoryTree node, org member card thumbnail |
| `64` | 64×64 px | PA sidebar avatar, standard picker grid cells |
| `128` | 128×128 px | AIChatPanel header (large featured avatar) — spec 005 |

Passing any other numeric value is a TypeScript compile error — the `size` prop is typed as `24 | 32 | 64 | 128`.

**Acceptance Criteria**:

- [ ] `AvatarDisplay` component accepts `avatarkey`, `state` (`idle` | `listening` | `thinking` | `speaking` | `error`), and `size` (`24 | 32 | 64 | 128`) props. The `size` prop is **required** — there is no default
- [ ] The component renders the image element at exactly the specified `size` via `width` and `height` CSS — SVGs scale perfectly at all four sizes; PNGs are rendered at their stored resolution and upscaled with `image-rendering: pixelated` if displayed larger than their native size
- [ ] Each state applies a named CSS animation class: `avatar-idle`, `avatar-listening`, `avatar-thinking`, `avatar-speaking`, `avatar-error` — defined in `src/ui/styles/avatar-animations.css`
- [ ] State transitions use a 200ms CSS cross-fade (`transition: opacity 200ms ease`)
- [ ] `speaking` animation is driven by token events from spec 003 (`pa.status` type `responding`) — a light bounce applied on each token arrival (debounced, max 10 bounces/second)
- [ ] `listening` animation activates when the browser `SpeechRecognition` API fires `onstart` (spec 005 FR-005)
- [ ] `thinking` activates when the PA session message POST is sent and before the first SSE token arrives
- [ ] State is derived locally in the component from WebSocket events — no server round-trip for animation updates

### FR-004 — Avatar displayed consistently across all surfaces

The same avatar and state animation MUST appear in every location where the PA is visible.

**Acceptance Criteria**:

- [ ] **PA sidebar** (`PAAvatar`, spec 002): `<AvatarDisplay size={64} />` with status badge overlaid in the corner
- [ ] **AIChatPanel header** (spec 005): `<AvatarDisplay size={128} />` — largest size, prominently featured at the top. PA persona name (from `avatarconfigs.personaname`) and active provider label shown beneath it
- [ ] **OrgDirectoryTree** (`OrgNode`, spec 001): `<AvatarDisplay size={32} />` with status dot
- [ ] **Video call tile** (`VideoTile`, spec 001): `<AvatarDisplay size={64} />` with speaking-animation overlay when the PA is responding
- [ ] **Chat message sender icon**: `<AvatarDisplay size={24} />` — used inline beside each PA message bubble in the thread
- [ ] **AvatarPicker grid cells**: `<AvatarDisplay size={64} />` — consistent grid layout in the picker
- [ ] All surfaces read the same resolved `avatarkey` from `GET /api/avatar/current` — cached client-side, updated via WebSocket on change
- [ ] No surface may render the avatar at any size other than `24`, `32`, `64`, or `128`. If a new surface needs an in-between size, the allowed sizes list in FR-003 must be updated in a spec change — not worked around in code

### FR-005 — Avatar persona — name and vibe

The avatar is more than an image — it has a name and a personality vibe displayed alongside it.

**Acceptance Criteria**:

- [ ] `avatarconfigs` stores `personaname` (the assistant's display name, e.g., "Molty", "Archie") and `personavibe` (a short personality description, e.g., "Warm and direct") per user and per company scope
- [ ] Persona name shown in spec 005 `AIChatPanel` header and `ChatEmptyState` prompt: "What can **{personaname}** help you with?"
- [ ] Spec 002 reads PA persona name and resolved avatar from `GET /api/avatar/current` at runtime — `paconfigs` does NOT carry its own `name` or `avatarurl`. This is the single source of truth for the PA's identity
- [ ] `PATCH /api/avatar/user` and `PATCH /api/avatar/company` accept optional `{ personaname, personavibe }` fields
- [ ] Persona vibe is displayed as a subtitle in the PA settings panel — users can edit it inline
- [ ] The OpenClaw identity concept (creature + vibe from `IDENTITY.md` template at `packages/openclaw/docs/reference/templates/IDENTITY.md`) is the inspiration; the same fields are used here

### FR-006 — Avatar import (file upload and URL)

Any user MUST be able to import their own avatar — by uploading a file from their device or by pasting a URL to an image hosted elsewhere. Imported avatars appear in the `AvatarPicker` alongside the built-in library and can be selected immediately.

**Import methods**:

| Method | How | When to use |
| --- | --- | --- |
| **File upload** | Drag-and-drop or file picker | Local image — PNG, SVG, WebP, GIF |
| **URL import** | Paste an image URL | Image already hosted (Gravatar, GitHub profile, external CDN) |

**Acceptance Criteria**:

- [ ] `POST /api/avatar/upload` accepts a multipart file upload. Validated: square aspect ratio (±10%), ≤ 512KB, formats SVG/PNG/WebP/GIF. Stored in file store; registered with `source: "custom"`, a `storagekey`, and a user-assigned `label` (defaults to filename without extension)
- [ ] `POST /api/avatar/import-url` accepts `{ url, label? }`. The server fetches the image, validates it (same rules as file upload), stores it internally, and returns `{ avatarkey, fileurl, label, sizebytes }`. The external URL is never stored — the image is always copied internally so the avatar survives the source going offline
- [ ] **SSRF defence**: the URL fetcher MUST reject any of the following BEFORE making the request, and re-validate AFTER DNS resolution:
  - Schemes other than `https` (http permitted only when `ALLOW_HTTP_AVATAR_IMPORTS=true` in dev)
  - Hostnames resolving to RFC 1918 private ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), loopback (`127.0.0.0/8`, `::1`), link-local (`169.254.0.0/16`, `fe80::/10`), CGNAT (`100.64.0.0/10`), unique-local IPv6 (`fc00::/7`), or any IP literal in those ranges supplied directly in the URL
  - Cloud metadata endpoints — explicit deny-list including `169.254.169.254`, `metadata.google.internal`, `metadata.azure.com`, plus any A/AAAA result that resolves to those hosts
  - The fetcher MUST resolve the hostname ONCE, validate the resolved IP, then connect by that IP with the `Host` header set explicitly — preventing DNS rebinding from swapping the IP between validation and connect
  - Maximum 2 HTTP redirects; each redirect target re-runs the full validation
  - Fetch timeout: 10 seconds total, 5 second connect
  - Response `Content-Type` must start with `image/` (allow-list: `image/png`, `image/jpeg`, `image/webp`, `image/gif`, `image/svg+xml`); other types rejected with HTTP 422 `{ error: "url_not_an_image" }`
  - Maximum response size: 10MB (matches FR-006 file-upload cap); larger responses are aborted mid-stream
- [ ] Per-user rate limit on URL imports: 20 imports per hour per user. Excess returns HTTP 429. Independent of `GEN_IMAGE_DAILY_LIMIT` (that bucket is for AI generation; URL imports are pure fetches)
- [ ] Both routes return `{ avatarkey, fileurl, label, sizebytes }` on success. `avatarkey` is a UUID assigned at import time
- [ ] `GET /api/avatar/library` returns `{ builtin: AvatarLibraryItem[], mine: AvatarLibraryItem[] }` — `mine` contains all avatars imported by the authenticated user plus any company-level custom avatars uploaded by admins
- [ ] Imported avatars appear in `GET /api/avatar/library` immediately under **My Avatars**, distinct from the built-in library
- [ ] `DELETE /api/avatar/imported/:key` removes an imported avatar. If it is the user's current selection, avatar reverts to `molty` automatically
- [ ] A user can revert to any built-in avatar at any time via `PATCH /api/avatar/user` with a built-in `avatarkey`
- [ ] The `AvatarPicker` shows an **Import** button that opens `AvatarImportModal` with two tabs: "Upload file" and "Paste URL". Validation errors shown inline before committing

### FR-007 — AI photo-to-avatar style conversion

Any user MUST be able to upload a regular photograph and have it converted into a stylised avatar using AI image-to-image generation — producing a 128×128 PNG with a transparent background, ready to set as their PA avatar. The experience mirrors what ChatGPT does with its avatar generation feature.

**Technology**: photo-to-avatar conversion is delegated to spec 006's image generation pipeline. Spec 006 owns the provider abstraction (`GEN_IMAGE_PROVIDER`); this spec calls `POST /api/gen/image-edit` with the source image and a style prompt. Spec 006's default provider (OpenAI `gpt-image-1` via `POST /v1/images/edits`) supports image-to-image; if a deployment configures a non-OpenAI image provider, spec 006 returns HTTP 501 `{ error: "image_edit_not_supported_by_provider" }` and this spec surfaces a friendly error in `AvatarConvertModal`. The endpoint accepts an image input + text prompt and returns a stylised image; the output is resized server-side to 128×128 with transparent background before storage.

> Spec 006 dependency: the existing `POST /api/gen/image` endpoint generates from a text prompt only. This scope requires a NEW spec 006 endpoint `POST /api/gen/image-edit` that accepts a source image + prompt. Adding it is a small extension to spec 006 FR-004 — a follow-on spec edit.

**Available conversion styles**:

| Style key | Label | Prompt used |
| --- | --- | --- |
| `pixar` | Pixar | "Convert this photo into a Pixar 3D animated movie character portrait. Expressive features, vibrant colours, smooth 3D rendering, transparent background." |
| `cartoon` | Cartoon | "Convert this photo into a flat 2D cartoon avatar. Bold black outlines, vibrant solid colours, simplified friendly features, transparent background." |
| `anime` | Anime | "Convert this photo into an anime-style portrait. Large expressive eyes, clean line art, soft shading, transparent background." |
| `sketch` | Sketch | "Convert this photo into an artistic pencil sketch portrait. Fine line art, cross-hatched shading, transparent background." |
| `watercolor` | Watercolor | "Convert this photo into a soft watercolour illustration portrait. Painterly texture, gentle colours, transparent background." |

**Acceptance Criteria**:

- [ ] `POST /api/avatar/convert` accepts a multipart upload: `image` (the source photo — any square-ish image, JPG/PNG/WebP, ≤ 10MB) and `style` (one of the five style keys above). Optional: `label` for naming the resulting avatar.
- [ ] The server validates the image (format, size), then calls spec 006's `POST /api/gen/image-edit` with the source image, the style prompt, `size: "1024x1024"`, and `background: "transparent"`. Spec 006 owns the API key, provider routing, and any retry/throttle behaviour.
- [ ] If spec 006 returns HTTP 501 (provider does not support image edits — e.g., a stable-diffusion-only deployment), `POST /api/avatar/convert` returns HTTP 501 `{ error: "conversion_not_supported_in_this_deployment" }` and `AvatarConvertModal` shows a friendly explanation.
- [ ] The returned 1024×1024 PNG is resized server-side to 128×128 using `sharp` with `fit: "contain"`, `kernel: "nearest"`, and transparent padding — then stored in the file store and registered with `source: "ai-converted"`, the chosen `style`, and the user-assigned `label`.
- [ ] `POST /api/avatar/convert` responds with `{ avatarkey, fileurl, label, style, sizebytes }`. The generated avatar appears immediately in `GET /api/avatar/library` under `mine`.
- [ ] A user may regenerate up to **3 times per source photo** without extra charge — the server tracks attempts in `avatarconversionjobs`. On the 4th attempt the user must upload a new photo.
- [ ] If the image provider's content policy rejects the photo (e.g. real person's face in certain contexts), spec 006 returns HTTP 422 and this scope surfaces the same status with `{ error: "conversion_rejected", reason }` — no avatar is stored.
- [ ] Conversion is asynchronous for photos over 2MB: `POST /api/avatar/convert` returns `{ jobid, status: "processing" }` immediately; the result is delivered via spec 003 WebSocket `pa.notification` event `{ type: "avatar_conversion_complete", avatarkey, fileurl }` when done.
- [ ] `GET /api/avatar/convert/jobs/:jobid` lets the client poll status: `processing` | `complete` | `error`.
- [ ] The `AvatarConvertModal` component guides the user through upload → style selection → preview → confirm. The user sees a loading state while conversion runs, then a preview of the result at 128×128. Two buttons: **Use this avatar** (saves and sets immediately) and **Try again** (up to 3 attempts).
- [ ] **Cost control unification**: conversions count against the SAME `GEN_IMAGE_DAILY_LIMIT` bucket as spec 006 text-to-image generations. The bucket default is 10 calls/user/day (spec 006 FR-004). The 5-conversion separate limit referenced in earlier drafts is REMOVED — there is one shared daily cap. When exceeded, HTTP 429 with `{ error: "daily_limit_reached" }`.

---

## Data Requirements

Minimal — avatar configuration is a thin config layer on top of the existing file storage.

| Table | Purpose |
| --- | --- |
| `avatarconfigs` | Avatar selection per user and per company — key, persona name, vibe |

### `avatarconfigs`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `scope` | text | `"user"` \| `"company"` |
| `ownerid` | text | userid for `"user"` scope; orgid for `"company"` scope |
| `avatarkey` | text | Key from the library (e.g., `molty`, `cat`) or `"custom"` |
| `customstoragekey` | text | Nullable — file store key when `avatarkey = "custom"` |
| `personaname` | text | Display name (e.g., "Molty", "Archie") |
| `personavibe` | text | Nullable — short personality description |
| `updatedat` | timestamptz | |

UNIQUE constraint on `(scope, ownerid)`.

### `avatarconversionjobs`

Tracks AI photo-to-avatar conversion attempts per user per source photo. Used to enforce the 3-regeneration limit.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK — also the `jobid` returned to callers |
| `userid` | text | Requesting user |
| `style` | text | `"pixar"` \| `"cartoon"` \| `"anime"` \| `"sketch"` \| `"watercolor"` |
| `sourcehash` | text | SHA-256 of the uploaded source photo — used to group regeneration attempts |
| `attemptcount` | integer | Number of conversions run against this source photo (max 3) |
| `status` | text | `"processing"` \| `"complete"` \| `"error"` \| `"rejected"` |
| `resultavatarkey` | uuid | Nullable FK — set when `status: "complete"` |
| `errormessage` | text | Nullable |
| `createdat` | timestamptz | |
| `completedat` | timestamptz | Nullable |

---

## API Routes

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/avatar/library` | Full list of available avatars — built-in + company custom |
| GET | `/api/avatar/current` | Resolved avatar for the authenticated user — key, name, fileurl |
| PATCH | `/api/avatar/user` | Set personal avatar + persona — `{ avatarkey, personaname?, personavibe? }` |
| PATCH | `/api/avatar/company` | Admin only — set company default avatar + persona |
| POST | `/api/avatar/upload` | Import avatar from file — multipart upload; returns `{ avatarkey, fileurl, label, sizebytes }` |
| POST | `/api/avatar/import-url` | Import avatar from URL — server fetches, validates, and stores internally |
| DELETE | `/api/avatar/imported/:key` | Remove an imported avatar; reverts to `molty` if it was the active selection |
| GET | `/api/avatar/assets/:key` | Serve a built-in avatar file — static, cacheable |
| POST | `/api/avatar/convert` | AI photo-to-avatar conversion — `{ image (multipart), style, label? }`. Sync for photos ≤ 2MB; async (returns `{ jobid }`) for larger. |
| GET | `/api/avatar/convert/jobs/:id` | Poll async conversion job — returns `{ status, avatarkey?, fileurl?, errormessage? }` |
| GET | `/api/avatar/convert/styles` | List available conversion styles — key, label, description, example thumbnail URL |

---

## Frontend Components

### Core Avatar Component

| Component | Path | Description |
| --- | --- | --- |
| `AvatarDisplay` | `src/ui/components/avatar/AvatarDisplay.tsx` | The single canonical avatar component used everywhere. Props: `avatarkey`, `state` (`idle`\|`listening`\|`thinking`\|`speaking`\|`error`), `size` (px). Applies the correct CSS animation class. Renders an `<img>` (PNG/WebP) or inline `<svg>`. |
| `AvatarStateManager` | `src/ui/components/avatar/AvatarStateManager.tsx` | HOC / context provider that listens to spec 003 `pa.status` WebSocket events and maps them to `AvatarDisplay` `state` prop. Used once at the app root; all `AvatarDisplay` instances subscribe via `useAvatarState()` hook. |

### Picker and Settings

| Component | Path | Description |
| --- | --- | --- |
| `AvatarPicker` | `src/ui/components/avatar/AvatarPicker.tsx` | Grid of all available avatars — two sections: **Library** (built-in 14) and **My Avatars** (imported). Each cell shows the avatar image and name. Clicking one shows `AvatarPreview`. **Import** button in the top-right opens `AvatarImportModal`. Selected avatar is highlighted with a checkmark. |
| `AvatarPreview` | `src/ui/components/avatar/AvatarPreview.tsx` | Cycles through all 5 animation states for a selected avatar so the user can preview how it will look. Confirm/Cancel buttons. |
| `AvatarImportModal` | `src/ui/components/avatar/AvatarImportModal.tsx` | Two-tab modal: **Upload file** (drag-and-drop or file picker, shows preview thumbnail and validation errors inline) and **Paste URL** (text input, live preview of the fetched image with validation status). Both tabs show the label field for naming the imported avatar. Confirm fires the appropriate API route. |
| `AvatarPersonaEditor` | `src/ui/components/avatar/AvatarPersonaEditor.tsx` | Inline editable fields for persona name and vibe — shown in PA settings and company settings. |

### AI Conversion

| Component | Path | Description |
| --- | --- | --- |
| `AvatarConvertModal` | `src/ui/components/avatar/AvatarConvertModal.tsx` | Full conversion flow in a modal — three sequential steps: **1. Upload photo** → **2. Pick style** → **3. Preview & confirm**. Accessible from the `AvatarPicker` via a **"Convert a photo"** button distinct from the Import button. |
| `ConvertPhotoStep` | `src/ui/components/avatar/ConvertPhotoStep.tsx` | Step 1 — drag-and-drop or file picker for the source photo. Shows a square preview crop of the uploaded image. "Continue" advances to style selection. |
| `StylePicker` | `src/ui/components/avatar/StylePicker.tsx` | Step 2 — grid of the 5 conversion styles (Pixar, Cartoon, Anime, Sketch, Watercolor). Each cell shows the style label and a small example thumbnail illustrating the output style. Selected style is highlighted. |
| `ConversionPreview` | `src/ui/components/avatar/ConversionPreview.tsx` | Step 3 — shows the generated 128×128 avatar with the `AvatarStateManager` animation playing (so the user sees how it will look animated). Two buttons: **"Use this avatar"** (saves + sets immediately, closes modal) and **"Try again"** (re-runs conversion with the same photo and style — disabled after 3 attempts, shows "3/3 attempts used"). |
| `ConversionLoadingState` | `src/ui/components/avatar/ConversionLoadingState.tsx` | Shown during the `processing` phase — animated spinner with style-appropriate copy ("Pixar-ifying your photo…", "Cartoonifying…", etc.) and an estimated wait time (10–30 seconds). Polls `GET /api/avatar/convert/jobs/:id` every 3 seconds for async jobs. |

### CSS Animations

`src/ui/styles/avatar-animations.css` — defines all 5 state keyframes:

```css
/* idle: gentle float */
@keyframes avatar-idle-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }

/* listening: glow ring pulse */
@keyframes avatar-listening-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.4); } 50% { box-shadow: 0 0 0 8px rgba(99,102,241,0); } }

/* thinking: gentle tilt */
@keyframes avatar-thinking-tilt { 0%,100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg); } }

/* speaking: bounce on token */
@keyframes avatar-speaking-bounce { 0%,100% { transform: translateY(0); } 40% { transform: translateY(-3px); } }

/* error: droop */
@keyframes avatar-error-droop { 0% { transform: rotate(0deg) translateY(0); } 100% { transform: rotate(-15deg) translateY(4px); } }
```

---

## Success Criteria

1. The avatar transitions between `idle`, `thinking`, `speaking`, and `listening` states within 200ms of the triggering event — no perceptible lag.
2. All starter avatars load correctly in the `AvatarPicker` without any external network request — served from the YappChat static asset server.
3. A user picks a different avatar and it updates across the sidebar, chat header, and org directory within 1 second.
4. The `listening` animation activates within 100ms of the microphone opening (voice input, spec 005 FR-005).
5. A company admin uploads a custom PNG avatar and it is usable as the company default within 30 seconds.
6. On mobile, the avatar renders correctly at its configured size without pixellation (SVGs scale perfectly; PNGs use `image-rendering: pixelated`).
7. A user uploads a photo, selects the Pixar style, and receives a 128×128 transparent-background PNG avatar in the `ConversionPreview` within 30 seconds. Clicking "Use this avatar" sets it immediately across all surfaces.
8. After 3 conversion attempts on the same source photo the "Try again" button is disabled and the user is prompted to upload a new photo.

---

## Key Entities

| Entity | Location | Description |
| --- | --- | --- |
| `AvatarConfig` | `avatarconfigs` table | A user's or company's avatar selection — key, persona name, vibe. One row per scope (user or company). |
| `AvatarLibraryItem` | Static assets + custom uploads | One entry in the avatar catalog — key, name, fileurl, source. Built-ins served from `/api/avatar/assets/:key`; custom uploads served from the file store. |

---

## Constraints

- Built-in avatar files MUST be served from the YappChat server — no external CDN dependency. Self-hosted deployments must work without internet access.
- All 12 starter avatars are CC0 (Kenney, Vairus) or MIT (OpenClaw) — safe for commercial use with no attribution requirement.
- Custom uploaded avatars: square (±10%), ≤ 512KB, SVG/PNG/WebP/GIF only. No JPEG (compression artifacts look bad at small sizes).
- The `AvatarDisplay` component uses CSS animations only — no Lottie, no Framer Motion, no external animation runtime in v1. This keeps the bundle size minimal.
- Avatar state is derived entirely from WebSocket events (spec 003) — the avatar component never calls the PA API directly.
- 3D avatars, full TTS lip-sync, and AI-generated avatars are explicitly out of scope for v1.

---

## Notes

### OpenClaw identity system

The creature + vibe concept is from the OpenClaw `IDENTITY.md` template at `packages/openclaw/docs/reference/templates/IDENTITY.md`. The same fields — creature (the avatar image), vibe (personality description), name — are used here in `avatarconfigs`. This makes the YappChat avatar system feel continuous with the broader OpenClaw agent identity approach.

### Adding more animals from Kenney

The Kenney Animal Pack Redux has 30 animals. Only 10 are in the v1 starter library. The remaining 20 (giraffe, hippo, snake, bear, tiger, lion, etc.) can be added in a future expansion by:

1. Downloading additional SVGs from `kenney.nl/assets/animal-pack-redux` (free, CC0)
2. Adding them to `src/assets/avatars/`
3. Inserting rows into the library registry — no code change required

### Sprite animation upgrade path

The Vairus Studio and Beowulf Mini Animals packs include walk/idle sprite sheet animations. If richer animations are needed in a later version, `AvatarDisplay` can be upgraded to render a sprite sheet canvas instead of a static image + CSS — the same `state` prop interface would remain unchanged.

---

## Clarifications

### Session 2026-05-10

| # | Question | Decision |
| --- | --- | --- |
| 1 | What avatar images ship in v1? | 12 starters: Molty (OpenClaw lobster, MIT), 10 Kenney animals (CC0), 1 Vairus frog (CC0) |
| 2 | What animation technology? | CSS keyframes only — no external runtime. Simple, lightweight, zero dependencies. |
| 3 | How are state transitions driven? | spec 003 WebSocket `pa.status` events → `AvatarStateManager` context → `AvatarDisplay` state prop |
| 4 | Can companies upload custom avatars? | Yes — admin uploads via `POST /api/avatar/upload`, validated, stored in file store |
| 5 | Is 3D or TTS lip-sync in scope? | No — explicitly out of scope for v1 |
| 6 | Where does the avatar appear? | PA sidebar, AIChatPanel header (spec 005), OrgDirectoryTree, video call tiles |
| 7 | Where does the PA's name and avatar live? | `avatarconfigs` (this spec). Spec 002 reads via `GET /api/avatar/current` — `paconfigs` does NOT carry `name` or `avatarurl`. |
| 8 | Is the AI photo conversion provider OpenAI-locked? | No. Conversion delegates to spec 006's image pipeline which abstracts provider via `GEN_IMAGE_PROVIDER`. Non-OpenAI providers that don't support image-edit return HTTP 501 and the UI shows a friendly error. |
| 9 | How many image generations / conversions per day? | One shared `GEN_IMAGE_DAILY_LIMIT` bucket (default 10). Conversions and text-to-image generations both count against it. |
