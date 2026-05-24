# Spec 012: Public Landing Page

## Overview

The Public Landing Page is the unauthenticated front door at the deployment root URL — the first thing a prospective user sees before they have an account. It explains what YappChat is, demonstrates the seven product pillars (unified chat, PA, video, agent studio, AI chat, document generation, AI avatar), articulates the privacy positioning ("your data stays on your machine"), displays the two plans (Individual, Corporate), drives signup, and routes returning authenticated users straight through to the app or admin dashboard. It is also the public face of every self-hosted deployment, so company admins can brand it for their employees with logo, colours, hero copy, and contact details.

The page is statically renderable so SEO crawlers see real content without JavaScript, and so first-paint latency is bounded by network transit rather than client-side hydration. The authenticated-user auto-redirect runs *after* first paint to avoid penalising new visitors with an unnecessary auth round-trip on every cold visit.

Spec 012 has no in-app dependencies at runtime — it sits in front of the rest of the system. Its only outbound integrations are spec 011's signup and login routes (which the CTAs point to) and spec 011's `useAuth` (used by the auto-redirect logic). It does not consume any other scope at request time. Admin editing of the page content lives in spec 013.

**Scope Boundary** — IN SCOPE: public unauthenticated page at deployment root; hero + primary CTA; seven-pillar features section; "security stays at home" privacy callout; two-plan pricing display (Individual / Corporate); per-plan signup CTA routing to `/signup?plan=...`; signup/login linking to spec 011; role-aware auto-redirect for authenticated sessions via spec 011 `useAuth` (system staff → `/admin`, regular → `/app`); return-URL aware login (`?return=` with allow-list); admin-configurable branding via `landingpageconfig`; SEO metadata + OG tags + sitemap + robots; structured data (schema.org Organization + SoftwareApplication); responsive layout (mobile/tablet/desktop); dark/light mode following system preference; analytics event hooks via `window.dataLayer`; FAQ section; social proof / testimonial slot; footer (legal, contact, version, GitHub, "Get the apps" modal); static-rendered HTML so content is visible without JS. OUT OF SCOPE: payment processing / subscriptions (spec 014); post-payment activation + setup checklist + app downloads as a flow (spec 015); Electron desktop client itself (spec 016 — landing page just links to its download artifact); blog or content CMS; documentation site; multi-language i18n; A/B testing engine; testimonial collection workflow; CDN / edge deployment config; cookie banner / GDPR consent.

**Depends On**: Spec 011 (auth + role flags), Spec 013 (Admin Console — `/admin` redirect target + `LandingPageConfigPanel`), Spec 015 (Post-Payment Activation), Spec 016 (Electron Desktop Client).

## Phase

**Current Phase**: design
**Priority**: high

## Status

- **Date**: 2026-05-24
- **Phase**: design
