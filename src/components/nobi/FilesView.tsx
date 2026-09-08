import JSZip from "jszip";
import { Copy, Download, MoreHorizontal, Pencil, Share2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import {
  ConfirmDialog,
  Dialog,
  DialogContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/overlays";
import { STRINGS } from "@/lib/i18n";
import { useNobi } from "@/lib/store";
import type { FileKind, SavedFile } from "@/lib/types";
import {
  copyText,
  dataUrlToFile,
  downloadBlob,
  downloadText,
  formatSize,
  formatWhen,
  shareOrCopy,
} from "@/lib/utils";
import { EmptyState } from "./shared";

const FILTERS: { id: "all" | FileKind; key: "filterAll" | FileKind }[] = [
  { id: "all", key: "filterAll" },
  { id: "image", key: "image" },
  { id: "code", key: "code" },
  { id: "website", key: "website" },
];

export function FilesView() {
  const t = STRINGS[useNobi((s) => s.language)];
  const files = useNobi((s) => s.files);
  const renameFile = useNobi((s) => s.renameFile);
  const deleteFile = useNobi((s) => s.deleteFile);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | FileKind>("all");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [delId, setDelId] = useState<string | null>(null);

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return files.filter((f) => {
      if (kind !== "all" && f.kind !== kind) return false;
      if (query && !f.name.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [files, q, kind]);

  async function copyItem(f: SavedFile) {
    if (f.dataUrl) {
      await copyText(f.dataUrl);
    } else if (f.html) {
      await copyText(f.html);
    } else if (f.files) {
      await copyText(f.files.map((x) => `// ${x.path}\n${x.content}`).join("\n\n"));
    }
    toast.success(t.copied);
  }

  async function shareItem(f: SavedFile) {
    if (f.dataUrl) {
      const file = dataUrlToFile(f.dataUrl, f.name);
      const r = await shareOrCopy({ title: f.name, files: [file] });
      if (r === "copied") toast.success(t.copied);
      return;
    }
    const text = f.html ?? f.files?.map((x) => x.content).join("\n") ?? f.name;
    const r = await shareOrCopy({ title: f.name, text });
    if (r === "copied") toast.success(t.copied);
  }

  async function downloadItem(f: SavedFile) {
    if (f.dataUrl) {
      downloadBlob(dataUrlToFile(f.dataUrl, f.name), f.name);
      return;
    }
    if (f.html) {
      downloadText(f.html, f.name.endsWith(".html") ? f.name : `${f.name}.html`, "text/html");
      return;
    }
    if (f.files?.length) {
      const zip = new JSZip();
      for (const file of f.files) zip.file(file.path, file.content);
      downloadBlob(await zip.generateAsync({ type: "blob" }), `${f.name}.zip`);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-2 border-b border-border px-3 py-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchFiles} />
        <div className="flex gap-1 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setKind(f.id)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs ${
                kind === f.id ? "bg-fg text-bg" : "bg-surface text-muted"
              }`}
            >
              {f.key === "filterAll" ? t.filterAll : f.key === "image" ? t.images : f.key === "code" ? t.code : t.website}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {list.length === 0 ? (
          <EmptyState title={t.emptyFiles} body="Chat, code, website, ya images se jo bane, yahan dikhega." />
        ) : (
          <ul className="mx-auto max-w-2xl">
            {list.map((f) => (
              <li
                key={f.id}
                className="mb-1 flex items-center gap-3 rounded-[var(--radius-md)] px-2 py-2 hover:bg-surface"
              >
                {f.dataUrl ? (
                  <img src={f.dataUrl} alt="" className="nobi-img size-11 rounded-[var(--radius-xs)] object-cover" />
                ) : (
                  <span className="flex size-11 items-center justify-center rounded-[var(--radius-xs)] bg-surface-2 font-mono text-[10px] uppercase text-muted">
                    {f.kind}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{f.name}</p>
                  <p className="text-[11px] text-muted">
                    {formatSize(f.size)} · {formatWhen(f.createdAt)}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="iconSm" variant="ghost" aria-label="File options">
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onSelect={() => void copyItem(f)}>
                      <Copy className="size-3.5" /> {t.copy}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void shareItem(f)}>
                      <Share2 className="size-3.5" /> {t.share}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void downloadItem(f)}>
                      <Download className="size-3.5" /> {t.download}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        setRenameId(f.id);
                        setRenameVal(f.name);
                      }}
                    >
                      <Pencil className="size-3.5" /> {t.rename}
                    </DropdownMenuItem>
                    <DropdownMenuItem danger onSelect={() => setDelId(f.id)}>
                      <Trash2 className="size-3.5" /> {t.delete}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Dialog open={Boolean(renameId)} onOpenChange={(v) => !v && setRenameId(null)}>
        <DialogContent title={t.rename}>
          <Input className="mt-4" value={renameVal} onChange={(e) => setRenameVal(e.target.value)} />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRenameId(null)}>
              {t.cancel}
            </Button>
            <Button
              onClick={() => {
                if (renameId) renameFile(renameId, renameVal);
                setRenameId(null);
              }}
            >
              {t.rename}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={Boolean(delId)}
        onOpenChange={(v) => !v && setDelId(null)}
        title={t.delete}
        body={t.deleteConfirm}
        confirmLabel={t.delete}
        destructive
        onConfirm={() => {
          if (delId) deleteFile(delId);
          setDelId(null);
        }}
      />
    </div>
  );
}
