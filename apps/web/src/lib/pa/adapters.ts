import Anthropic from "@anthropic-ai/sdk";
import type { AiProviderRow } from "../db/pa-schema";

/**
 * Spec 002 T002 — provider adapter layer.
 *
 * One interface over OpenAI-compatible (OpenAI / Ollama / Groq / vLLM / LM
 * Studio), Anthropic, and custom providers. This slice streams text only;
 * tool-use mapping lands with the skill-invocation runtime (T006).
 */
export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatDelta =
  | { type: "text"; text: string }
  | { type: "usage"; prompttokens?: number; completiontokens?: number };

export type ChatOptions = {
  system?: string;
  messages: ChatMessage[];
  maxTokens?: number;
  signal?: AbortSignal;
};

// ── Tool-use types (T006) ────────────────────────────────────────────────────

export type ToolDef = {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
};

export type ToolCall = { id: string; name: string; arguments: unknown };

export type LoopMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; name: string; content: string };

export type CompleteResult = {
  text: string;
  toolCalls: ToolCall[];
  prompttokens?: number;
  completiontokens?: number;
};

export type CompleteOptions = {
  system?: string;
  messages: LoopMessage[];
  tools?: ToolDef[];
  maxTokens?: number;
  signal?: AbortSignal;
};

export interface ProviderAdapter {
  /** Streaming text-only turn (no tools). */
  streamChat(opts: ChatOptions): AsyncGenerator<ChatDelta>;
  /** Non-streaming turn that may return tool calls (drives the T006 loop). */
  complete(opts: CompleteOptions): Promise<CompleteResult>;
}

export function getAdapter(provider: AiProviderRow): ProviderAdapter {
  switch (provider.type) {
    case "anthropic":
      return new AnthropicAdapter(provider);
    // openai-compatible, ollama, and custom all speak the OpenAI chat API in
    // this slice (custom transformer hook deferred).
    default:
      return new OpenAICompatibleAdapter(provider);
  }
}

// ── OpenAI-compatible ────────────────────────────────────────────────────────

class OpenAICompatibleAdapter implements ProviderAdapter {
  constructor(private readonly p: AiProviderRow) {}

  async *streamChat(opts: ChatOptions): AsyncGenerator<ChatDelta> {
    const base = this.p.baseurl.replace(/\/+$/, "");
    const messages = [
      ...(opts.system ? [{ role: "system", content: opts.system }] : []),
      ...opts.messages,
    ];
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.p.apikey ? { authorization: `Bearer ${this.p.apikey}` } : {}),
      },
      body: JSON.stringify({
        model: this.p.model,
        messages,
        max_tokens: opts.maxTokens ?? 1024,
        stream: true,
        stream_options: { include_usage: true },
      }),
      signal: opts.signal,
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw new ProviderError(`provider_error_${res.status}`, text.slice(0, 500));
    }

    for await (const data of sseLines(res.body)) {
      if (data === "[DONE]") return;
      let json: OpenAIChunk;
      try {
        json = JSON.parse(data) as OpenAIChunk;
      } catch {
        continue;
      }
      const token = json.choices?.[0]?.delta?.content;
      if (token) yield { type: "text", text: token };
      if (json.usage) {
        yield {
          type: "usage",
          prompttokens: json.usage.prompt_tokens,
          completiontokens: json.usage.completion_tokens,
        };
      }
    }
  }

  async complete(opts: CompleteOptions): Promise<CompleteResult> {
    const base = this.p.baseurl.replace(/\/+$/, "");
    const messages: unknown[] = [
      ...(opts.system ? [{ role: "system", content: opts.system }] : []),
      ...opts.messages.map((m) => {
        if (m.role === "tool") {
          return { role: "tool", tool_call_id: m.tool_call_id, content: m.content };
        }
        if (m.role === "assistant") {
          return {
            role: "assistant",
            content: m.content || null,
            ...(m.tool_calls?.length
              ? {
                  tool_calls: m.tool_calls.map((tc) => ({
                    id: tc.id,
                    type: "function",
                    function: { name: tc.name, arguments: JSON.stringify(tc.arguments ?? {}) },
                  })),
                }
              : {}),
          };
        }
        return { role: "user", content: m.content };
      }),
    ];

    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.p.apikey ? { authorization: `Bearer ${this.p.apikey}` } : {}),
      },
      body: JSON.stringify({
        model: this.p.model,
        messages,
        max_tokens: opts.maxTokens ?? 1024,
        ...(opts.tools?.length
          ? {
              tools: opts.tools.map((t) => ({
                type: "function",
                function: { name: t.name, description: t.description, parameters: t.parameters },
              })),
              tool_choice: "auto",
            }
          : {}),
      }),
      signal: opts.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new ProviderError(`provider_error_${res.status}`, text.slice(0, 500));
    }
    const json = (await res.json()) as OpenAICompletion;
    const msg = json.choices?.[0]?.message;
    return {
      text: msg?.content ?? "",
      toolCalls: (msg?.tool_calls ?? []).map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: safeParse(tc.function.arguments),
      })),
      prompttokens: json.usage?.prompt_tokens,
      completiontokens: json.usage?.completion_tokens,
    };
  }
}

