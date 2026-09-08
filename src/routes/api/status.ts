import { createFileRoute } from "@tanstack/react-router";
import { getApiKey } from "@/lib/xai.server";

export const Route = createFileRoute("/api/status")({
  server: {
    handlers: {
      GET: async () => Response.json({ ai: Boolean(getApiKey()) }),
    },
  },
});
