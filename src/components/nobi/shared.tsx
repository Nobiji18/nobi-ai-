import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  copyImage,
  copyText,
  dataUrlToFile,
  downloadBlob,
  shareOrCopy,
} from "@/lib/utils";
import { toast } from "sonner";

export function Mark({ className = "size-8" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-[var(--radius-sm)] bg-fg font-display text-[0.7em] font-semibold tracking-tight text-bg ${className}`}
    >
      N
    </span>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Mark className={compact ? "size-7 text-[11px]" : "size-8 text-xs"} />
      <div className="flex items-baseline gap-1.5 leading-none">
        <span className="font-display text-[15px] font-semibold tracking-tight">
          NOBI
        </span>
        {!compact && (
          <span className="font-display text-[13px] font-medium text-muted">AI</span>
        )}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-16 text-center">
      <Mark className="size-11 text-sm" />
      <h2 className="mt-5 font-display text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
      {children}
    </div>
  );
}

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[var(--radius-md)] bg-surface p-3 shadow-[var(--shadow-border)]">
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" />
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-relaxed">{message}</p>
        {onRetry && (
          <Button size="sm" variant="secondary" className="mt-2" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}

export function OfflineBanner() {
  return (
    <div className="flex items-center justify-center gap-2 bg-surface px-3 py-2 text-xs text-muted">
      <WifiOff className="size-3.5" />
      No internet connection
    </div>
  );
}

export function SlowHint() {
  return <p className="text-xs text-muted">Taking longer than usual…</p>;
}

export function ImageActions({
  dataUrl,
  name,
}: {
  dataUrl: string;
  name: string;
}) {
  async function onCopy() {
    try {
      await copyImage(dataUrl);
      toast.success("Copied!");
    } catch {
      await copyText(dataUrl);
      toast.success("Copied image link");
    }
  }
  async function onShare() {
    const file = dataUrlToFile(dataUrl, name.endsWith(".jpg") ? name : `${name}.jpg`);
    const result = await shareOrCopy({ title: name, files: [file] });
    if (result === "copied") toast.success("Copied!");
  }
  function onDownload() {
    const file = dataUrlToFile(dataUrl, name.endsWith(".jpg") ? name : `${name}.jpg`);
    downloadBlob(file, file.name);
  }
  return (
    <div className="flex items-center gap-1">
      <Button size="iconSm" variant="ghost" onClick={onCopy} aria-label="Copy">
        <Copy />
      </Button>
      <Button size="iconSm" variant="ghost" onClick={onShare} aria-label="Share">
        <Share2 />
      </Button>
      <Button size="iconSm" variant="ghost" onClick={onDownload} aria-label="Download">
        <Download />
      </Button>
    </div>
  );
}