type OpenAICompletion = {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
    };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s || "{}");
  } catch {
    return {};
  }
}

type OpenAIChunk = {
  choices?: Array<{ delta?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

// ── Anthropic ────────────────────────────────────────────────────────────────

class AnthropicAdapter implements ProviderAdapter {
  constructor(private readonly p: AiProviderRow) {}

  async *streamChat(opts: ChatOptions): AsyncGenerator<ChatDelta> {
    const client = new Anthropic({
      apiKey: this.p.apikey,
      ...(this.p.baseurl ? { baseURL: this.p.baseurl } : {}),
    });
    const stream = client.messages.stream({
      model: this.p.model, // user-supplied model id from the provider row
      max_tokens: opts.maxTokens ?? 1024,
      ...(opts.system ? { system: opts.system } : {}),
      messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield { type: "text", text: event.delta.text };
      }
    }
    const final = await stream.finalMessage();
    yield {
      type: "usage",
      prompttokens: final.usage.input_tokens,
      completiontokens: final.usage.output_tokens,
    };
  }

  async complete(opts: CompleteOptions): Promise<CompleteResult> {
    const client = new Anthropic({
      apiKey: this.p.apikey,
      ...(this.p.baseurl ? { baseURL: this.p.baseurl } : {}),
    });

    // Build Anthropic messages, coalescing consecutive tool results into one
    // user turn (the API requires tool_result blocks grouped after the tool_use turn).
    const messages: Anthropic.MessageParam[] = [];
    for (const m of opts.messages) {
      if (m.role === "user") {
        messages.push({ role: "user", content: m.content });
      } else if (m.role === "assistant") {
        const blocks: Anthropic.ContentBlockParam[] = [];
        if (m.content) blocks.push({ type: "text", text: m.content });
        for (const tc of m.tool_calls ?? []) {
          blocks.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.arguments as object });
        }
        messages.push({ role: "assistant", content: blocks });
      } else {
        // tool result — append to a trailing user turn if present, else open one.
        const block: Anthropic.ContentBlockParam = {
          type: "tool_result",
          tool_use_id: m.tool_call_id,
          content: m.content,
        };
        const last = messages[messages.length - 1];
        if (last?.role === "user" && Array.isArray(last.content)) {
          (last.content as Anthropic.ContentBlockParam[]).push(block);
        } else {
          messages.push({ role: "user", content: [block] });
        }
      }
    }

    const res = await client.messages.create({
      model: this.p.model,
      max_tokens: opts.maxTokens ?? 1024,
      ...(opts.system ? { system: opts.system } : {}),
      messages,
      ...(opts.tools?.length
        ? {
            tools: opts.tools.map((t) => ({
              name: t.name,
              description: t.description,
              input_schema: t.parameters as Anthropic.Tool.InputSchema,
            })),
          }
        : {}),
    });

    let text = "";
    const toolCalls: ToolCall[] = [];
    for (const block of res.content) {
      if (block.type === "text") text += block.text;
      else if (block.type === "tool_use") {
        toolCalls.push({ id: block.id, name: block.name, arguments: block.input });
      }
    }
    return {
      text,
      toolCalls,
      prompttokens: res.usage.input_tokens,
      completiontokens: res.usage.output_tokens,
    };
  }
}

export class ProviderError extends Error {
  constructor(
    public code: string,
    public detail?: string,
  ) {
    super(code);
    this.name = "ProviderError";
  }
}

/** Parse an SSE byte stream into `data:` payload strings. */
async function* sseLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";
      for (const line of parts) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data:")) yield trimmed.slice(5).trim();
      }
    }
  } finally {
    reader.releaseLock();
  }
}
