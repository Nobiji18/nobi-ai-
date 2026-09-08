import { Search } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { fetchJson, isTimeout, withTimeout } from "@/lib/ai-client";
import { beginRequest, canSend, endRequest, SLOW_AFTER_MS } from "@/lib/guard";
import { STRINGS } from "@/lib/i18n";
import { useNobi } from "@/lib/store";
import type { Source } from "@/lib/types";
import { copyText, truncate, uid } from "@/lib/utils";
import { Markdown } from "./Markdown";
import { EmptyState, ErrorBanner, SlowHint } from "./shared";

export function ResearchView() {
  const t = STRINGS[useNobi((s) => s.language)];
  const language = useNobi((s) => s.language);
  const log = useNobi((s) => s.researchLog);
  const addResearch = useNobi((s) => s.addResearch);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastQuery = useRef("");

  async function run(q: string) {
    const check = canSend();
    if (!check.ok) {
      toast.error(check.error);
      return;
    }
    const trimmed = q.trim();
    if (!trimmed) return;
    lastQuery.current = trimmed;
    setQuery("");
    setBusy(true);
    setSlow(false);
    setError(null);
    const slowTimer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    beginRequest();
    const wrap = withTimeout();
    try {
      const result = await fetchJson<{ text: string; sources: Source[] }>(
        "/api/research",
        { query: trimmed, language },
        wrap.signal,
      );
      addResearch({
        id: uid(),
        query: trimmed,
        answer: result.text,
        sources: result.sources ?? [],
        createdAt: Date.now(),
      });
    } catch (err) {
      const msg = isTimeout(err)
        ? t.takingLonger
        : err instanceof Error
          ? err.message
          : t.retry;
      setError(msg);
    } finally {
      wrap.dispose();
      window.clearTimeout(slowTimer);
      setSlow(false);
      setBusy(false);
      endRequest();
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {log.length === 0 && !busy ? (
          <EmptyState title={t.emptyResearch} body="Google-style live search, clickable sources ke saath.">
            <div className="mt-6 grid w-full gap-2">
              {[
                "Aaj duniya mein kya chal raha hai?",
                "Latest on Grok and xAI",
                "India ke current top headlines",
              ].map((s) => (
                <button
                  key={s}
                  type="button"
                  className="rounded-[var(--radius-md)] bg-surface px-4 py-3 text-left text-sm shadow-[var(--shadow-border)] hover:bg-surface-2"
                  onClick={() => void run(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </EmptyState>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-8">
            {busy && (
              <div>
                <p className="shimmer text-sm">{t.searching}</p>
                {slow && <div className="mt-2"><SlowHint /></div>}
              </div>
            )}
            {error && <ErrorBanner message={error} onRetry={() => void run(lastQuery.current)} />}
            {log.map((item) => (
              <article key={item.id} className="border-b border-border pb-6 last:border-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  {item.query}
                </p>
                <div className="mt-3">
                  <Markdown text={item.answer} />
                </div>
                {item.sources.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {item.sources.map((s) => (
                      <a
                        key={s.url}
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full bg-surface px-2.5 py-1 text-[11px] text-muted shadow-[var(--shadow-border)] hover:text-fg"
                      >
                        {truncate(s.title, 36)}
                      </a>
                    ))}
                  </div>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2"
                  onClick={async () => {
                    await copyText(item.answer);
                    toast.success(t.copied);
                  }}
                >
                  {t.copy}
                </Button>
              </article>
            ))}
          </div>
        )}
      </div>
      <form
        className="shrink-0 border-t border-border px-3 py-3 sm:px-6"
        onSubmit={(e) => {
          e.preventDefault();
          void run(query);
        }}
      >
        <div className="mx-auto flex max-w-2xl items-end gap-2 rounded-[20px] bg-surface p-2 composer-shadow">
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kya research karna hai?"
            rows={1}
            className="min-h-[44px]"
          />
          <Button type="submit" size="icon" disabled={busy || !query.trim()} aria-label={t.send}>
            <Search />
          </Button>
        </div>
      </form>
    </div>
  );
}
