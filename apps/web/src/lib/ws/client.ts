import type { ClientMessage, ServerMessage, WSEvent } from "./events";

/**
 * Spec 003 — browser WS client.
 *
 * Singleton-style class used by all scopes (not a React component). Handles:
 *  - auto-reconnect with exponential backoff (1→2→4→8→max 30s),
 *  - re-subscribe + `resume(lastEventId)` on reconnect so missed events replay
 *    through the normal `on()` handlers (consumers need no replay-specific code),
 *  - app-level heartbeat (25s) with a 10s `heartbeat_ack` watchdog,
 *  - typing send with 2s debounce.
 *
 * The connection authenticates with a short-lived token fetched from
 * /api/ws/token (same-origin, session-backed) and passed in the handshake URL —
 * so it works cross-domain (app domain → ws.wxperts.com) with no cookie. A fresh
 * token is fetched on every (re)connect.
 */
type Handler = (event: WSEvent) => void;
export type WSStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

const HEARTBEAT_INTERVAL_MS = 25_000;
const HEARTBEAT_TIMEOUT_MS = 10_000;
const TYPING_DEBOUNCE_MS = 2_000;

export class WSClient {
  private ws?: WebSocket;
  private readonly subs = new Set<string>();
  private readonly handlers = new Map<string, Set<Handler>>();
  private reconnectDelay = 1000;
  private closed = false;
  private hadConnection = false;
  private lastEventId: string | null = null;

  private _status: WSStatus = "disconnected";
  private readonly statusListeners = new Set<(s: WSStatus) => void>();
  private lastCloseInfo: { code: number; reason: string } | null = null;

  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private heartbeatWatchdog?: ReturnType<typeof setTimeout>;
  private readonly typingDebounce = new Map<string, number>();

  constructor(private readonly url: string) {}

  get status(): WSStatus {
    return this._status;
  }

  get lastClose(): { code: number; reason: string } | null {
    return this.lastCloseInfo;
  }

  /** Subscribe to status changes; returns an unsubscribe fn. */
  onStatus(listener: (s: WSStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private setStatus(s: WSStatus): void {
    if (this._status === s) return;
    this._status = s;
    for (const l of this.statusListeners) l(s);
  }

  connect(): void {
    this.closed = false;
    this.setStatus(this.hadConnection ? "reconnecting" : "connecting");
    void this.openSocket();
  }

  /** Fetch a fresh handshake token, then open the socket with it in the URL. */
  private async openSocket(): Promise<void> {
    let token: string | null = null;
    try {
      const r = await fetch("/api/ws/token", { credentials: "include" });
      if (r.ok) token = ((await r.json()) as { token?: string }).token ?? null;
    } catch {
      /* fall through — try the bare URL (cookie fallback / will reconnect) */
    }
    if (this.closed) return;
    const url = token ? `${this.url}${this.url.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}` : this.url;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectDelay = 1000;
      this.setStatus("connected");
      // Re-apply subscriptions, then resume from the last event we saw.
      for (const scope of this.subs) this.send({ action: "subscribe", scope });
      if (this.hadConnection && this.lastEventId) {
        this.send({ action: "resume", lastEventId: this.lastEventId });
      }
      this.hadConnection = true;
      this.startHeartbeat();
    };
    ws.onmessage = (ev) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(ev.data) as ServerMessage;
      } catch {
        return;
      }
      this.handle(msg);
    };
    ws.onclose = (ev) => {
      this.lastCloseInfo = { code: ev.code, reason: ev.reason };
      this.stopHeartbeat();
      if (this.closed) {
        this.setStatus("disconnected");
        return;
      }
      this.setStatus("reconnecting");
      setTimeout(() => this.connect(), this.reconnectDelay);
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
    };
    ws.onerror = () => ws.close();
  }

  private handle(msg: ServerMessage): void {
    switch (msg.type) {
      case "event":
        this.lastEventId = msg.event.id;
        this.dispatch(msg.event);
        break;
      case "heartbeat_ack":
        if (this.heartbeatWatchdog) {
          clearTimeout(this.heartbeatWatchdog);
          this.heartbeatWatchdog = undefined;
        }
        break;
      case "replay_unavailable":
        // Caller should fall back to a full REST refresh; surface via "*" handlers.
        this.dispatch({
          id: this.lastEventId ?? "",
          type: "ws.replay_unavailable",
          scope: "",
          payload: { reason: msg.reason },
          ts: Date.now(),
        });
        break;
      // connected / ready / subscribed / unsubscribed / replay_start / replay_end /
      // pong / error are control messages — no consumer dispatch needed.
      default:
        break;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send({ action: "heartbeat" });
      // If no ack within the timeout, treat the connection as dead and reconnect.
      this.heartbeatWatchdog = setTimeout(() => {
        this.ws?.close();
      }, HEARTBEAT_TIMEOUT_MS);
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.heartbeatWatchdog) clearTimeout(this.heartbeatWatchdog);
    this.heartbeatTimer = undefined;
    this.heartbeatWatchdog = undefined;
  }

  private dispatch(event: WSEvent): void {
    for (const h of this.handlers.get(event.type) ?? []) h(event);
    for (const h of this.handlers.get("*") ?? []) h(event);
  }

  private send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  subscribe(scope: string): void {
    this.subs.add(scope);
    this.send({ action: "subscribe", scope });
  }

  unsubscribe(scope: string): void {
    this.subs.delete(scope);
    this.send({ action: "unsubscribe", scope });
  }

  /** Send a typing signal for a channel, debounced so keystrokes don't spam. */
  sendTyping(channelid: string): void {
    const now = Date.now();
    const last = this.typingDebounce.get(channelid) ?? 0;
    if (now - last < TYPING_DEBOUNCE_MS) return;
    this.typingDebounce.set(channelid, now);
    this.send({ action: "typing", channelid });
  }

  /** Register a handler for an event type ("*" for all). Returns an unsubscribe fn. */
  on(type: string, handler: Handler): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler);
    return () => set!.delete(handler);
  }

  close(): void {
    this.closed = true;
    this.stopHeartbeat();
    this.ws?.close();
    this.setStatus("disconnected");
  }
}
