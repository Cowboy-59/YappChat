# wxKanban kit defect — dbpush bursts all upserts unthrottled and never backs off on 429

**Reported by:** YappChat (project `1993e2ba-2322-4b9d-809d-246ffdbe344c`)
**Found on:** kit v1.7.28 (dist-only bundle). Latent in earlier versions — only a **real** (non-`--dry-run`) push exposes it.
**File:** bundled `wxkanban-agent/dist/cli.cjs` — the MCP client `callTool()` (posts to `${baseUrl}/call`) and the `dbpush` push loop. Raw source (`dbpush.ts`, mcp-client) was deleted at the dist-only switch, so this must be fixed upstream in the kit source.
**Severity:** Medium-High — a real `dbpush` **cannot fully sync any project with more than ~38 documents**; the highest-numbered specs silently stay stale. Validation passes (0 errors), so it *looks* like the content is fine.

---

## Summary

A real `dbpush` fires **~49–52 `project.upsert_document` calls in a single unthrottled burst**, in spec-number order. The MCP (`mcp.wxperts.com`) rate-limits after roughly 38 with:

```
429 Too Many Requests — {"error":"rate-limited","retryAfterSec":1}
```

The CLI's MCP client **does not honor the 429 / `retryAfterSec` and does not back off** (`retryAttempted:false` in the audit envelope). So the tail of the batch — deterministically the **highest spec numbers** — always fails. In this project that was reliably **017, 018, 068, 071, 087**.

Observed across repeated runs:

| Run | Docs upserted | Push errors | Tail that 429'd |
|-----|---------------|-------------|-----------------|
| 1st real push | 36 | 13 | 017/018/068/071/087 |
| immediate retry | ~38 | ~9–14 | same tail |
| after full 5-min cooldown | 38 | 14 | 012/017/018/068/071/087 |

Key properties that make this a true defect, not a transient:

- **Deterministic tail.** Re-running the whole command re-bursts and fails the *same* tail.
- **Cooldown doesn't help.** The bucket's max (~38) is smaller than the burst (~52), so even a fully-refilled bucket drops the last ~14.
- **`--dry-run` masks it entirely** — dry-run never writes, so every prior "0 errors / 49 docs" verification passed while the real write path was broken.
- **Silent staleness.** Because validation is 0 errors, a partial sync looks successful; the un-pushed specs quietly diverge from their (correct) files.

## Root cause

The MCP client has **no client-side throttle and no 429 backoff**. The server already advertises the correct wait via `retryAfterSec`, but `callTool()` ignores it on the `upsert_document` path and the push loop issues all calls back-to-back. The server rate-limit is a legitimate protection; the **client is non-compliant** with it.

## Why not "just raise the server limit" or "keep retrying"

- Raising/removing the server limit removes a legitimate abuse protection and only hides the un-throttled client.
- Retrying the whole command re-issues the full burst and fails the identical tail — it never converges.

## Fix (kit source)

Add throttling + `retryAfterSec`-honoring backoff at the **single choke point** every tool call flows through — the MCP client `callTool()` — so *all* commands (not just dbpush) become rate-limit-compliant:

```
async callTool(tool, args) {
  await this._spaceOut();                 // min-interval gate (e.g. ~300ms), serialized
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await this.fetchImpl(`${this.baseUrl}/call`, { ... });
    if (res.status !== 429) return this.toResult(res);
    const { retryAfterSec = 1 } = await res.clone().json().catch(() => ({}));
    await sleep((retryAfterSec + 0.5) * 1000);   // honor server's advertised wait
  }
  // exhausted retries -> surface as a real error
}
```

Secondary (defense in depth): have the `dbpush` push loop `await` each upsert with a small inter-call delay rather than firing them concurrently.

## Stopgap (no kit edit needed) — throttle at `fetch`

Until the kit ships the fix, run the **unmodified** CLI through a `--require` preload that wraps `globalThis.fetch` to serialize + space calls and honor `retryAfterSec`. Because the CLI uses the global `fetch` (`this.fetchImpl = e.fetchImpl ?? fetch`), preloading this before the CLI loads fixes every call with zero changes to the bundle (and survives kit upgrades, since it's not a dist edit):

```js
// throttle-fetch.cjs
const origFetch = globalThis.fetch;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MIN_GAP_MS = 350, MAX_RETRIES = 8;
let chain = Promise.resolve(), lastAt = 0;
async function runOne(args) {
  const wait = Math.max(0, lastAt + MIN_GAP_MS - Date.now());
  if (wait) await sleep(wait);
  let res = await origFetch(...args);
  for (let a = 1; a <= MAX_RETRIES && res.status === 429; a++) {
    let retryAfter = 1;
    try { const j = await res.clone().json(); if (typeof j?.retryAfterSec === "number") retryAfter = j.retryAfterSec; } catch {}
    await sleep((retryAfter + 0.5) * 1000);
    res = await origFetch(...args);
  }
  lastAt = Date.now();
  return res;
}
globalThis.fetch = (...args) => { const p = chain.then(() => runOne(args)); chain = p.then(() => {}, () => {}); return p; };
```

Run:

```
node -r ./throttle-fetch.cjs wxkanban-agent/dist/cli.cjs dbpush
```

## Verification

Before (plain CLI, real push): `Docs upserted: 38 · Push errors (14)` — 017/018/068/071/087 tail all `429`.
After (throttled preload, confirmed 2026-07-12): `Docs upserted: 49 · Push errors: 0 · Validation errors: 0` — full batch synced, entire tail (017/018/068/071/087) landed. The only difference is the `fetch` wrapper; the CLI/args are unchanged, proving the defect is purely the missing client-side throttle/backoff.

## Notes

- Prior kit-defect memory (`project_dbpush_fixes`) documented doctype + misclassification fixes; this is a **distinct, newly-exposed** defect on the real-write path.
- Doc identity for spec bodies is `(projectId, doctype:"specs", title)` (e.g. title `Spec 017 — Communities`) — re-upserting with the same title updates in place, so a throttled full re-run is idempotent and cannot orphan.
