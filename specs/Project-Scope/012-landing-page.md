# Spec 012: Public Landing Page

**Spec Number**: 012
**Status**: `draft`
**Created**: 2026-05-10
**Depends On**: Spec 011 (auth + role flags — signup/login routing, `useAuth`, `?return=` allow-list), Spec 013 (Admin Console — `/admin` redirect target + `LandingPageConfigPanel` admin UI), Spec 015 (Post-Payment Activation — download links source), Spec 016 (Electron Desktop Client — desktop download artifact for the "security stays at home" callout)
**Source**: `specs/Project-Scope/012-landing-page.md`

---

## Overview

The Public Landing Page is the unauthenticated front door at the deployment root URL — the first thing a prospective user sees before they have an account. It explains what YappChat is, demonstrates the seven product pillars (unified chat, PA, video, agent studio, AI chat, document generation, AI avatar), articulates the privacy positioning ("your data stays on your machine"), displays the two plans (Individual, Corporate), drives signup, and routes returning authenticated users straight through to the app or admin dashboard. It is also the public face of every self-hosted deployment, so company admins can brand it for their employees with logo, colours, hero copy, and contact details.

The page is statically renderable so SEO crawlers see real content without JavaScript, and so first-paint latency is bounded by network transit rather than client-side hydration. The authenticated-user auto-redirect runs *after* first paint to avoid penalising new visitors with an unnecessary auth round-trip on every cold visit.

Spec 012 has no in-app dependencies at runtime — it sits in front of the rest of the system. Its only outbound integrations are spec 011's signup and login routes (which the CTAs point to) and spec 011's `useAuth` (used by the auto-redirect logic). It does not consume any other scope at request time. Admin editing of the page content lives in spec 013.

### Core Design

| Element | Value |
| --- | --- |
| **Primary Actor** | Prospective YappChat user — first-time visitor with no account |
| **Secondary Actors** | Returning authenticated user (auto-redirect to app or admin dashboard); self-hosted deployment admin (branding configuration via spec 013); search-engine crawler (consumes structured metadata, sitemap, OG tags) |
| **Key Value** | The first impression of YappChat. Without it, the only way to reach the app is to already know an auth URL — blocking SEO, sharing, organic signup, and any go-to-market motion. Also the surface that articulates the "security stays at home" desktop value prop. |
| **Scope Boundary** | IN SCOPE: public unauthenticated page at deployment root; hero + primary CTA; seven-pillar features section; "security stays at home" privacy callout; two-plan pricing display (Individual / Corporate); per-plan signup CTA routing to `/signup?plan=...`; signup/login linking to spec 011; role-aware auto-redirect for authenticated sessions via spec 011 `useAuth` (system staff → `/admin`, regular → `/app`); return-URL aware login (`?return=` with allow-list); admin-configurable branding via `landingpageconfig`; SEO metadata + OG tags + sitemap + robots; structured data (schema.org Organization + SoftwareApplication); responsive layout (mobile/tablet/desktop); dark/light mode following system preference; analytics event hooks via `window.dataLayer`; FAQ section; social proof / testimonial slot; footer (legal, contact, version, GitHub, "Get the apps" modal); static-rendered HTML so content is visible without JS. OUT OF SCOPE: payment processing / subscriptions (spec 014); post-payment activation + setup checklist + app downloads as a flow (spec 015); Electron desktop client itself (spec 016 — landing page just links to its download artifact); blog or content CMS; documentation site; multi-language i18n; A/B testing engine; testimonial collection workflow (admin manually enters); CDN / edge deployment config; cookie banner / GDPR consent (compliance scope). |

---

## User Scenarios & Testing

### US1 — First-time visitor evaluates and signs up as Individual

**Actor**: Prospective user

**Scenario**:

1. Visitor opens `yappchat.com` (or self-hosted deployment URL). Page renders within 2s — hero, pillar list, security callout, pricing cards visible without JS hydration.
2. They read both plan cards: Individual ($5/mo billed yearly = $60/yr) and Corporate ($5/seat/mo billed yearly).
3. They click **Get started — Individual**. Browser navigates to `/signup?plan=individual`. Spec 011 signup form opens, plan pre-selected.
4. They complete signup. Spec 014 collects payment ($60). Spec 015 welcome page shows with setup checklist + download links.

