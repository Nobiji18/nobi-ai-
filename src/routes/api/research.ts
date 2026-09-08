import { createFileRoute } from "@tanstack/react-router";
import {
  parseChatJson,
  parseLang,
  SYSTEM_RESEARCH,
  withVoice,
  xaiChat,
} from "@/lib/xai.server";

export const Route = createFileRoute("/api/research")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { query?: string; language?: string };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }
        const query = (body.query ?? "").trim();
        if (!query) return Response.json({ error: "Sawal likho." }, { status: 400 });
        const lang = parseLang(body.language);

        const result = await xaiChat({
          messages: [
            { role: "system", content: withVoice(SYSTEM_RESEARCH, lang) },
            { role: "user", content: query },
          ],
          stream: false,
          maxTokens: 1800,
          search: true,
          signal: request.signal,
        });
        if (!result.ok) {
          return Response.json({ error: result.error }, { status: 502 });
        }
        const json = await result.response.json();
        const parsed = parseChatJson(json);
        if (!parsed.text) {
          return Response.json(
            { error: "Answer nahi aaya. Phir try karo." },
            { status: 502 },
          );
        }
        return Response.json(parsed);
      },
    },
  },
});
