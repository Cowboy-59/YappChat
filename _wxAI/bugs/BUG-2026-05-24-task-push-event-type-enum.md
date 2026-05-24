# BUG-2026-05-24 — `project.capture_event` schema rejects `task_push`, the type the kit's own task-push slash command tells callers to emit

**Identified**: 2026-05-24
**Status**: **RESOLVED** 2026-05-24 — fixed in wxKanban commit `8205755`, pending App Runner redeploy of mcp.wxperts.com.
**Environment**: Hosted MCP at `https://mcp.wxperts.com` v0.1.0; YappChat workspace v1.2.3
**Severity**: Medium — blocks the documented task-push audit trail

## Resolution

Chose **Option (a)** from the suggested-fix section: added `'task_push'` to the server-side enum. The kit's documented `_wxAI/commands/task-push.md` behaviour was canonical; the schema needed to catch up.

Two changes in `mcp-server/`:

1. [`src/utils/schemas.ts`](../../../wxKanban/mcp-server/src/utils/schemas.ts) — `ProjectEventTypeSchema` Zod enum gained `'task_push'` between `'task_completed'` and `'document_updated'`.
2. [`src/server.ts:1908`](../../../wxKanban/mcp-server/src/server.ts) — JSON-schema `enum` array published in the `tools/list` response also gained `'task_push'` so MCP clients see the correct accepted set.

Once App Runner finishes redeploying mcp.wxperts.com from the new wxKanban main, the reproduction `curl` below returns the event row instead of HTTP 500. The workaround of sending `'spec_created'` can be reverted — `'task_push'` audit rows will now be semantically correct.

## Symptom

`project.capture_event` rejects `type: "task_push"` with HTTP 500:

```text
MCP error -32602: Validation error:
type: Invalid enum value.
Expected 'meeting_notes' | 'chat_thread' | 'commit' | 'ticket_update'
       | 'manual_note' | 'spec_created' | 'task_created'
       | 'task_completed' | 'document_updated',
received 'task_push'
```

This means the kit's own task-push workflow can't write its audit row.

## Root cause

The slash-command spec at [`_wxAI/commands/task-push.md`](../commands/task-push.md) — the documented workflow for pushing spec tasks to wxKanban — explicitly tells callers to:

> **Capture Event** — Call `project.capture_event` with:
> - `type`: `"task_push"`
> - `source`: `"cli"`
> - `rawContent`: `"Pushing tasks for spec {{spec-number}}"`
> - Store returned `eventId` for linking

But the hosted MCP server's Zod schema for the event `type` field doesn't include `"task_push"` in its enum. Either the schema or the slash command is wrong; both shipped in the same kit version (v1.2.3) so this is a kit-internal drift.

## Reproduction

```bash
curl -sX POST https://mcp.wxperts.com/call \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-WxKanban-Project-Id: $PROJECT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "tool":"project.capture_event",
    "args":{
      "projectId":"<your-project-id>",
      "type":"task_push",
      "source":"cli",
      "rawContent":"test"
    }
  }'
# → HTTP 500 Validation error (enum mismatch)
```

## Suggested fix

Add `"task_push"` to the accepted enum on the server side. The slash command in `_wxAI/commands/task-push.md` (and any agent-side helpers built around it) is the canonical documented behaviour — the schema should match.

If `"task_push"` is intentionally rejected because the kit prefers a more generic audit semantic, update `_wxAI/commands/task-push.md` to instruct callers to use `"manual_note"` or another existing enum value, and document the choice. Either way, the documented command should match the server's accepted schema.

## Workaround applied 2026-05-24

When writing a one-off push script for the YappChat project, the workaround was to send `type: "spec_created"` instead of `"task_push"`. That value is accepted by the schema but is semantically a different event. Audit history therefore conflates the two operations until the bug is fixed.

## Related

- BUG-2026-05-24-mcp-silent-write-noop.md
- BUG-2026-05-24-createspecs-dbpush-format-mismatch.md