**Expected outcome**: Page → signup CTA click in under 30s of visit (instrumented goal). Plan-aware routing is correct 100% of the time.

### US2 — Returning authenticated user lands on the marketing URL

**Actor**: User who is already signed in elsewhere (e.g., clicked a link in their email)

**Scenario**:

1. Page begins rendering (hero, features, pricing visible immediately — static HTML).
2. After first paint, `useAuth` check fires asynchronously. If `GET /api/auth/me` returns an authenticated session, the client branches:
   - **System staff** (any of `issystemadmin` / `isbillingadmin` / `issupport` true) → redirect to `/admin` (spec 013 Admin Console).
   - **Regular user** (only org-level roles, no system flags) → redirect to `/app` (the YappChat app).
3. The user briefly sees the marketing page, then lands on the appropriate surface. No "fetching session…" spinner blocks new visitors.

**Expected outcome**: Authenticated users redirected within 500ms of first paint. New visitors are NEVER blocked by the auth check. The system-staff branch lands on `/admin` 100% of the time.

### US3 — Team lead evaluates for their company (Corporate plan)

**Actor**: Prospective corporate customer

**Scenario**:

1. Visitor reads the page, focuses on the Corporate pricing card.
2. They click **Get started — Corporate**. Spec 011 signup with `plan=corporate` opens; signup form has an additional required "Org name" field.
3. After completing signup + payment (spec 014), spec 015 welcome flow gives them additional setup items: "Invite team members" appears in the checklist with a bulk-invite CSV upload.

**Expected outcome**: Corporate signup flow renders the org-name field correctly; post-signup welcome includes invite tooling.

### US4 — Self-hosted admin brands the page

**Actor**: Admin of a self-hosted YappChat deployment (`issystemadmin = true` per spec 011)

**Scenario**:

1. Admin opens spec 013 Admin Console → Landing Page settings.
2. They upload a company logo (PNG 512×512 ≤ 1MB), set a primary brand colour, edit the hero headline ("YappChat for Acme Corp"), and change the contact email in the footer.
3. They click **Save**. The `landingpageconfig` row updates; `updatedat` bumps.
4. Within 60s, the public landing page reflects the changes — CDN / ISR cache invalidates on the new `updatedat` value.

**Expected outcome**: Admin save → public page reflects new branding within 60s. Non-branded deployments fall back to YappChat defaults.

### US5 — Search-engine crawler indexes the page

**Actor**: Googlebot / Bingbot

**Scenario**:

1. Crawler fetches `/` with `User-Agent: Googlebot`.
2. Static HTML is returned with full content visible: hero text, all seven pillar descriptions, security callout, pricing, FAQ, structured data (`<script type="application/ld+json">` for `Organization` and `SoftwareApplication`).
3. Crawler reads `<title>`, `<meta description>`, OG tags. Renders fine without executing JS.
4. Crawler fetches `/sitemap.xml` and `/robots.txt`. Both served correctly.

**Expected outcome**: Lighthouse SEO score ≥ 95. The page is fully indexable without JS — verified by viewing source.

---

## Functional Requirements

### FR-001 — Static-rendered landing page

The page at `/` MUST be served as fully-rendered HTML; all content visible without JS execution; JS hydration enhances but never gates content.

**Acceptance Criteria**:

- [ ] A crawler with JS disabled fetching `/` receives complete HTML containing the hero headline, all seven pillar descriptions, the security callout body, both pricing cards (with prices), at least the first FAQ question, and the footer.
- [ ] Lighthouse SEO score ≥ 95.
- [ ] Implementation uses SSG with revalidation (Next.js ISR `revalidate: 60`, Remix prerender + loader, or equivalent). Per-request SSR that blocks first paint is forbidden.

### FR-002 — Hero section with primary CTA

The first fold MUST contain the hero: product tagline, one-liner, primary "Get started" button, and a secondary "Sign in" link.

**Acceptance Criteria**:

- [ ] Hero LCP ≤ 2.5s on simulated 3G mobile (WebPageTest profile `Moto G4 / 3G Fast`).
- [ ] Primary CTA navigates to `/signup` (no plan — user picks on the next page).
- [ ] Secondary "Sign in" link navigates to `/signin` (spec 011 `LoginScreen`).
- [ ] Hero headline and sub-headline come from `landingpageconfig.branding.heroheadline` and `.herosubheadline`.

