# Landing Page Analytics Events (Spec 012 T008 / FR-014)

The public landing page emits events into **`window.dataLayer`** only. **No
third-party analytics script is bundled** (`gtag`, `segment`, etc.). Each
deployment attaches its analytics tool of choice via an external `<script>` it
manages itself; that script reads/forwards `window.dataLayer`.

`window.dataLayer` is a plain array. Each entry has an `event` string plus any
event-specific fields below. Source of truth for the types:
[`src/lib/analytics/events.ts`](../../lib/analytics/events.ts).

| Event | When | Payload |
|-------|------|---------|
| `landing.viewed` | Page mounts (once) | _none_ |
| `landing.hero_cta_clicked` | Hero "Get started" clicked | _none_ |
| `landing.plan_cta_clicked` | A pricing card CTA clicked | `{ plan: string }` (e.g. `"individual"`, `"corporate"`) |
| `landing.signin_clicked` | Any "Sign in" link clicked (hero or footer) | _none_ |
| `landing.faq_expanded` | A FAQ item is opened | `{ faqId: string }` |
| `landing.scroll_depth` | Scroll passes a milestone (once each) | `{ depthPercent: 25 \| 50 \| 75 \| 100 }` |

## How elements opt in

Events are wired by **event delegation** in
[`AnalyticsProvider`](./AnalyticsProvider.tsx) so server-rendered markup stays in
the static HTML. Elements opt in with data attributes:

- `data-analytics="hero_cta" | "plan_cta" | "signin"` — click events
- `data-plan="<id>"` — required alongside `plan_cta`
- `data-analytics="faq"` + `data-faq-id="<id>"` on the `<details>` — FAQ expansion

## Example consumer

```html
<!-- Deployment-managed: forward dataLayer to your tool of choice -->
<script>
  window.dataLayer = window.dataLayer || [];
  const push = window.dataLayer.push.bind(window.dataLayer);
  window.dataLayer.push = (e) => { /* forward e to your analytics */ return push(e); };
</script>
```
