import { createFileRoute } from "@tanstack/react-router";
import {
  extractJsonObject,
  parseChatJson,
  parseLang,
  SYSTEM_CODE,
  SYSTEM_WEB,
  withVoice,
  xaiChat,
} from "@/lib/xai.server";
import type { CodeFile } from "@/lib/types";

export const Route = createFileRoute("/api/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: {
          mode?: "code" | "website";
          prompt?: string;
          previous?: unknown;
          language?: string;
        };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }
        const prompt = (body.prompt ?? "").trim();
        if (!prompt) return Response.json({ error: "Kya banana hai, wo likho." }, { status: 400 });
        const isWeb = body.mode === "website";
        const lang = parseLang(body.language);

        let user = prompt;
        if (body.previous) {
          user = isWeb
            ? `Update this website according to the instruction.\nInstruction: ${prompt}\nCurrent HTML:\n${String((body.previous as { html?: string }).html ?? "").slice(0, 24000)}`
            : `Update this project according to the instruction.\nInstruction: ${prompt}\nCurrent files JSON:\n${JSON.stringify(body.previous).slice(0, 24000)}`;
        }

        const result = await xaiChat({
          messages: [
            { role: "system", content: withVoice(isWeb ? SYSTEM_WEB : SYSTEM_CODE, lang) },
            { role: "user", content: user },
          ],
          stream: false,
          maxTokens: 4096,
          signal: request.signal,
        });
        if (!result.ok) {
          return Response.json({ error: result.error }, { status: 502 });
        }
        const json = await result.response.json();
        const { text } = parseChatJson(json);
        const obj = extractJsonObject(text);
        if (isWeb) {
          const html =
            (typeof obj?.html === "string" && obj.html) ||
            extractHtmlFallback(text);
          if (!html) {
            return Response.json(
              { error: "Website parse nahi hui. Phir try karo." },
              { status: 502 },
            );
          }
          const title =
            (typeof obj?.title === "string" && obj.title) || "Generated site";
          return Response.json({ title, html });
        }

        const files = normalizeFiles(obj, text);
        if (!files.length) {
          return Response.json(
            { error: "Project parse nahi hua. Phir try karo." },
            { status: 502 },
          );
        }
        const explanation =
          (typeof obj?.explanation === "string" && obj.explanation) ||
          "Generated project files.";
        return Response.json({ explanation, files });
      },
    },
  },
});

function extractHtmlFallback(text: string) {
  const m = text.match(/<!DOCTYPE html[\s\S]+<\/html>/i);
  return m?.[0] ?? "";
}

function normalizeFiles(obj: Record<string, unknown> | null, text: string): CodeFile[] {
  const raw = obj?.files;
  if (Array.isArray(raw)) {
    return raw
      .map((f) => {
        const r = f as { path?: string; language?: string; content?: string };
        if (!r.path || typeof r.content !== "string") return null;
        return {
          path: r.path,
          language: r.language || r.path.split(".").pop() || "text",
          content: r.content,
        };
      })
      .filter((x): x is CodeFile => Boolean(x));
  }
  if (text.trim()) {
    return [{ path: "output.txt", language: "text", content: text }];
  }
  return [];
}
