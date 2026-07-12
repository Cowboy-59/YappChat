# dbpush reports success while MCP silently blocks every spec

**Reported**: 2026-05-25
**Kit version**: v1.2.6
**Severity**: high — `dbpush` returns `status: success` with non-zero `specsCreated` / `tasksCreated` counts, but **zero rows are written** when the MCP preflight rejects the specs. Operators get a green report and discover later (UI shows nothing) that nothing landed.

## Symptom

On YappChat project `1993e2ba-2322-4b9d-809d-246ffdbe344c`, running `wxai dbpush` returns:

```json
{
  "status": "success",
  "artifact": {
    "validation": { "specsParsed": 11, "errorCount": 0, "errors": [], "warnings": [] },
    "push":       { "specsCreated": 11, "tasksCreated": 88, "errors": [] },
    "dryRun": false,
    "dbUnreachable": false
  }
}
```

But the wxKanban UI shows **no specs** for the project, and a direct query of `project.list_open_items` shows the newest task `createdAt` predates the run by hours. The `document_updated` event from the most recent `dbpush` IS persisted (capture_event succeeds), but no spec or task rows were created.

## Root cause

Two compounding bugs:

### Bug A — kit treats `{success: false}` 200-OK envelopes as success

`project.create_specs` on the hosted MCP returns HTTP 200 with this body when a spec fails its preflight quality gate:

```json
{
  "success": false,
  "blocked": true,
  "message": "create_specs blocked for scope 002. Resolve the scope quality issues first.",
  "blockingIssues": [
    "Business Problem must be specific and non-placeholder.",
    "Actors section must identify a primary actor.",
    "Actors section must identify at least one secondary actor.",
    "Success Metrics must include at least 3 measurable outcomes.",
    "Scope Boundary must define what is included.",
    "Scope documentation must define what is excluded from this iteration."
  ],
  "spec": null,
  "tasks": [],
  ...
}
```

The kit's `callMcpTool` at `wxkanban-agent/core/orchestrator/mcp-client.ts:66-92` only throws on non-2xx. It then returns the parsed JSON to `pushNewSpec` at `wxkanban-agent/dbpush.ts:378-399`, which **does not inspect the response** — it unconditionally increments `r.specsCreated++` and `r.tasksCreated += artifact.tasks.length`. The aggregated report at `wxkanban-agent/dbpush.ts:543-554` is therefore fiction whenever the server blocks.

The kit's Phase 2 read at `wxkanban-agent/dbpush.ts:310-347` also walks `resp.specs` from `project.list_open_items`, but the real envelope has only `tasks`, `documents`, `events` — no `specs` array — so `knownSpecNumbers` stays empty and every run unconditionally takes the `pushNewSpec` path, masking idempotency issues further.

### Bug B — YappChat specs don't satisfy the MCP preflight schema

The MCP preflight (`hasOverview`, `hasBusinessProblem`, `hasActors`, `hasSuccessMetrics`, `hasScopeBoundary`, `hasOutOfScope`, `hasOpenQuestions`) appears to look at **section headings**. YappChat's `specs/00X-*/spec.md` files (produced by `createspecs` and/or hand-authored) put `Scope Boundary` and other required fields as **inline bold labels inside the `## Overview` paragraph** rather than as their own `##` headings, so the preflight scores 7/100 and blocks the insert. See sample below.

Direct probe against MCP for spec 002:

```text
preflight.checks: { hasOverview:false, hasBusinessProblem:false, hasActors:false,
                    hasSuccessMetrics:false, hasScopeBoundary:false,
                    hasOutOfScope:false, hasOpenQuestions:false }
missingSections: [overview, business_problem, actors, success_metrics,
                  scope_boundary, out_of_scope, open_questions]
```

This is structural: every one of the 11 valid specs in this project will be rejected the same way until either the specs are restructured or the preflight is loosened / aligned with the kit's spec template.

## Reproduction

```powershell
# 1. Show kit reports success
.\bin\wxkanban-agent.cmd dbpush
# -> specsCreated: 11, tasksCreated: 88, errors: []

# 2. Probe MCP directly with the same payload shape
$h = @{ 'Authorization'='Bearer <token>'; 'Content-Type'='application/json' }
$b = @{
  tool='project.create_specs';
  args=@{ projectId='<projectId>'; specNumber='002';
          featureName='Personal Assistant'; scopeContent='<spec.md contents>';
          phase='design'; priority='medium'; tasks=@(); generateLifecycle=$false }
} | ConvertTo-Json -Depth 6
Invoke-RestMethod -Method Post -Uri 'https://mcp.wxperts.com/call' -Headers $h -Body $b
# -> { success: false, blocked: true, blockingIssues: [...] }
```

## Suggested fixes

1. **Kit (Bug A)**: After every `callMcpTool` in `pushNewSpec` / `pushExistingSpec`, inspect the returned object for `success === false` (and/or `blocked === true`) and push `blockingIssues` into `r.errors` instead of incrementing the success counters. Bonus: stop incrementing counters from local arrays — read `spec`, `tasks` from the response and count what the server actually persisted.
2. **Kit (Bug A.2)**: Fix Phase 2's read of `list_open_items` to handle the actual envelope. Either call a `project.list_specs` if one exists, or derive scope numbers from task title prefixes `[NNN-T###]`.
3. **MCP server**: When a tool's business-layer result is `success: false, blocked: true`, return HTTP 4xx so HTTP-level error handling triggers — or document the contract so callers know to check the inner success flag.
4. **Specs / `createspecs` template**: Update the kit's spec template to emit explicit `## Business Problem`, `## Actors`, `## Success Metrics`, `## Scope Boundary`, `## Out of Scope`, `## Open Questions` headings. Migrate the 11 YappChat specs to match (content already exists; mostly a heading-split exercise).

## Evidence captured

- `project.list_open_items` envelope: `tasks` array of 98 rows, `documents`, `events`. No `specs` key.
- Newest task `createdAt`: `2026-05-24 22:34` (yesterday's push). Today's runs created **0** rows.
- Today's `dbpush` event recorded at `2026-05-25 10:26` with metadata `{ specsProcessed: 11, validationErrors: 0, pushErrors: 0 }` — pushErrors should have been 11.
- `project.create_specs` direct probe for scope 002: `success: false`, 6 blocking issues listed above.
