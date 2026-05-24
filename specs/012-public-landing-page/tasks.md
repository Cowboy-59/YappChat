# Task Breakdown: Public Landing Page

**Feature**: Public Landing Page
**Spec**: 012
**Date Generated**: 2026-05-24
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

---

## Tasks

| # | Task | Priority | Status |
|---|------|----------|--------|
| 1 | Static-render page scaffolding + responsive layout + dark/light theming | high | todo |
| 2 | Hero, Features (seven pillars), and Security callout sections | high | todo |
| 3 | PricingSection with plan-aware signup CTA routing | high | todo |
| 4 | `landingpageconfig` table + public/admin config APIs + Zod validation | high | todo |
| 5 | SEO: metadata, OG/Twitter tags, JSON-LD, sitemap.xml, robots.txt | medium | todo |
| 6 | FAQ accordion, Testimonials, Footer, AppsDownloadModal | medium | todo |
| 7 | Authenticated-user role-aware redirect + return-URL allow-list | high | todo |
| 8 | Analytics event hooks via window.dataLayer (no bundled third-party trackers) | medium | todo |

## Task Details

### T001 — Static-render page scaffolding + responsive layout + dark/light theming

Create the `LandingPage` root composition in `apps/web/src/pages/landing/LandingPage.tsx` using Next.js SSG with `revalidate: 60` (or Remix prerender + loader). The route MUST be at `/` and MUST serve fully-rendered HTML containing all section content without JS execution (FR-001). Wire up CSS-variable colour tokens with `@media (prefers-color-scheme: dark)` so both themes meet WCAG AA contrast (FR-013). Implement the three responsive breakpoints — mobile < 640px (stacked), tablet 640–1024px (side-by-side hero + 2-column features), desktop ≥ 1024px (3–4 column features) — with touch targets ≥ 44×44px (FR-012). Wire `landingpageconfig` reads at request time with cache headers keyed on `updatedat`. Per-request SSR that blocks first paint is forbidden — enforce SSG/ISR. Acceptance: Lighthouse Performance ≥ 90 desktop / ≥ 80 mobile; LCP ≤ 2.5s on 3G; raw-HTML curl shows hero, pillars, security callout, both pricing cards, first FAQ, footer.

### T002 — Hero, Features (seven pillars), and Security callout sections

Build `Hero` (FR-002), `FeaturesSection` + `FeatureCard` (FR-003), and `SecurityCallout` (FR-004) under `apps/web/src/pages/landing/`. Hero contains logo, headline + sub-headline (from `landingpageconfig.branding.heroheadline` / `.herosubheadline`), a primary "Get started" CTA to `/signup` (no plan param), and a secondary "Sign in" link to `/signin`. FeaturesSection renders seven cards — one per pillar (unified chat, PA, video, agent studio, AI chat, document generation, AI avatar) — each with icon, headline, one-sentence body, and a deep-link anchor id (e.g., `#feature-pa`, `#feature-video`); content from a static seed with override via `landingpageconfig.features` (jsonb). SecurityCallout sits between Features and Pricing with headline (default "Your data stays on your machine.") and ≥ 3 bullets explaining local skill execution, direct AI provider calls from the user's machine, and E2E encryption with server holding ciphertext only; bullets come from `landingpageconfig.security.bullets` and the anchor `#security` deep-links to the section. All three sections must render fully in the raw HTML response.

### T003 — PricingSection with plan-aware signup CTA routing

Build `PricingSection` + `PricingCard` (FR-005, FR-006) at `apps/web/src/pages/landing/`. Read `landingpageconfig.plans` (jsonb array) — render the Individual card ("$5/month — billed yearly") and Corporate card ("$5/seat/month — billed yearly") side-by-side at ≥ 640px, stacked below. Each card shows display price, billing interval, feature list, and a per-plan CTA. Individual CTA navigates to `/signup?plan=individual`; Corporate CTA navigates to `/signup?plan=corporate`. Plan content (price, headline, features, CTA path) MUST come from `landingpageconfig.plans` so admins can edit via spec 013 without a code release. Acceptance: E2E click matrix asserts plan parameter arrives correctly at spec 011 signup form 100% of the time on every CI build.

### T004 — `landingpageconfig` table + public/admin config APIs + Zod validation

Create the `landingpageconfig` Drizzle schema per project DB conventions (plural lowercase no separators — `landingpageconfig`, UUID v7 `id`, single row per deployment UNIQUE on `deploymentid`). Columns: `branding`, `seo`, `plans`, `features`, `faq`, `testimonials`, `security`, `downloads` (all jsonb), `updatedat`, `updatedby` (FK → spec 011 `users.id`). Implement Zod schemas gating each jsonb section on write; malformed config returns 422. Generate migration via `npm run db:generate` and verify with `wxkanban-agent dbpush --dry-run` before commit. Implement API routes: `GET /api/landing/config` (public-readable subset — branding, plans, faq, testimonials, security, downloads, public seo only; NEVER returns `updatedby` or admin-only fields), `GET /api/landing/config/admin` (full config, requires `issystemadmin`), `PATCH /api/landing/config` (validates jsonb against Zod, bumps `updatedat`, sets `updatedby`, triggers cache bust, writes spec 011 `authauditlog` entry with `eventtype: 'landingpage_config_changed'` and content diff). Implement seed for first-launch defaults (FR-008). Admin save → public page reflects within 60s.

