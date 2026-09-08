import JSZip from "jszip";
import { Copy, Download, Globe, Code2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { fetchJson, isTimeout, withTimeout } from "@/lib/ai-client";
import { beginRequest, canSend, endRequest, SLOW_AFTER_MS } from "@/lib/guard";
import { langFromPath } from "@/lib/highlight";
import { STRINGS } from "@/lib/i18n";
import { useNobi } from "@/lib/store";
import type { CodeFile } from "@/lib/types";
import { byteLength, copyText, downloadBlob, downloadText, uid } from "@/lib/utils";
import { CodeBlock } from "./CodeBlock";
import { EmptyState, ErrorBanner, SlowHint } from "./shared";

type Mode = "code" | "website";

export function CodeView() {
  const t = STRINGS[useNobi((s) => s.language)];
  const language = useNobi((s) => s.language);
  const addFile = useNobi((s) => s.addFile);
  const [mode, setMode] = useState<Mode>("code");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<CodeFile[]>([]);
  const [explanation, setExplanation] = useState("");
  const [html, setHtml] = useState("");
  const [title, setTitle] = useState("");
  const [active, setActive] = useState(0);
  const [showPreview, setShowPreview] = useState(true);

  async function generate(followUp = false) {
    const check = canSend();
    if (!check.ok) {
      toast.error(check.error);
      return;
    }
    const trimmed = prompt.trim();
    if (!trimmed) return;
    setBusy(true);
    setSlow(false);
    setError(null);
    const slowTimer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    beginRequest();
    const wrap = withTimeout();
    try {
      if (mode === "website") {
        const result = await fetchJson<{ title: string; html: string }>(
          "/api/generate",
          {
            mode: "website",
            prompt: trimmed,
            language,
            previous: followUp && html ? { html } : undefined,
          },
          wrap.signal,
        );
        setHtml(result.html);
        setTitle(result.title);
        setShowPreview(true);
        addFile({
          id: uid(),
          name: `${result.title || "site"}.html`,
          kind: "website",
          size: byteLength(result.html),
          createdAt: Date.now(),
          mime: "text/html",
          html: result.html,
        });
      } else {
        const result = await fetchJson<{ explanation: string; files: CodeFile[] }>(
          "/api/generate",
          {
            mode: "code",
            prompt: trimmed,
            language,
            previous: followUp && files.length ? files : undefined,
          },
          wrap.signal,
        );
        setFiles(result.files);
        setExplanation(result.explanation);
        setActive(0);
        addFile({
          id: uid(),
          name: result.files[0]?.path ?? "project",
          kind: "code",
          size: result.files.reduce((n, f) => n + byteLength(f.content), 0),
          createdAt: Date.now(),
          mime: "text/plain",
          files: result.files,
          explanation: result.explanation,
        });
      }
      setPrompt("");
    } catch (err) {
      setError(
        isTimeout(err)
          ? t.takingLonger
          : err instanceof Error
            ? err.message
            : t.retry,
      );
    } finally {
      wrap.dispose();
      window.clearTimeout(slowTimer);
      setSlow(false);
      setBusy(false);
      endRequest();
    }
  }

  async function exportZip() {
    const zip = new JSZip();
    if (mode === "website") {
      zip.file("index.html", html);
    } else {
      for (const f of files) zip.file(f.path, f.content);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, mode === "website" ? "nobi-site.zip" : "nobi-project.zip");
  }

  const hasOutput = mode === "website" ? Boolean(html) : files.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-1 border-b border-border px-3">
        <Seg
          active={mode === "code"}
          onClick={() => setMode("code")}
          icon={<Code2 className="size-3.5" />}
          label={t.project}
        />
        <Seg
          active={mode === "website"}
          onClick={() => setMode("website")}
          icon={<Globe className="size-3.5" />}
          label={t.website}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!hasOutput && !busy ? (
          <EmptyState
            title={t.emptyCode}
            body={
              mode === "website"
                ? "Poori HTML/CSS/JS site banao, live preview ke saath."
                : "Multi-file project generate karo — copy, zip, save."
            }
          />
        ) : (
          <div className="mx-auto max-w-3xl px-4 py-4">
            {busy && (
              <p className="shimmer mb-4 text-sm">{t.thinking}</p>
            )}
            {slow && busy && <SlowHint />}
            {error && (
              <div className="mb-4">
                <ErrorBanner message={error} onRetry={() => void generate(false)} />
              </div>
            )}
            {mode === "website" && html && (
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <p className="mr-auto font-display text-sm font-semibold">{title}</p>
                  <Button size="sm" variant="ghost" onClick={() => setShowPreview((v) => !v)}>
                    {showPreview ? "Code" : t.preview}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await copyText(html);
                      toast.success(t.copied);
                    }}
                  >
                    <Copy className="size-3.5" /> {t.copy}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => void exportZip()}>
                    <Download className="size-3.5" /> {t.exportZip}
                  </Button>
                </div>
                {showPreview ? (
                  <iframe
                    title={title}
                    sandbox="allow-scripts"
                    srcDoc={html}
                    className="h-[52vh] w-full rounded-[var(--radius-lg)] bg-elevated shadow-[var(--shadow-border)]"
                  />
                ) : (
                  <CodeBlock code={html} language="html" path="index.html" />
                )}
              </div>
            )}
            {mode === "code" && files.length > 0 && (
              <div>
                <div className="mb-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await copyText(files.map((f) => `// ${f.path}\n${f.content}`).join("\n\n"));
                      toast.success(t.copied);
                    }}
                  >
                    <Copy className="size-3.5" /> {t.copy}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => void exportZip()}>
                    <Download className="size-3.5" /> {t.exportZip}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      downloadText(
                        files[active]?.content ?? "",
                        files[active]?.path ?? "file.txt",
                      )
                    }
                  >
                    {t.download}
                  </Button>
                </div>
                <div className="mb-2 flex gap-1 overflow-x-auto">
                  {files.map((f, i) => (
                    <button
                      key={f.path}
                      type="button"
                      onClick={() => setActive(i)}
                      className={`shrink-0 rounded-full px-3 py-1 text-xs ${
                        i === active ? "bg-fg text-bg" : "bg-surface text-muted"
                      }`}
                    >
                      {f.path}
                    </button>
                  ))}
                </div>
                {files[active] && (
                  <CodeBlock
                    code={files[active]!.content}
                    language={files[active]!.language || langFromPath(files[active]!.path)}
                    path={files[active]!.path}
                  />
                )}
                {explanation && (
                  <p className="mt-4 text-sm leading-relaxed text-muted">{explanation}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <form
        className="shrink-0 border-t border-border px-3 py-3 sm:px-6"
        onSubmit={(e) => {
          e.preventDefault();
          void generate(hasOutput);
        }}
      >
        <div className="mx-auto max-w-3xl rounded-[20px] bg-surface p-2 composer-shadow">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={hasOutput ? t.followUp : mode === "website" ? "Ek landing page banao…" : "React todo app banao…"}
            rows={2}
            className="min-h-[52px]"
          />
          <div className="flex justify-end px-1 pb-1">
            <Button type="submit" size="sm" disabled={busy || !prompt.trim()}>
              {t.generate}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Seg({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium ${
        active ? "bg-fg text-bg" : "text-muted hover:text-fg"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
