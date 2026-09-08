import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { tokenize } from "@/lib/highlight";
import { copyText } from "@/lib/utils";
import { toast } from "sonner";

const CLS: Record<string, string> = {
  kw: "text-fg font-medium",
  str: "text-success",
  cmt: "text-subtle italic",
  num: "text-warn",
  plain: "text-muted",
};

export function CodeBlock({
  code,
  language,
  path,
}: {
  code: string;
  language?: string;
  path?: string;
}) {
  const [copied, setCopied] = useState(false);
  const tokens = tokenize(code);
  const label = path || language || "code";

  async function onCopy() {
    await copyText(code);
    setCopied(true);
    toast.success("Copied!");
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="my-2 overflow-hidden rounded-[var(--radius-md)] bg-bg shadow-[var(--shadow-border)]">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
        <span className="truncate font-mono text-[11px] text-muted">{label}</span>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex size-7 items-center justify-center rounded-[var(--radius-xs)] text-muted hover:bg-surface-2 hover:text-fg"
          aria-label="Copy code"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[12.5px] leading-relaxed">
        <code>
          {tokens.map((tok, i) => (
            <span key={i} className={CLS[tok.c]}>
              {tok.t}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
