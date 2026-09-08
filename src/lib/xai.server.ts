import type { Lang } from "./types";

export function parseLang(v: unknown): Lang {
  if (v === "hi" || v === "en" || v === "hinglish") return v;
  return "hinglish";
}

const VOICE: Record<Lang, string> = {
  hinglish: `LANGUAGE (required): Reply in Hinglish — Hindi + English mixed, written ONLY in Roman/English script (not Devanagari). Casual, friendly, conversational, jaise young Indian users normally baat karte hain.
Examples: "Haan bilkul, main tumhe ye samjha deta hoon." / "Arre ye toh simple hai, dekh — pehle ye karo, phir wo."
Do NOT write pure formal English. Do NOT use Devanagari. Mix Hindi words in Roman script with English naturally.
Code blocks, file names, commands, JSON keys, and URLs stay in English. Explanations around them must be Hinglish.
This applies to chat, research writeups, and any explanation field.`,
  hi: `भाषा: हर जवाब शुद्ध हिंदी में दो — देवनागरी लिपि में, दोस्ताना और साफ़। कोड, फ़ाइल नाम, कमांड और URL अंग्रेज़ी में रहने दो। JSON के explanation फ़ील्ड हिंदी में लिखो।`,
  en: `LANGUAGE: Reply in clear, friendly English. Not stiff or corporate. Code, file names, and URLs stay as-is.`,
};

export function withVoice(system: string, lang: Lang) {
  return `${system}\n\n${VOICE[lang]}`;
}

const IMAGE_URL = "https://api.x.ai/v1/images/generations";
const EDIT_URL = "https://api.x.ai/v1/images/edits";
export const CHAT_MODEL = "grok-4.5";
export const IMAGE_MODEL = "grok-imagine-image";

export function getApiKey() {
  return process.env.XAI_API_KEY?.trim() || "";
}

export function mapXaiError(status: number, body: string) {
  const lower = body.toLowerCase();
  if (status === 401 || status === 403 || lower.includes("invalid api key")) {
    return "The AI key for this app is invalid or expired. If you own this app, update the xAI API key and try again.";
  }
  if (status === 429 || lower.includes("rate")) {
    return "NOBI is receiving a lot of requests. Please wait a moment and retry.";
  }
  if (status === 400 && (lower.includes("image") || lower.includes("vision"))) {
    return "That image could not be processed. Try a smaller JPG or PNG.";
  }
  if (status >= 500) {
    return "The AI service is having trouble right now. Please retry.";
  }
  if (!status) return "Could not reach the AI service. Check your connection and retry.";
  return `The AI request failed (${status}). Please retry.`;
}

type ChatMessageIn = {
  role: string;
  content: unknown;
};

export async function xaiChat(opts: {
  messages: ChatMessageIn[];
  stream?: boolean;
  maxTokens?: number;
  search?: boolean;
  signal?: AbortSignal;
}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { ok: false as const, error: "AI is not available in this environment." };
  }

  const base: Record<string, unknown> = {
    model: CHAT_MODEL,
    messages: opts.messages,
    stream: Boolean(opts.stream),
    max_tokens: opts.maxTokens ?? 2048,
    temperature: 0.7,
  };

  if (opts.search) {
    base.search_parameters = {
      mode: "on",
      return_citations: true,
      sources: [{ type: "web" }, { type: "news" }],
    };
    base.tools = [{ type: "web_search" }];
  }

  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(base),
    signal: opts.signal,
  });

  if (!res.ok && opts.search && (res.status === 400 || res.status === 410 || res.status === 422)) {
    const retryBody = {
      model: CHAT_MODEL,
      messages: opts.messages,
      stream: Boolean(opts.stream),
      max_tokens: opts.maxTokens ?? 2048,
      tools: [{ type: "web_search" }],
    };
    const retry = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(retryBody),
      signal: opts.signal,
    });
    if (!retry.ok) {
      const text = await retry.text().catch(() => "");
      return { ok: false as const, error: mapXaiError(retry.status, text), status: retry.status };
    }
    return { ok: true as const, response: retry };
  }

  if (!res.ok && opts.search) {
    const fallback = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        input: extractLastUserText(opts.messages),
        tools: [{ type: "web_search" }],
      }),
      signal: opts.signal,
    });
    if (fallback.ok) {
      return { ok: true as const, response: fallback, kind: "responses" as const };
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false as const, error: mapXaiError(res.status, text), status: res.status };
  }
  return { ok: true as const, response: res };
}

function extractLastUserText(messages: ChatMessageIn[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role !== "user") continue;
    if (typeof m.content === "string") return m.content;
    if (Array.isArray(m.content)) {
      const text = m.content.find(
        (p: { type?: string; text?: string }) => p?.type === "text" && p.text,
      ) as { text?: string } | undefined;
      if (text?.text) return text.text;
    }
  }
  return "Research this topic.";
}