### FR-003 — Seven-pillar features section

A section MUST render seven feature cards — one per product pillar (unified chat, PA, video, agent studio, AI chat, document generation, AI avatar) — each with icon, headline, one-sentence description, and an anchor link.

**Acceptance Criteria**:

- [ ] All seven cards render in the raw HTML; section is keyboard-navigable; cards collapse to single column on mobile.
- [ ] Each card has an `id` for deep-linking (e.g., `#feature-pa`, `#feature-video`).
- [ ] Card content (headline, body, icon path) comes from a static seed defined in code; admin override via `landingpageconfig.features` (jsonb) supported for self-hosted re-branding.

### FR-004 — "Security stays at home" privacy callout

A dedicated section between Features and Pricing MUST articulate the desktop-local execution value proposition.

**Acceptance Criteria**:

- [ ] Section headline: "Your data stays on your machine." (admin-overridable via `landingpageconfig.security.headline`).
- [ ] At least 3 bullets explain: skills run locally on the desktop app, AI provider calls go direct from the user's machine, E2E encryption end-to-end with the server storing ciphertext only.
- [ ] Bullets come from `landingpageconfig.security.bullets` (jsonb array) — admin-editable.
- [ ] Anchor link `#security` deep-links to the section.

### FR-005 — Two-plan pricing display

A pricing section MUST display Individual and Corporate cards side-by-side with display price, billing interval, features list, and per-plan CTA.

**Acceptance Criteria**:

- [ ] Plan cards render from `landingpageconfig.plans` (jsonb array).
- [ ] Individual card shows "$5/month — billed yearly".
- [ ] Corporate card shows "$5/seat/month — billed yearly".
- [ ] Both cards stack on mobile (< 640px) and sit side-by-side on tablet/desktop.
- [ ] Admin can edit price, headline, and feature list via spec 013 without a code release.

### FR-006 — Plan-aware signup CTA routing

Each plan card's CTA MUST route to the corresponding signup flow with the plan pre-selected.

**Acceptance Criteria**:

- [ ] Individual CTA → `/signup?plan=individual`.
- [ ] Corporate CTA → `/signup?plan=corporate`.
- [ ] Hero "Get started" CTA → `/signup` (no plan parameter; the signup form lets the user pick).
- [ ] E2E test verifies plan parameter arrives correctly at spec 011 signup form 100% of the time.

### FR-007 — Authenticated-user role-aware redirect

After first paint, the client MUST check the user's auth state and, if authenticated, redirect to the appropriate surface based on system role flags.

**Acceptance Criteria**:

- [ ] After first paint completes, the client calls `GET /api/auth/me`.
- [ ] If 200 (authenticated) AND the user has ANY system flag set (`issystemadmin` / `isbillingadmin` / `issupport`) → redirect to `/admin` (spec 013 Admin Console).
- [ ] If 200 (authenticated) AND no system flags set → redirect to `/app` (the YappChat app).
- [ ] If 401 (not authenticated) → stay on the landing page.
- [ ] First paint is NEVER blocked by the auth check. Redirect for an authenticated user completes within 500ms of first paint.
- [ ] New visitors see no spinner or auth-fetching indicator.

### FR-008 — Admin-configurable branding

A single `landingpageconfig` row per deployment MUST drive all editable content; admins edit via spec 013.

**Acceptance Criteria**:

- [ ] One row per deployment, UNIQUE on `deploymentid`.
- [ ] Editable fields: logo URL + alt, primary brand colour, company name, contact email, hero headline + sub-headline, GitHub URL, terms URL, privacy URL.
- [ ] Admin save (via spec 013 Admin Console) → public page reflects within 60s.
- [ ] Non-branded deployments show YappChat defaults.

### FR-009 — SEO metadata

The page MUST emit complete SEO metadata in `<head>`: title, description, keywords, canonical URL, robots, plus OG tags and Twitter Card metadata.

**Acceptance Criteria**:

- [ ] All meta fields populated from `landingpageconfig.seo` (jsonb).
- [ ] OpenGraph: `og:title`, `og:description`, `og:image`, `og:url`, `og:type=website`.
- [ ] Twitter Card: `twitter:card=summary_large_image`, `twitter:title`, `twitter:description`, `twitter:image`, `twitter:site` (from `landingpageconfig.seo.twitterhandle`).
- [ ] Twitter / LinkedIn / Slack link unfurl shows correct preview (verified manually on each launch).
- [ ] All meta fields verifiable in the raw HTML response (no JS-only injection).

