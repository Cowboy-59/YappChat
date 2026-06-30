"use client";

import { useState } from "react";
import { AssistantChat } from "./AssistantChat";
import { ProviderManager } from "./ProviderManager";

/** Spec 002 (core) — tabbed assistant surface: chat + provider settings. */
export function AssistantApp() {
  const [tab, setTab] = useState<"chat" | "providers">("chat");
  return (
    <div>
      <div className="mb-6 flex gap-2">
        {(["chat", "providers"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize ${tab === t ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted"}`}
          >
            {t === "providers" ? "AI providers" : "Chat"}
          </button>
        ))}
      </div>
      {tab === "chat" ? <AssistantChat /> : <ProviderManager onActiveChange={() => setTab("chat")} />}
    </div>
  );
}
