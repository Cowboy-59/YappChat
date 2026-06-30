# YappChat Web — Stack & Style

**Application type:** Web (full client)
**Status:** Live — landing page, signup/auth implemented (specs 011, 012).

The Web app is a **full YappChat client**, not a marketing shell: it serves the
landing page, signup/auth, and usage/billing, **and** runs the complete chat
product in the browser. It shares accounts, the data model, and the PostgreSQL
backend with the Desktop app (see the product overview at [`../../stack.md`](../../stack.md)).

## Stack (as built)

| Dimension | Choice | Why |
|---|---|---|
| Framework | **Next.js 16** (App Router) | Server + browser in one app; SSR landing + authenticated app routes. **Note:** this Next.js has breaking changes — see `AGENTS.md`. |
| Frontend | React 19 | Component model shared with the Desktop renderer. |
| Database | PostgreSQL (`pgkanban.wxperts.com`, schema `yappchat`) via Drizzle ORM + `postgres` driver | Server source of truth; tables schema-qualified to `yappchat`. |
| Styling / Components | Tailwind CSS v4 | Shared design tokens with Desktop; no component-library lock-in. |
| Testing | Vitest | Unit-tests app + service logic. |
| Hosting / Deploy | Hosted deploy (URL) | Distributed as a hosted web app, not an installer. |

## Scope

- Landing page (spec 012)
- Signup / auth (spec 011, `auth-schema.ts`)
- Usage / billing dashboard
- **Full chat app in the browser**

## Look & Feel

Inherits the shared design language. See [`../../stack.md`](../../stack.md) for the
canonical tokens.

- **Gallery:** mobbin
- **Reference:** https://mobbin.com/apps/sana-ai-web-d64c7169-7bee-42b7-9a8b-bae78ff36f8b/4342798b-0c61-4afa-b57e-b71a543dca40/screens

### Design Tokens

- **Colors** — primary #3498db, secondary #f1c40f, neutral #95a5a6, background #f9f9f9, foreground #2c3e50
- **Typography** — Open Sans; 1.2
- **Spacing** — base 16; radius 8