### T005 — SEO: metadata, OG/Twitter tags, JSON-LD, sitemap.xml, robots.txt

Implement FR-009, FR-010, FR-011. Emit complete `<head>` metadata from `landingpageconfig.seo`: `<title>`, `<meta description>`, `<meta keywords>`, canonical URL, robots. OpenGraph: `og:title`, `og:description`, `og:image`, `og:url`, `og:type=website`. Twitter Card: `twitter:card=summary_large_image`, `twitter:title`, `twitter:description`, `twitter:image`, `twitter:site` (from `seo.twitterhandle`). All meta MUST be in the raw HTML — no JS-only injection. Emit inline JSON-LD `<script type="application/ld+json">` blocks for `Organization` (company info, contact email, social links) and `SoftwareApplication` (product info, `offers` reflecting both plans' current prices from `landingpageconfig.plans`). JSON-LD MUST validate in Google Rich Results test. Implement `GET /sitemap.xml` (lists `/` plus FAQ + feature anchor fragments; respects `seo.disallowindexing`) and `GET /robots.txt` (defaults `Allow: /`; `Disallow: /` when `seo.disallowindexing: true`). Acceptance: Lighthouse SEO ≥ 95; manual link-unfurl verification on Twitter / LinkedIn / Slack.

### T006 — FAQ accordion, Testimonials, Footer, AppsDownloadModal

Build `FAQSection` + `FAQItem` (FR-015) with content from `landingpageconfig.faq` (jsonb array of `{ id, question, answer }`) — initially collapsed, one-at-a-time expansion, deep-link to `/#faq-<id>` opens that item expanded, ≥ 5 default FAQs seeded on first deploy. Build `TestimonialsSection` + `TestimonialCard` (FR-016) from `landingpageconfig.testimonials` — section omitted entirely (no "Coming soon" placeholder) when the array is empty. Build `Footer` (FR-017) containing: company name + logo, contact email, GitHub link, version string from deployment build, legal links (Terms / Privacy from `landingpageconfig.branding`, displaying "Coming soon" inline text when URL is blank), redundant "Sign in" link, and a "Get the apps" trigger that opens `AppsDownloadModal`. Build `AppsDownloadModal` listing iOS / Android / Desktop downloads from `landingpageconfig.downloads`; per-platform `available: false` shows the configured `comingsoonnote`, never a broken link.

### T007 — Authenticated-user role-aware redirect + return-URL allow-list

Build `SystemPathRedirector` at `apps/web/src/pages/landing/SystemPathRedirector.tsx` (FR-007, FR-018). Mount via `useEffect` AFTER first paint — server-side cookie-based pre-redirect is a hard violation. Call `useAuth.refresh()` once → `GET /api/auth/me`. If 200 + any system flag set (`issystemadmin` / `isbillingadmin` / `issupport`) → redirect to `/admin`. If 200 + no system flags → redirect to `/app`. If 401 → stay on the landing page. First paint MUST NEVER be blocked; new visitors see no spinner. Redirect must complete within 500ms of first paint. Implement `?return=<path>` handling on sign-in CTAs: URL-encode on generation; on successful login, FR-007 redirect honours `return` only if it matches the allow-list in spec 011's redirect handler — `^/app(/|$)` for any authenticated user, additionally `^/admin(/|$)` only when caller has a system flag. Reject 100% of off-domain / protocol-relative (`//attacker.com`) / `javascript:` / `data:` URIs — fall back to safe default. Security test matrix covers all attack patterns.

### T008 — Analytics event hooks via window.dataLayer (no bundled third-party trackers)

Implement FR-014. Emit typed events into `window.dataLayer`: `landing.viewed` (on page load), `landing.hero_cta_clicked`, `landing.plan_cta_clicked` (payload includes `{ plan }`), `landing.signin_clicked`, `landing.faq_expanded` (payload includes `{ faqId }`), `landing.scroll_depth` (payload includes `{ depthPercent }` — fired at 25 / 50 / 75 / 100%). Hard constraint: NO bundled third-party analytics script (`gtag`, `segment`, etc.) — deployments plug in their analytics-of-choice via an external `<script>` tag they manage themselves. Document the event names + payload shapes in `apps/web/src/pages/landing/analytics-events.md`. Acceptance: events appear in `window.dataLayer` with documented payload shapes on every interaction; bundle inspection confirms no third-party tracker.
