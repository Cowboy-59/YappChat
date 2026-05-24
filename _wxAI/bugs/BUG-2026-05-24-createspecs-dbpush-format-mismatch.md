# BUG-2026-05-24 — `createspecs` writes a tasks.md table format that `dbpush`'s parser regex doesn't match

**Identified**: 2026-05-24
**Status**: Open
**Environment**: `wxkanban-agent` v1.2.3 (kit version pinned by `.wxkanban-project.json` at this repo root)
**Severity**: Medium — silently zero-counts every task on dbpush

## Symptom

After running `createspecs` for 11 specs and then `wxkanban-agent dbpush`, the dry-run report shows:

```json
"specsParsed": 11,
"tasksCreated": 0
```

The specs themselves are recognised but **dbpush parses zero tasks per spec** even though every `tasks.md` file under `specs/NNN-<slug>/` contains a fully populated 8-row table.

Real impact: when `project.create_specs` is called from dbpush, the `tasks` array is empty, so the MCP server has no tasks to create. Even when `project.create_specs` is functioning correctly, dbpush will report success while creating zero work items.

## Root cause

`createspecs` and `dbpush` are both in [`wxkanban-agent/`](../../wxkanban-agent/) but they disagree on the `tasks.md` table format.

`createspecs` at [`wxkanban-agent/core/orchestrator/command-handlers/createspecs.ts`](../../wxkanban-agent/core/orchestrator/command-handlers/createspecs.ts) emits:

```markdown
| # | Task | Priority | Status |
|---|------|----------|--------|
| 1 | PA core: paconfigs + agent registration + ... | high | todo |
| 2 | AI provider registry + adapter layer ...     | high | todo |
```

`dbpush` at [`wxkanban-agent/dbpush.ts`](../../wxkanban-agent/dbpush.ts) parses with:

```ts
const TASKS_TABLE_ROW_RE =
  /^\|\s*(\d+)\s*\|\s*(T\d+)[:\s.]+([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/;
```

That regex requires `T\d+` (e.g. `T001`) as the **second** column. createspecs only puts the integer in column 1 and the title in column 2 — there is no `T###` prefix anywhere in column 2. Every row fails to match. The parser returns an empty list, and dbpush reports `tasksCreated: 0`.

## Reproduction

1. `wxkanban-agent createspecs --input <NNN>.json` — generates `specs/NNN-<slug>/tasks.md` with the table above.
2. `wxkanban-agent dbpush --dry-run` — reports `specsParsed: 11, tasksCreated: 0`.
3. Open any generated `tasks.md` and confirm the table has no `T###` token in column 2.

## Suggested fix

Pick a single canonical format and align both sides.

**Option A (preferred)** — change `dbpush`'s regex to match the format `createspecs` actually emits. The task number lives in column 1 and is one row at a time:

```ts
const TASKS_TABLE_ROW_RE =
  /^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/;
```

Then synthesise the `T###` id from the column-1 integer: `id: 'T' + String(num).padStart(3, '0')`.

**Option B** — change `createspecs`'s emitter to include the `T###` prefix in the title cell so the existing dbpush regex matches.

Either way both files need to ship in the same release so the kit is internally consistent. There should be a unit test that round-trips: createspecs → tasks.md → dbpush parser → expected task list.

## Workaround applied 2026-05-24

A hand-rolled push script at [`scripts/push-specs-to-mcp.mjs`](../../scripts/push-specs-to-mcp.mjs) walks `specs/NNN-*/tasks.md` directly using a parser that splits on the `### TNNN — Title` heading boundary (under `## Task Details`) rather than the summary table. That script bypassed dbpush entirely and pushed 88 of 88 tasks via `project.create_task` (modulo the unrelated server-side bug in BUG-2026-05-24-mcp-silent-write-noop.md).

## Related

- BUG-2026-05-24-mcp-silent-write-noop.md
- BUG-2026-05-24-task-push-event-type-enum.md
