import { createFileRoute } from "@tanstack/react-router";
import { xaiEditImage, xaiImages } from "@/lib/xai.server";

const STYLE: Record<string, string> = {
  realistic:
    "Photorealistic photography, natural lighting, fine detail, no illustration.",
  cartoon:
    "Bold cartoon illustration, clean shapes, expressive, print-ready.",
  anime: "Anime still, cinematic lighting, detailed background, 2D.",
  "3d": "Stylized 3D render, studio lighting, tactile materials.",
};

export const Route = createFileRoute("/api/image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: {
          mode?: "generate" | "edit";
          prompt?: string;
          style?: string;
          n?: number;
          image?: string;
        };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }
        const prompt = (body.prompt ?? "").trim();
        if (!prompt) {
          return Response.json({ error: "Describe the image." }, { status: 400 });
        }

        if (body.mode === "edit") {
          if (!body.image) {
            return Response.json({ error: "Attach a photo to edit." }, { status: 400 });
          }
          const result = await xaiEditImage({
            prompt,
            image: body.image,
            signal: request.signal,
          });
          if (!result.ok) return Response.json({ error: result.error }, { status: 502 });
          return Response.json({ images: [result.image] });
        }

        const style = STYLE[body.style ?? ""] ?? "";
        const full = style ? `${prompt}\n\nStyle: ${style}` : prompt;
        const n = Math.min(4, Math.max(2, body.n ?? 2));
        const result = await xaiImages({ prompt: full, n, signal: request.signal });
        if (!result.ok) return Response.json({ error: result.error }, { status: 502 });
        return Response.json({ images: result.images });
      },
    },
  },
});
