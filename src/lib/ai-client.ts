import { CLIENT_TIMEOUT_MS } from "./guard";
import type { Lang, Source } from "./types";

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function readError(res: Response) {
  try {
    const j = (await res.json()) as { error?: string };
    if (j.error) return j.error;
  } catch {
    /* ignore */
  }
  if (res.status === 502 || res.status >= 500) {
    return "The AI service is having trouble right now. Please retry.";
  }
  return `Request failed (${res.status}). Please retry.`;
}

export async function fetchJson<T>(
  url: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new ApiError(await readError(res));
  return (await res.json()) as T;
}

export async function streamChat(opts: {
  messages: { role: string; content: string; image?: string }[];
  research?: boolean;
  language?: Lang;
  signal?: AbortSignal;
  onDelta: (text: string) => void;
}): Promise<{ text: string; sources: Source[] }> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: opts.messages,
      research: opts.research,
      language: opts.language ?? "hinglish",
    }),
    signal: opts.signal,
  });
  if (!res.ok) throw new ApiError(await readError(res));

  const ctype = res.headers.get("content-type") ?? "";
  if (ctype.includes("application/json")) {
    const j = (await res.json()) as { text?: string; sources?: Source[]; error?: string };
    if (j.error) throw new ApiError(j.error);
    const text = j.text ?? "";
    if (text) opts.onDelta(text);
    return { text, sources: j.sources ?? [] };
  }

  if (!res.body) throw new ApiError("Empty response. Please retry.");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  const sources: Source[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n");
    buffer = parts.pop() ?? "";
    for (const line of parts) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const json = JSON.parse(data) as {
          choices?: { delta?: { content?: string }; message?: { content?: string } }[];
          citations?: { url?: string; title?: string }[];
        };
        const piece =
          json.choices?.[0]?.delta?.content ??
          json.choices?.[0]?.message?.content ??
          "";
        if (piece) {
          text += piece;
          opts.onDelta(text);
        }
        if (Array.isArray(json.citations)) {
          for (const c of json.citations) {
            if (c.url) sources.push({ url: c.url, title: c.title || c.url });
          }
        }
      } catch {
        /* keep going */
      }
    }
  }
  return { text, sources };
}

export function withTimeout(parent?: AbortSignal) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error("timeout")), CLIENT_TIMEOUT_MS);
  const onAbort = () => ctrl.abort(parent?.reason);
  parent?.addEventListener("abort", onAbort);
  return {
    signal: ctrl.signal,
    dispose() {
      clearTimeout(timer);
      parent?.removeEventListener("abort", onAbort);
    },
  };
}

export function isTimeout(err: unknown) {
  if (!err) return false;
  if ((err as { name?: string }).name === "AbortError") return true;
  const msg = String((err as Error).message ?? err);
  return msg.toLowerCase().includes("timeout") || msg.includes("aborted");
}
