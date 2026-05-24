# BUG-2026-05-24 — mcp.wxperts.com v0.1.0 silently drops `upsert_document` and `create_specs` writes when caller targets a different project

**Identified**: 2026-05-24
**Status**: Open — pending server-side fix
**Environment**: Hosted MCP at `https://mcp.wxperts.com` v0.1.0; caller uses editor-role API token against YappChat project `1993e2ba-2322-4b9d-809d-246ffdbe344c`
**Severity**: High — silent data loss with success-shaped response

## Symptom

Calls to `project.upsert_document` and `project.create_specs` return HTTP 200 with the literal envelope `{"tasks":[],"documents":[],"events":[]}` and persist **nothing**, regardless of whether required arguments are present or absent. No validation error, no permission error, no log line surfaced to the caller.

Running `wxkanban-agent dbpush` against this server reports `specsCreated: 11, docsUpserted: 0, tasksCreated: 0` for a project full of valid spec dirs. The wxKanban board ends up with zero spec panels and zero documentation even though `dbpush` exits success.

## Root cause

`project.mcp_health` on this server returns:

```json
"projectContext": {
  "projectId": "ba924193-0335-4080-9fa6-33cd6b81300a",
  "source": "file",
  "projectFilePath": "/app/.wxkanban-project.json"
}
```

The server is pinned to the **wxKanban Development** project (`ba924193-…`) via a file inside its own container. When external callers send `X-WxKanban-Project-Id` headers and `projectId` in tool args, **some tools honor the request projectId and some don't**:

| Tool | Honors `projectId` arg | Result for cross-project caller |
| --- | --- | --- |
| `project.create_task` | yes | task lands in the requested project |
| `project.list_open_items` | yes | returns items for the requested project |
| `project.upsert_document` | **no** | writes target the file-bound `ba924193-…`; editor token has no write permission there → silent no-op |
| `project.create_specs` | **no** | same as above |

The hosted server treats `projectId` as advisory for some write tools and falls back to its file-bound context. The writes are effectively dropped for any caller working on a different project, and the response envelope looks identical to a successful empty-list response.

## Reproduction

```bash
TOKEN="<editor token for project 1993e2ba-…>"
PROJECT_ID="1993e2ba-2322-4b9d-809d-246ffdbe344c"

# Empty success-shaped response — write was dropped:
curl -sX POST https://mcp.wxperts.com/call \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-WxKanban-Project-Id: $PROJECT_ID" \
  -H "Content-Type: application/json" \
  -d '{"tool":"project.upsert_document","args":{"projectId":"'$PROJECT_ID'","title":"X","bodyMarkdown":"# x"}}'
# → {"content":[{"type":"text","text":"{\"tasks\":[],\"documents\":[],\"events\":[]}"}]}

# This works correctly — task lands in PROJECT_ID:
curl -sX POST https://mcp.wxperts.com/call \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-WxKanban-Project-Id: $PROJECT_ID" \
  -H "Content-Type: application/json" \
  -d '{"tool":"project.create_task","args":{"projectId":"'$PROJECT_ID'","title":"X","status":"todo"}}'
# → returns full task object with projectId=1993e2ba-…
```

## Real-world impact

On 2026-05-24 a `dbpush` run on YappChat reported success for 11 specs; only the per-task `project.create_task` fallback got 98 tasks across to the project hub. Every spec.md / plan.md / tests.md document was silently dropped. The user opened the kanban board expecting spec panels and saw 98 unparented tasks.

The combination of *(a) success-shaped response* and *(b) inconsistent projectId honoring across tools* is the worst possible failure mode: callers think writes succeeded and only discover the loss when they inspect the board manually.

## Suggested fix

For every write tool that accepts a `projectId` argument, validate `args.projectId` against the caller's authorized projects and route writes there. Fall through to the file-bound `projectContext` **only when the caller did not supply a `projectId`**.

Even better: return an explicit `403 unauthorized_project` envelope (or `400 project_not_found`) when a caller's token has no write permission on the target project. Silent success-shaped no-ops are unacceptable for write operations — any client that trusts the response will be misled.

## Workaround pending fix

- Manual paste into the wxKanban web UI for documents and specs.
- CLI `project.create_task` for tasks (this tool routes correctly).
- Hand-rolled scripts that call `project.create_task` per row instead of `project.create_specs` per spec.

## Related

- BUG-2026-05-24-task-push-event-type-enum.md — `capture_event` rejects valid CLI-emitted event types.
- BUG-2026-05-24-createspecs-dbpush-format-mismatch.md — kit-internal: `createspecs` and `dbpush` disagree on the tasks.md table format, so even if writes worked the dbpush task count would be zero.
