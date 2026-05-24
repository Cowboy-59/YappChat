# dbpush env / config mismatch with init.mjs outputs

**Reported**: 2026-05-24
**Kit version**: v1.2.5
**Severity**: blocks `dbpush` (and any command using `callMcpTool`) on a clean install unless the operator manually re-exports two env vars per shell

## Symptom

After `node scripts/upgrade-kit.mjs` to v1.2.5 (or any clean `init.mjs` run on the hosted-MCP path), `wxai dbpush` fails to push:

```text
dbpush: phase 2 DB compare skipped (MCP not reachable at http://localhost:3002/call (fetch failed). Start the kit runtime with `node scripts/setup-mcp.mjs`.)
...
"push": { "specsCreated": 0, ..., "errors": [
  "MCP server unreachable; no specs pushed. ..."
] }
```

Validation parses cleanly (11 specs, 88 tasks for this project), but no rows reach the hosted Project Hub. Dry-run hides the issue: it walks the artifacts without ever calling MCP, so the JSON shows non-zero counts and `dbUnreachable: true` is easy to miss.

Workaround that proves the diagnosis:

```bash
MCP_BASE_URL=https://mcp.wxperts.com \
WXKANBAN_API_TOKEN=<token from .env> \
  node wxkanban-agent/apps/command-gateway/bin/wxai.mjs dbpush
# -> specsCreated: 11, tasksCreated: 88, dbUnreachable: false
```

## Root cause

Two independent contract mismatches between what `init.mjs` writes and what runtime code reads.

### 1. MCP URL — file path mismatch

`init.mjs` writes the hosted endpoint to **`.wxkanban-project.json`** at the project root:

```json
{
  "projectId": "...",
  "mcpBaseUrl": "https://mcp.wxperts.com",
  ...
}
```

`core/context/runtime-state.ts :: resolveServiceUrl('mcp')` only looks at **`.wxai/project.json`** `kit.mcpBaseUrl`. That file is not created by `init.mjs` on this path (the only `.wxai/project.json` in the repo is the example template under `wxkanban-agent/.wxai/`).

Resulting precedence walk:

1. runtime-state `mcp` entry — absent (hosted MCP, no local PID)
2. `MCP_BASE_URL` / `MCP_HTTP_URL` env — unset
3. `.wxai/project.json` `kit.mcpBaseUrl` — file does not exist
4. `MCP_HTTP_PORT` env — unset
5. **Fallback to `http://localhost:3002`** — wrong endpoint, no listener, `fetch failed`.

### 2. API token — env-var name + no `.env` loader

`init.mjs` writes the token to `.env` as **`WXKANBAN_API_TOKEN`** (and the MCP URL again as `WXKANBAN_MCP_BASE_URL`):

```dotenv
WXKANBAN_MCP_BASE_URL=https://mcp.wxperts.com
WXKANBAN_API_TOKEN=...
WXKANBAN_PROJECT_ID=...
```

- `core/orchestrator/mcp-client.ts:36` reads `process.env['WXKANBAN_API_TOKEN']` — correct env-var name.
- `resolveServiceUrl` reads `MCP_BASE_URL` / `MCP_HTTP_URL` — does **not** check the `WXKANBAN_`-prefixed name that init writes.
- Neither the wxai shim (`apps/command-gateway/bin/wxai.mjs`) nor the gateway runtime calls `dotenv/config`. `.env` is purely documentation unless the operator runs the CLI from a shell that already exported its contents.

Net effect: even after the URL is reachable, MCP returns `401 missing-token` because `WXKANBAN_API_TOKEN` is unset in the wxai child process.

## Fix applied locally (URL side only)

`core/context/runtime-state.ts` — added two fallbacks to `resolveServiceUrl('mcp')`:

1. `WXKANBAN_MCP_BASE_URL` env var (in addition to `MCP_BASE_URL` / `MCP_HTTP_URL`).
2. `.wxkanban-project.json` `mcpBaseUrl` field (after `.wxai/project.json` `kit.mcpBaseUrl`, before the legacy `localhost:3002` default), via a new `readWxkanbanProjectMcpBaseUrl` helper.

Verified with `wxai dbpush --dry-run`: the failure mode changes from `fetch failed (localhost:3002)` → `401 Unauthorized (hosted MCP)`, confirming the URL fallback fires.

## Token loader applied locally (Option A)

`apps/command-gateway/bin/wxai.mjs` now parses `.env` at `process.cwd()` and merges it into `process.env` before spawning tsx. Existing exported vars win — `.env` only fills holes. Implemented inline (no `dotenv` dep) since the shim has zero npm dependencies today.

Verified end-to-end: `node wxkanban-agent/apps/command-gateway/bin/wxai.mjs dbpush` with no manual env exports → `specsCreated: 11, tasksCreated: 88, dbUnreachable: false`.

## Still needed upstream

Both local patches should land upstream so they're not carried as diffs:

1. `core/context/runtime-state.ts` — `WXKANBAN_MCP_BASE_URL` env + `.wxkanban-project.json` `mcpBaseUrl` fallbacks.
2. `apps/command-gateway/bin/wxai.mjs` — `.env` autoload (or swap in `dotenv/config` if a dep is acceptable).

Alternative to (2) if a shim change is undesirable: add `readWxkanbanProjectToken` / `readDotEnvToken` helpers in `mcp-client.ts` so `callMcpTool` reads the token directly when `process.env['WXKANBAN_API_TOKEN']` is unset.

## Repro

1. Fresh kit install on the hosted-MCP path (`init.mjs` writes `.wxkanban-project.json` + `.env` but no `.wxai/project.json` `kit` block).
2. Open a new shell — do not export `MCP_BASE_URL` or `WXKANBAN_API_TOKEN`.
3. `node wxkanban-agent/apps/command-gateway/bin/wxai.mjs dbpush --dry-run`
4. Observe `MCP not reachable at http://localhost:3002/call`.

## Files touched (local fix)

- `wxkanban-agent/core/context/runtime-state.ts` — added `readWxkanbanProjectMcpBaseUrl` + `WXKANBAN_MCP_BASE_URL` env entry.