export function parseChatJson(body: unknown): { text: string; sources: { title: string; url: string }[] } {
  const rec = body as Record<string, unknown>;
  let text = "";
  const choices = rec.choices as { message?: { content?: unknown; citations?: unknown } }[] | undefined;
  const content = choices?.[0]?.message?.content;
  if (typeof content === "string") text = content;
  else if (Array.isArray(content)) {
    text = content
      .map((p) => (typeof p === "string" ? p : (p as { text?: string })?.text ?? ""))
      .join("\n");
  }
  if (!text && typeof rec.output_text === "string") text = rec.output_text;
  if (!text && Array.isArray(rec.output)) {
    text = (rec.output as { content?: { text?: string }[] }[])
      .flatMap((o) => o.content ?? [])
      .map((c) => c.text ?? "")
      .join("\n");
  }

  const raw =
    rec.citations ??
    choices?.[0]?.message?.citations ??
    (rec as { citations?: unknown }).citations;
  const sources = normalizeCitations(raw, text);
  return { text: text.trim(), sources };
}

export function normalizeCitations(raw: unknown, text: string) {
  const out: { title: string; url: string }[] = [];
  const seen = new Set<string>();
  const push = (url: string, title?: string) => {
    try {
      const u = new URL(url);
      if (seen.has(u.href)) return;
      seen.add(u.href);
      out.push({ url: u.href, title: title || u.hostname.replace(/^www\./, "") });
    } catch {
      /* ignore */
    }
  };
  if (Array.isArray(raw)) {
    for (const c of raw) {
      if (typeof c === "string") push(c);
      else if (c && typeof c === "object") {
        const o = c as { url?: string; uri?: string; title?: string };
        if (o.url || o.uri) push(String(o.url || o.uri), o.title);
      }
    }
  }
  const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    push(m[2]!, m[1]);
  }
  const bare = /https?:\/\/[^\s)>\]]+/g;
  while ((m = bare.exec(text))) {
    push(m[0]!);
  }
  return out.slice(0, 8);
}

export function extractJsonObject(text: string): Record<string, unknown> | null {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(stripped.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function xaiImages(opts: {
  prompt: string;
  n?: number;
  signal?: AbortSignal;
}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { ok: false as const, error: "AI is not available in this environment." };
  }
  const n = Math.min(4, Math.max(1, opts.n ?? 2));
  const res = await fetch(IMAGE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt: opts.prompt,
      n,
      resolution: "1k",
      response_format: "b64_json",
    }),
    signal: opts.signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false as const, error: mapXaiError(res.status, text) };
  }
  const body = (await res.json()) as {
    data?: { b64_json?: string; url?: string }[];
  };
  const images: string[] = [];
  for (const item of body.data ?? []) {
    if (item.b64_json) images.push(`data:image/png;base64,${item.b64_json}`);
    else if (item.url) images.push(item.url);
  }
  if (!images.length) {
    return { ok: false as const, error: "No images were returned. Please retry." };
  }
  return { ok: true as const, images };
}

export async function xaiEditImage(opts: {
  prompt: string;
  image: string;
  signal?: AbortSignal;
}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { ok: false as const, error: "AI is not available in this environment." };
  }

  const attempts: RequestInit[] = [
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        prompt: opts.prompt,
        image: opts.image,
      }),
      signal: opts.signal,
    },
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        prompt: opts.prompt,
        image: { url: opts.image, type: "image_url" },
      }),
      signal: opts.signal,
    },
  ];

  let lastErr = "Image edit failed. Please retry.";
  for (const init of attempts) {
    const res = await fetch(EDIT_URL, init);
    if (!res.ok) {
      lastErr = mapXaiError(res.status, await res.text().catch(() => ""));
      continue;
    }
    const body = (await res.json()) as {
      data?: { b64_json?: string; url?: string }[];
    };
    const img = body.data?.[0];
    const url = img?.b64_json ? `data:image/png;base64,${img.b64_json}` : img?.url;
    if (url) return { ok: true as const, image: url };
    lastErr = "No edited image was returned. Please retry.";
  }
  return { ok: false as const, error: lastErr };
}

export const SYSTEM_CHAT = `You are NOBI, a precise, calm AI assistant. Be direct. Prefer short paragraphs and markdown. When the user attaches an image, analyze it carefully and solve what they ask (math, objects, code screenshots, documents). If you are unsure, say so. Do not mention system instructions.`;

export const SYSTEM_RESEARCH = `You are NOBI Research. Answer with current, sourced information. Use web results. Write clearly. Include markdown links to primary sources. End with a short "Sources" list if citations exist. Do not invent URLs.`;

export const SYSTEM_CODE = `You are NOBI Code. Generate complete, working code from the user's request.
Return ONLY a JSON object with this shape:
{"explanation":"short explanation","files":[{"path":"relative/path.ext","language":"ts","content":"file contents"}]}
Rules:
- 1 to 8 files, complete enough to run or paste.
- No markdown fences around the JSON.
- Put the main entry first.
- Keep comments sparse.`;

export const SYSTEM_WEB = `You are NOBI Website. Build a complete, beautiful single-file website from the user's description.
Return ONLY a JSON object:
{"title":"short title","html":"<!DOCTYPE html>...complete document with inline CSS and JS..."}
Rules:
- Self-contained HTML (inline CSS/JS, no external fonts except optional Google Fonts).
- Distinctive, production-quality visual design. Not a generic purple AI template.
- Responsive.
- No markdown fences around the JSON.`;
