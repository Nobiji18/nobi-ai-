import { createFileRoute } from "@tanstack/react-router";
import {
  parseChatJson,
  parseLang,
  SYSTEM_CHAT,
  SYSTEM_RESEARCH,
  withVoice,
  xaiChat,
} from "@/lib/xai.server";

type InMsg = {
  role: "user" | "assistant" | "system";
  content: string;
  image?: string;
};

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { messages?: InMsg[]; research?: boolean; language?: string };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }
        const lang = parseLang(body.language);
        const incoming = (body.messages ?? []).slice(-16);
        const system = withVoice(body.research ? SYSTEM_RESEARCH : SYSTEM_CHAT, lang);
        const messages = [
          { role: "system", content: system },
          ...incoming
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => {
              if (m.image && m.role === "user") {
                return {
                  role: "user" as const,
                  content: [
                    {
                      type: "text",
                      text: m.content || "Is image ko analyze karo.",
                    },
                    { type: "image_url", image_url: { url: m.image } },
                  ],
                };
              }
              return { role: m.role, content: m.content };
            }),
        ];

        const result = await xaiChat({
          messages,
          stream: !body.research,
          maxTokens: body.research ? 1800 : 2048,
          search: Boolean(body.research),
          signal: request.signal,
        });

        if (!result.ok) {
          return Response.json({ error: result.error }, { status: 502 });
        }

        if (body.research) {
          const json = await result.response.json();
          const parsed = parseChatJson(json);
          return Response.json(parsed);
        }

        return new Response(result.response.body, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
          },
        });
      },
    },
  },
});
