import { NextResponse } from "next/server";
import { paContext, paError, readJson } from "@/lib/pa/http";
import { PaError } from "@/lib/pa/errors";
import { getAdapter, type LoopMessage } from "@/lib/pa/adapters";
import { resolveProviderRow } from "@/lib/pa/providers";
import { buildSkillTools, executeSkill } from "@/lib/pa/skill-runtime";
import { getActiveOrg } from "@/lib/auth/session";
import {
  appendMessage,
  getContext,
  listMessages,
  loadSession,
} from "@/lib/pa/sessions";

const MAX_TOOL_STEPS = 6;

export const dynamic = "force-dynamic";

/** GET /api/pa/sessions/:id/messages — cursor-paginated history. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await paContext();
  if (!ctx.ok) return ctx.response;
  const { id } = await params;
  const url = new URL(req.url);
  try {
    const messages = await listMessages(ctx.user.id, id, {
      before: url.searchParams.get("before") ?? undefined,
      limit: Number(url.searchParams.get("limit") ?? 50),
    });
    return NextResponse.json({ messages });
  } catch (err) {
    return paError(err);
  }
}

/**
 * POST /api/pa/sessions/:id/messages { content } — append the user message and
 * stream the assistant reply as Server-Sent Events.
 * Events: { type: "token", text } | { type: "done", usage } | { type: "error", error }.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await paContext();
  if (!ctx.ok) return ctx.response;
  const { id } = await params;
  const body = await readJson<{ content?: string }>(req);
  if (!body?.content?.trim()) {
    return NextResponse.json({ error: "content_required" }, { status: 400 });
  }

  let providerRow;
  try {
    const session = await loadSession(ctx.user.id, id);
    providerRow = await resolveProviderRow(ctx.user.id, session.providerid);
    if (!providerRow) throw new PaError("no_provider_configured", 409);
    await appendMessage(id, "user", body.content.trim());
  } catch (err) {
    return paError(err);
  }

  const context = await getContext(id);
  const adapter = getAdapter(providerRow);
  const encoder = new TextEncoder();

  // Tool loop is available when the provider supports tool use AND the caller's
  // org has enabled skills (spec 004). Otherwise fall back to streaming text.
  const org = await getActiveOrg(ctx.user.id);
  const { tools, byName } = org ? await buildSkillTools(org.id) : { tools: [], byName: new Map() };
  const useTools = providerRow.supportstooluse && tools.length > 0;
  const userId = ctx.user.id;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      let assistantText = "";
      let prompt: number | undefined;
      let completion: number | undefined;
      const toolsUsed: string[] = [];

      try {
        if (!useTools) {
          // ── Streaming text-only path ──
          for await (const delta of adapter.streamChat({
            messages: context,
            maxTokens: 2048,
            signal: req.signal,
          })) {
            if (delta.type === "text") {
              assistantText += delta.text;
              send({ type: "token", text: delta.text });
            } else if (delta.type === "usage") {
              prompt = delta.prompttokens;
              completion = delta.completiontokens;
            }
          }
        } else {
          // ── Tool loop (T006) ──
          const loop: LoopMessage[] = context.map((m) => ({ role: m.role, content: m.content }));
          for (let step = 0; step < MAX_TOOL_STEPS; step++) {
            const result = await adapter.complete({
              messages: loop,
              tools,
              maxTokens: 2048,
              signal: req.signal,
            });
            prompt = (prompt ?? 0) + (result.prompttokens ?? 0);
            completion = (completion ?? 0) + (result.completiontokens ?? 0);
            if (result.text) {
              assistantText += result.text;
              send({ type: "token", text: result.text });
            }
            if (result.toolCalls.length === 0) break;

            loop.push({ role: "assistant", content: result.text, tool_calls: result.toolCalls });
            for (const call of result.toolCalls) {
              send({ type: "tool_call", name: call.name, args: call.arguments });
              const skill = byName.get(call.name);
              let content: string;
              let ok = false;
              if (!skill) {
                content = JSON.stringify({ ok: false, error: "unknown_skill" });
              } else {
                const r = await executeSkill(skill, call.arguments, {
                  userid: userId,
                  sessionid: id,
                  invokedby: "pa",
                });
                content = r.content;
                ok = r.success;
                toolsUsed.push(call.name);
              }
              send({ type: "tool_result", name: call.name, ok });
              loop.push({ role: "tool", tool_call_id: call.id, name: call.name, content });
            }
          }
        }

        if (assistantText) {
          await appendMessage(id, "assistant", assistantText, { prompt, completion });
        }
        send({ type: "done", usage: { prompt, completion }, tools: toolsUsed });
      } catch (err) {
        if (assistantText) await appendMessage(id, "assistant", assistantText);
        send({ type: "error", error: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
