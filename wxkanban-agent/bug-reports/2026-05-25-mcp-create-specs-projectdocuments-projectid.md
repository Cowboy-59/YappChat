# MCP `project.create_specs` 500: `scope-missing-column: projectdocuments.projectid not defined`

**Reported**: 2026-05-25
**Kit version**: v1.2.6
**MCP server**: `https://mcp.wxperts.com` (version reported by `/health`: `0.1.0`)
**Severity**: blocks every YappChat `dbpush` that passes a non-empty `tasks` array. Specs WITHOUT tasks insert fine.

## Symptom

After restructuring all 11 YappChat specs to satisfy the MCP preflight (all now score 100/100 in isolation), `wxai dbpush` produces:

```json
{
  "push": {
    "specsCreated": 0, "tasksCreated": 0,
    "errors": [
      "create_specs 002: MCP tool project.create_specs returned 500 Internal Server Error — {\"error\":\"Tool execution failed\",\"message\":\"MCP error -32603: Error executing tool project.create_specs: scope-missing-column: projectdocuments.projectid not defined\"}",
      "create_specs 003: ... same ...",
      ...
      "create_specs 012: ... same ..."
    ]
  }
}
```

Every one of the 11 scopes (002-012) fails with the identical message.

## Bisection — task array is the trigger

Both probes use the exact same scope content and project ID:

```powershell
# WITHOUT tasks: success
$payload = @{ tool='project.create_specs'; args=@{ projectId='...'; specNumber='002';
              ...; tasks=@(); generateLifecycle=$false } }
# -> { success: True, message: "create_specs completed for scope 002." }

# WITH a single task: 500
$tasks = @( @{ title='Test'; description='Test'; priority='medium'; status='todo' } )
$payload = @{ tool='project.create_specs'; args=@{ ...; tasks=$tasks; ... } }
# -> 500 { error: "Tool execution failed",
#          message: "MCP error -32603: ... scope-missing-column:
#                    projectdocuments.projectid not defined" }
```

## Root cause (server-side, inferred)

The `create_specs` handler's task-insertion path joins or upserts into a `projectdocuments` table and references the column `projectdocuments.projectid` — but the deployed DB schema does not have that column. Either:

- A migration that adds `projectdocuments.projectid` was never deployed to the hosted DB.
- The column exists under a different name (e.g. `projectId` camelCase, or `project_id` snake) and the handler's query references the wrong identifier.
- A recent server deploy refactored a query and renamed the column on one side but not the other.

The kit cannot fix this — it lives entirely behind `https://mcp.wxperts.com`. From the kit's side the only mitigation would be to call `project.create_specs` with `tasks=[]` and then `project.upsert_task` (or equivalent) per task in a follow-up pass — assuming that path doesn't hit the same broken `projectdocuments.projectid` column.

## Note on yesterday's apparent success

Yesterday (2026-05-24) `dbpush` against the same project produced 98 task rows that are still queryable via `project.list_open_items`. So at that time the `create_specs` + tasks path was working. Something on the server between 2026-05-24 22:34 (last successful task write) and 2026-05-25 11:37 (first 500) regressed.

## Reproduction

```powershell
# Repo: e:\AI_Development\wxperts\YappChat (kit v1.2.6)
.\bin\wxkanban-agent.cmd dbpush
# -> all 11 specs return 500 with projectdocuments.projectid error
```

Or direct MCP probe (token + project ID from `.env`):

```powershell
$h = @{ 'Authorization'='Bearer <token>'; 'Content-Type'='application/json' }
$b = @{ tool='project.create_specs'; args=@{
        projectId='1993e2ba-2322-4b9d-809d-246ffdbe344c';
        specNumber='999'; featureName='Test'; scopeContent='<valid spec>';
        phase='design'; priority='low';
        tasks=@( @{ title='t'; description='t'; priority='medium'; status='todo' } );
        generateLifecycle=$false } } | ConvertTo-Json -Depth 6
Invoke-RestMethod -Method Post -Uri 'https://mcp.wxperts.com/call' -Headers $h -Body $b
# -> 500 projectdocuments.projectid not defined
```

## Suggested fixes (server-side)

1. Verify the hosted MCP DB has `projectdocuments.projectid` column. If missing, run the corresponding Drizzle migration on the hosted DB.
2. Audit the `project.create_specs` handler for any code path that references `projectdocuments` and confirm the column identifier matches the YappChat / wxKanban naming convention (`projectid` lowercase, no underscore — per `CLAUDE.md` DB conventions).
3. Add an integration test against the hosted DB that runs `project.create_specs` with a non-empty `tasks` array — the existing preflight tests pass because they presumably mock or use an empty tasks array.

## Related

- Companion report: `2026-05-25-dbpush-silent-success-on-blocked-specs.md` (kit-side bug — surfaces a 200-OK `success:false` envelope as a green report). That bug is now WORKED AROUND by restructuring all 11 YappChat specs to score 100/100, but the kit still over-reports success when MCP returns the `{success:false, blocked:true}` envelope. The 500 case in *this* report is handled correctly by the kit (it surfaces it as an error).