### FR-010 — `sitemap.xml` and `robots.txt`

The server MUST emit `/sitemap.xml` and `/robots.txt`.

**Acceptance Criteria**:

- [ ] `GET /sitemap.xml` returns valid sitemap XML listing `/` plus anchor fragments derived from FAQ items + feature IDs.
- [ ] `GET /robots.txt` returns directives — defaults to `Allow: /` for production. Staging deployments override via `landingpageconfig.seo.disallowindexing: true` which emits `Disallow: /`.
- [ ] Both URLs return 200 with the correct content-type.

### FR-011 — Structured data (JSON-LD)

The page MUST emit inline JSON-LD for `Organization` and `SoftwareApplication`.

**Acceptance Criteria**:

- [ ] `<script type="application/ld+json">` blocks emitted for `Organization` (company info, contact email, social links) and `SoftwareApplication` (product info, `offers` reflecting both plans' current prices).
- [ ] JSON-LD passes Google's Rich Results test.
- [ ] `offers` reflects the same prices as the visible pricing cards (same source: `landingpageconfig.plans`).

### FR-012 — Responsive layout

The page MUST adapt to three breakpoints with appropriate stacking.

**Acceptance Criteria**:

- [ ] Mobile (< 640px): hero stacks vertically; pricing cards stack; features collapse to single column; touch targets ≥ 44×44px.
- [ ] Tablet (640–1024px): hero side-by-side; pricing cards side-by-side; features in 2 columns.
- [ ] Desktop (≥ 1024px): full-width hero with image; pricing cards side-by-side; features in 3-4 columns.
- [ ] Lighthouse mobile UX ≥ 90.
- [ ] Manual test on iPhone SE width (375px) and iPad (768px) shows no overflow or broken layout.

### FR-013 — Dark / light mode

The page MUST respect the system `prefers-color-scheme` preference.

**Acceptance Criteria**:

- [ ] CSS variables drive colour tokens; both themes available via `@media (prefers-color-scheme: dark)`.
- [ ] No theme toggle on the landing page itself (the app handles toggling — landing is intentionally lean).
- [ ] Switching the OS theme reloads the page with correct colours.
- [ ] Both themes meet WCAG AA contrast for body text and CTAs (verified by axe-core CI scan).

### FR-014 — Analytics event hooks

The page MUST emit typed events into `window.dataLayer`; no bundled third-party analytics scripts.

**Acceptance Criteria**:

- [ ] Events emitted: `landing.viewed` (on page load), `landing.hero_cta_clicked`, `landing.plan_cta_clicked` (with plan key), `landing.signin_clicked`, `landing.faq_expanded` (with FAQ id), `landing.scroll_depth` (at 25/50/75/100%).
- [ ] No third-party analytics script (`gtag`, `segment`, etc.) is bundled in the page's JS — deployments plug in their analytics-of-choice via external `<script>` tag they manage themselves.
- [ ] Events appear in `window.dataLayer` with documented payload shapes.

### FR-015 — FAQ section

A collapsible accordion MUST render question/answer pairs from config.

**Acceptance Criteria**:

- [ ] FAQ content comes from `landingpageconfig.faq` (jsonb array of `{ id, question, answer }`).
- [ ] Accordion is initially closed; one-at-a-time expansion (clicking another item closes the previous).
- [ ] Each FAQ has an `id`; deep-linking to `/#faq-billing` opens that item expanded.
- [ ] At least 5 default FAQs seeded on first deploy.
- [ ] Admin can edit / add / remove FAQs via spec 013.

### FR-016 — Social proof / testimonial slot

A testimonials section MUST render configured testimonials, or hide entirely if none configured.

**Acceptance Criteria**:

- [ ] Testimonial content from `landingpageconfig.testimonials` (jsonb array of `{ quote, author, role, company, avatarurl }`).
- [ ] Section appears when at least one testimonial is present; section is omitted entirely (no empty placeholder, no "Coming soon" copy) when the array is empty.
- [ ] Admin curates via spec 013.

### FR-017 — Footer

A persistent footer MUST render at the bottom of the page with required elements.

**Acceptance Criteria**:

- [ ] Footer contains: company name + logo, contact email, GitHub link, version string (from deployment build), legal links (Terms / Privacy — URLs from `landingpageconfig.branding`), and a "Get the apps" anchor that opens `AppsDownloadModal`.
- [ ] Also contains a "Sign in" link (redundant with hero but expected by users).
- [ ] Legal links 404-tolerant: when the configured URL is blank, the link displays "Coming soon" instead of an active link.
- [ ] `AppsDownloadModal` lists iOS / Android / Desktop downloads from `landingpageconfig.downloads`; per-platform availability flag controls whether the row is a real link or a `comingsoonnote`.

### FR-018 — Return-URL aware login

The "Sign in" CTAs MUST accept an optional `?return=<path>` parameter so deep-linked emails can route users into specific in-app surfaces after auth.

**Acceptance Criteria**:

- [ ] Sign-in CTA generators URL-encode the `return` parameter.
- [ ] After successful login, FR-007's redirect honours the `return` path if it points to an allow-listed in-app surface.
- [ ] Allow-list (implemented in spec 011 redirect handler): `^/app(/|$)` for any authenticated user; additionally `^/admin(/|$)` only when caller has any system flag set.
- [ ] Unsafe / off-domain `return` values (e.g., `https://attacker.com`, `//attacker.com`, `javascript:...`, `data:...`) are ignored — the user is redirected to the safe default (`/app` or `/admin`) instead.
- [ ] Security test matrix verifies all attack patterns are rejected.

---

## Data Requirements

| Table | Purpose |
| --- | --- |
| `landingpageconfig` | Single row per deployment — all editable content driving the page |

### `landingpageconfig`

One row per deployment. All editable content lives here as jsonb fields. Page reads this row on every request (with CDN / ISR caching keyed on `updatedat`).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | PK |
| `deploymentid` | text | UNIQUE — one row per deployment instance |
| `branding` | jsonb | `{ logo, primarycolor, companyname, contactemail, heroheadline, herosubheadline, githuburl, termsurl, privacyurl }` |
| `seo` | jsonb | `{ title, description, keywords[], ogimageurl, twitterhandle, disallowindexing }` |
| `plans` | jsonb | Array of plan objects: `{ key, displayname, priceamount, pricecurrency, priceunit, billinginterval, headline, features[], ctapath, perseatnote? }` |
| `features` | jsonb | Array of pillar cards: `{ id, iconpath, headline, body, anchorid }` — overrides the default seven-pillar seed |
| `faq` | jsonb | Array of `{ id, question, answer }` |
| `testimonials` | jsonb | Array of `{ quote, author, role, company, avatarurl }` |
| `security` | jsonb | `{ headline, bullets[] }` for the "security stays at home" callout |
| `downloads` | jsonb | `{ ios: { available, url }, android: { available, url }, desktop: { available, url?, comingsoonnote? } }` |
| `updatedat` | timestamptz | Bumped on every save — drives cache invalidation |
| `updatedby` | uuid | FK → spec 011 `users.id` |

Index: `(deploymentid)` UNIQUE.

Audit: every PATCH to this row writes to spec 011 `authauditlog` with `eventtype: 'landingpage_config_changed'` and a payload containing the diff.

Validation: a Zod schema gates every jsonb field on write; malformed config is rejected at the API layer with a 422.

---

## API Routes

| Method | Path | Description | Auth |
| --- | --- | --- | --- |
| GET | `/` | The landing page itself — server-rendered HTML with `landingpageconfig` content interpolated. Cache headers CDN-friendly; admin-edit triggers cache bust. | Public |
| GET | `/sitemap.xml` | Lists `/` plus anchor fragments derived from configured FAQ + features. Respects `seo.disallowindexing`. | Public |
| GET | `/robots.txt` | Indexability config — defaults to `Allow: /`. Pre-prod / staging override via `seo.disallowindexing: true`. | Public |
| GET | `/api/landing/config` | Public-readable subset of config — used by client-side hydration and analytics. Returns `branding`, `plans`, `faq`, `testimonials`, `security`, `downloads`, public `seo` fields. NEVER returns `updatedby` or admin-only fields. | Public |
| GET | `/api/landing/config/admin` | Full config including internal admin fields. | System admin only (`issystemadmin`) |
| PATCH | `/api/landing/config` | Update any jsonb section. Validates jsonb shape against Zod schema before commit. Bumps `updatedat`, sets `updatedby`. Triggers cache bust. | System admin only |

---

## Frontend Components

### Page-level

| Component | Path | Description |
| --- | --- | --- |
| `LandingPage` | `apps/web/src/pages/landing/LandingPage.tsx` | Root — composes all sections; statically rendered (Next.js `getStaticProps` with `revalidate: 60` OR Remix `loader` + prerender). Reads `landingpageconfig` at request time. |

### Section components

| Component | Path | Description |
| --- | --- | --- |
| `Hero` | `apps/web/src/pages/landing/Hero.tsx` | Logo, headline, sub-headline, primary "Get started" CTA, secondary "Sign in" link |
| `FeaturesSection` | `apps/web/src/pages/landing/FeaturesSection.tsx` | Seven-pillar grid; each card is a `FeatureCard` |
| `FeatureCard` | `apps/web/src/pages/landing/FeatureCard.tsx` | Icon + headline + one-sentence body + anchor link |
| `SecurityCallout` | `apps/web/src/pages/landing/SecurityCallout.tsx` | "Your data stays on your machine" section (FR-004) |
| `PricingSection` | `apps/web/src/pages/landing/PricingSection.tsx` | Wraps two `PricingCard` instances; stacks on mobile |
| `PricingCard` | `apps/web/src/pages/landing/PricingCard.tsx` | Plan name, price, feature list, per-plan CTA |
| `TestimonialsSection` | `apps/web/src/pages/landing/TestimonialsSection.tsx` | Renders `TestimonialCard` grid; hidden entirely when empty |
| `TestimonialCard` | `apps/web/src/pages/landing/TestimonialCard.tsx` | Quote, author, role, company, avatar |
| `FAQSection` | `apps/web/src/pages/landing/FAQSection.tsx` | Accordion of `FAQItem`s with deep-link support (`/#faq-billing`) |
| `Footer` | `apps/web/src/pages/landing/Footer.tsx` | Company name + logo, contact email, GitHub, version, legal links, Sign-in link, "Get the apps" modal trigger |
| `AppsDownloadModal` | `apps/web/src/pages/landing/AppsDownloadModal.tsx` | Modal listing iOS / Android / Desktop downloads from `landingpageconfig.downloads`; "Coming soon" rows when `available: false` |

### Client-side script (hydrates after first paint)

| Module | Path | Description |
| --- | --- | --- |
| `SystemPathRedirector` | `apps/web/src/pages/landing/SystemPathRedirector.tsx` | Mounted via `useEffect` after first paint. Calls `useAuth.refresh()` once. If authenticated, reads system flags; routes per FR-007 (system staff → `/admin`, regular → `/app`). Honours `?return=` per FR-018, validated against an allow-list. |

### Admin (lives in spec 013 — referenced here for visibility)

| Component | Path | Description |
| --- | --- | --- |
| `LandingPageConfigPanel` | `packages/ui/src/admin/LandingPageConfigPanel.tsx` | System-admin UI to edit each jsonb section of `landingpageconfig`. Live preview pane. Saves trigger cache bust. Implementation owned by spec 013. |

---

## Success Criteria

1. Lighthouse Performance score ≥ 90 desktop, ≥ 80 mobile on `/` — measured by Lighthouse CI on every deploy; merge-blocked on regression.
2. LCP ≤ 2.5s, TTFB ≤ 200ms on simulated 3G mobile (WebPageTest profile `Moto G4 / 3G Fast`).
3. All page content visible without JavaScript — automated test asserts presence of headline, plan names, FAQ first-line, security callout in raw HTML response from `curl`.
4. Authenticated-user auto-redirect completes ≤ 500ms after first paint; first paint NEVER blocked by the auth check. Both branches tested (system staff → `/admin`, regular user → `/app`).
5. Plan-aware signup CTA routing: 100% accuracy — every Individual CTA click lands on `/signup?plan=individual`, every Corporate CTA click on `/signup?plan=corporate`. E2E click matrix on every CI build.
6. Admin branding changes propagate ≤ 60s from save to public-page reflection.
7. Lighthouse SEO score ≥ 95; JSON-LD validates in Google's Rich Results test.
8. WCAG AA contrast for all body text and CTAs in both light and dark modes (axe-core CI scan).
9. Return-URL allow-list rejects 100% of off-domain / unsafe redirect attempts in the security test matrix.
10. Lighthouse mobile Best Practices ≥ 90; all touch targets ≥ 44×44px; visual regression test at iPhone SE (375px) and iPad (768px) breakpoints.

---

## Key Entities

| Entity | Location | Description |
| --- | --- | --- |
| `LandingPageConfig` | `landingpageconfig` table | The single-row deployment-wide content store for the landing page. All editable strings, plan info, FAQs, testimonials, branding, SEO, and download URLs live here as jsonb. |
| `LandingPlan` | Element of `landingpageconfig.plans` jsonb array | A single plan card's content — display price, headline, features, CTA path. Display-only; billing reality lives in spec 014. |
| `LandingFAQ` | Element of `landingpageconfig.faq` jsonb array | A single FAQ item — question, answer, deep-link id. |
| `LandingTestimonial` | Element of `landingpageconfig.testimonials` jsonb array | A single testimonial — quote, author, role, company, avatar. |

---

## Constraints

- The page MUST be statically renderable. Per-request SSR that BLOCKS first paint is a hard violation. Acceptable: SSG with ISR (Next.js), Remix prerender + loader, or pre-rendered HTML served from object storage.
- All page content MUST be visible in the raw HTML response without JavaScript execution. Critical content inside `<noscript>` is NOT acceptable — it must be in the primary DOM.
- NO hard-coded marketing copy. Every editable string MUST come from `landingpageconfig`.
- The `/` route is PUBLIC. No auth gate. Adding auth here breaks SEO crawling.
- The `?return=` parameter MUST be validated against an allow-list before any redirect. Off-domain, protocol-relative, `javascript:`, and `data:` URIs MUST be rejected.
- NO bundled third-party analytics scripts. Page emits typed events into `window.dataLayer` only.
- NO bundled cookie banner / consent prompt in v1.
- NO synchronously-loaded third-party fonts. Self-hosted WOFF2 with `font-display: swap`, or system font stack only.
- Plan prices displayed on the page come from `landingpageconfig.plans`. Spec 014 (Billing) is the source of truth for actual charges. Divergence is the admin's responsibility — page does NOT validate parity at request time.
- Admin edits to `landingpageconfig` MUST trigger a cache bust within 60s.
- The authenticated-user redirect (FR-007) MUST run AFTER first paint, never before. Server-side cookie-based pre-redirect is a hard violation.
- The desktop download link in `AppsDownloadModal` reads from `landingpageconfig.downloads.desktop`. When `available: false`, the modal shows the configured `comingsoonnote` — never a broken link or placeholder URL.
- OAuth provider buttons live on spec 011's `LoginScreen` and `SignupForm` — NOT on the landing page.
- The page is single-route (long-scroll) — no separate `/pricing`, `/features`, or `/security` paths in v1. Deep-linkable via anchors.

---

## Notes

### Relationship to other specs

| Spec | How spec 012 connects |
| --- | --- |
| **Spec 011 (Auth)** | "Sign in" link → `LoginScreen`. Plan-aware "Get started" CTAs → `SignupForm` with `?plan=` param. `useAuth.refresh()` drives the FR-007 redirect. `?return=` allow-list lives in spec 011's redirect handler. |
| **Spec 013 (Admin Console — queued)** | Owns `LandingPageConfigPanel` admin UI. Spec 013's `/admin` route is the FR-007 redirect target for system staff. |
| **Spec 014 (Billing — queued)** | Source of truth for actual prices charged. Spec 012 displays plan info from local config; spec 014 enforces it at signup. |
| **Spec 015 (Post-Payment Activation — queued)** | The landing page's footer "Get the apps" modal reads `landingpageconfig.downloads`; those URLs point to spec 015's public download surface. |
| **Spec 016 (Electron Desktop Client — queued)** | The desktop download URL in `landingpageconfig.downloads.desktop` points to spec 016's signed binary artifact (when `available: true`). The "security stays at home" callout (FR-004) is the marketing-side articulation of spec 016's value prop. |

### Static-render technology recommendation

Implementer's choice between **Next.js (SSG + ISR)** or **Remix (prerender + loader)**. Both can satisfy the constraints. Recommending Next.js with `revalidate: 60` so admin edits propagate without a full deploy.

If the deployment infrastructure can't run Node, the alternative is **a build-time static generator** (Astro, Eleventy) that re-renders on `landingpageconfig` change via a webhook from spec 013's admin save.

### Deployment considerations

- The page is CDN-friendly — cache the rendered HTML aggressively, key on `landingpageconfig.updatedat`.
- For self-hosted deployments on a single VM, no CDN needed — the static-rendered HTML is served directly with `Cache-Control: public, max-age=60, must-revalidate`.
- `og-image.png` (FR-009 OG metadata) is a static asset deployed alongside the page. Branded deployments can override by uploading via the admin panel (spec 013).

### Bootstrap workflow

On first launch of a new deployment with no `landingpageconfig` row:

1. Server seed creates a `landingpageconfig` row with YappChat defaults — stock branding, copy, plans, FAQ, empty testimonials, `downloads.desktop.available: false`, `seo.disallowindexing: false`.
2. Until the deployment admin customises via spec 013, visitors see the YappChat-default landing page.
3. Pre-production deployments should set `seo.disallowindexing: true` in their seed override so staging doesn't get indexed.

### Risks

| Risk | Mitigation |
| --- | --- |
| Misconfigured `landingpageconfig` jsonb breaks the page render | Zod schema validates the full config before write; reads fall back to YappChat defaults for any missing or malformed field. The page NEVER 500s. |
| CDN cache + admin edit timing mismatch — admin saves, sees old content for 60s, panics, saves again | Cache-bust headers + admin-side "Save complete — public site will reflect within 60s" toast. Audit log dedups by content hash. |
| Plan prices in display config drift from billing system reality | Scheduled CI test compares `landingpageconfig.plans[].priceamount` against spec 014's billing records; posts a `pa.notification` to system admins on divergence. |
| Self-hosted deployments with no branding look generic | Seed defaults are YappChat-branded; spec 013's admin panel prompts for branding completion on first run. |
| `Get the apps` modal looks broken when no apps are available | `available: false` per platform shows the `comingsoonnote` (configurable). Empty downloads section is hidden entirely. |
| OG image fails to render | OG image URL validated on admin save; admin warned at edit time if the URL returns non-image content-type or 4xx/5xx. |
| Long-tail of obsolete OG image dimensions across social platforms | Single 1200×630 OG image used for all platforms (Facebook, Twitter, LinkedIn, Slack all support this). |

---

## Clarifications

### Session 2026-05-10

| # | Question | Decision |
| --- | --- | --- |
| 1 | Title and filename | Short: "Spec 012: Public Landing Page" / `012-landing-page.md` (replaces the 60-word auto-generated draft) |
| 2 | Pricing display location | Inline on the landing page, no separate `/pricing` route |
| 3 | Two plans — Individual and Corporate | Yes; Corporate has `orgname` field on signup, Individual auto-creates personal org |
| 4 | Corporate pricing model | $5/seat/month billed yearly (Interpretation B — same per-seat rate as Individual, consolidated billing) |
| 5 | Post-payment activation page | New spec 015 — distinct from this landing page (which is unauthenticated) |
| 6 | Desktop client | Electron with local skill + subagent runtime (new spec 016) — "your data stays on your machine" is a primary selling point of the desktop app and a featured callout on this landing page |
| 7 | Browser-only execution limits | Avatar runs locally in browser; skills/subagents/AI calls go through server in browser/mobile due to CORS + secret-exposure constraints; desktop (spec 016) bypasses these |
| 8 | Authenticated-user redirect | Role-aware: system staff (any of `issystemadmin`/`isbillingadmin`/`issupport`) → `/admin` (spec 013); regular org users → `/app`. Redirect runs AFTER first paint. |
| 9 | Account management surface for customers | Inside the chat app at `/app/settings/*` (Option A). `?return=` parameter on sign-in CTAs supports deep-linking from emails into specific settings panels. |
| 10 | `LandingPageConfigPanel` admin UI | Listed in BOTH spec 012 (referenced) and spec 013 (implementation owner). |
| 11 | Analytics | Events emitted into `window.dataLayer` only — no bundled third-party trackers |
| 12 | Cookie banner | Out of scope for v1 |
| 13 | Multi-language | Out of scope for v1 |
| 14 | Static-render technology | Implementer's choice — Next.js (SSG + ISR) recommended |
