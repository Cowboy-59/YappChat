"use client";

import { useEffect, useState } from "react";

type ChatMsg = { name: string; text: string; createdat: string };
type SummaryResp = { summary: string | null; count: number; messages: ChatMsg[] };

/** Spec 071 FR-028 — chat summary + transcript shown beneath the replay video. */
export function ReplayChatSummary({ presentationId }: { presentationId: string }) {
  const [data, setData] = useState<SummaryResp | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/presentations/${presentationId}/chat/summary`, { credentials: "include" })
      .then(async (r) => {
        if (!active) return;
        if (!r.ok) return setState("error");
        setData((await r.json()) as SummaryResp);
        setState("ready");
      })
      .catch(() => active && setState("error"));
    return () => {
      active = false;
    };
  }, [presentationId]);

  if (state === "loading") {
    return <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">Loading chat summary…</div>;
  }
  if (state === "error" || !data) return null;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">Chat summary</h3>
        {data.count > 0 && (
          <button onClick={() => setShowTranscript((v) => !v)} className="text-xs font-medium text-primary hover:underline">
            {showTranscript ? "Hide transcript" : `Show transcript (${data.count})`}
          </button>
        )}
      </div>

      {data.count === 0 ? (
        <p className="text-sm text-muted-foreground">No chat activity during this session.</p>
      ) : (
        <>
          {data.summary ? (
            <p className="whitespace-pre-wrap text-sm text-foreground">{data.summary}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{data.count} chat message{data.count === 1 ? "" : "s"} — summary unavailable.</p>
          )}

          {showTranscript && (
            <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-lg border border-border bg-background p-3 text-sm">
              {data.messages.map((m, i) => (
                <div key={i}>
                  <span className="font-semibold">{m.name}:</span> <span className="text-foreground">{m.text}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
