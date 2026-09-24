/**
 * One shared browser WebSocket to Phoenix's public market-data feed (`wss://perp-api.phoenix.trade/v1/ws`).
 * Market data is public and perp-api allows any origin, so the browser streams it directly instead of
 * polling through our server. Subscriptions are reference-counted and replayed on reconnect.
 */

export const PHOENIX_API = "https://perp-api.phoenix.trade";
const WS_URL = "wss://perp-api.phoenix.trade/v1/ws";
const MAX_BACKOFF_MS = 15_000;

export type SocketStatus = "connecting" | "live" | "offline";
type Message = { channel?: string } & Record<string, unknown>;
type Handler = (m: Message) => void;

interface Sub {
  subscription: Record<string, string>;
  /** Server messages carry a different shape per channel, so each subscriber says which ones are its own. */
  listeners: Set<{ match: (m: Message) => boolean; handler: Handler }>;
}

class PhoenixSocket {
  private ws: WebSocket | null = null;
  private subs = new Map<string, Sub>();
  private statusListeners = new Set<(s: SocketStatus) => void>();
  private attempt = 0;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private idleClose: ReturnType<typeof setTimeout> | null = null;
  status: SocketStatus = "connecting";

  private setStatus(s: SocketStatus) {
    this.status = s;
    for (const l of this.statusListeners) l(s);
  }

  private send(type: "subscribe" | "unsubscribe", subscription: Record<string, string>) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type, subscription }));
  }

  private connect() {
    if (this.ws || typeof WebSocket === "undefined") return;
    this.setStatus("connecting");
    const ws = new WebSocket(WS_URL);
    this.ws = ws;
    ws.onopen = () => {
      this.attempt = 0;
      this.setStatus("live");
      for (const s of this.subs.values()) this.send("subscribe", s.subscription);
    };
    ws.onmessage = (e) => {
      let m: Message;
      try {
        m = JSON.parse(e.data as string) as Message;
      } catch {
        return;
      }
      for (const s of this.subs.values()) for (const l of s.listeners) if (l.match(m)) l.handler(m);
    };
    ws.onclose = () => {
      this.ws = null;
      if (this.subs.size === 0) return;
      this.setStatus("offline");
      const delay = Math.min(MAX_BACKOFF_MS, 500 * 2 ** this.attempt++);
      this.retry = setTimeout(() => {
        this.retry = null;
        this.connect();
      }, delay);
    };
    ws.onerror = () => ws.close();
  }

  subscribe(subscription: Record<string, string>, match: (m: Message) => boolean, handler: Handler): () => void {
    const key = JSON.stringify(subscription);
    let sub = this.subs.get(key);
    if (!sub) {
      sub = { subscription, listeners: new Set() };
      this.subs.set(key, sub);
      this.send("subscribe", subscription);
    }
    const listener = { match, handler };
    sub.listeners.add(listener);
    if (this.idleClose) clearTimeout(this.idleClose);
    this.idleClose = null;
    this.connect();
    return () => {
      const s = this.subs.get(key);
      if (!s) return;
      s.listeners.delete(listener);
      if (s.listeners.size > 0) return;
      this.subs.delete(key);
      this.send("unsubscribe", subscription);
      // Keep the socket briefly across market switches and remounts; close once nothing listens.
      if (this.subs.size === 0)
        this.idleClose = setTimeout(() => {
          if (this.subs.size > 0) return;
          if (this.retry) clearTimeout(this.retry);
          this.ws?.close();
          this.ws = null;
        }, 5_000);
    };
  }

  onStatus(listener: (s: SocketStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => void this.statusListeners.delete(listener);
  }
}

let socket: PhoenixSocket | null = null;
export const phoenixSocket = () => (socket ??= new PhoenixSocket());

export async function phoenixGet<T>(path: string): Promise<T> {
  const res = await fetch(`${PHOENIX_API}${path}`, { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) throw new Error(`Phoenix ${res.status}`);
  return (await res.json()) as T;
}
