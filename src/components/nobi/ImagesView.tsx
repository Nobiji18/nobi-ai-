import { Camera, ImagePlus } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { fetchJson, isTimeout, withTimeout } from "@/lib/ai-client";
import { beginRequest, canSend, endRequest, SLOW_AFTER_MS } from "@/lib/guard";
import { STRINGS } from "@/lib/i18n";
import { useNobi } from "@/lib/store";
import type { ImageStyle } from "@/lib/types";
import { byteLength, compressImage, uid } from "@/lib/utils";
import { EmptyState, ErrorBanner, ImageActions, SlowHint } from "./shared";

const STYLES: { id: ImageStyle; label: string }[] = [
  { id: "realistic", label: "Realistic" },
  { id: "cartoon", label: "Cartoon" },
  { id: "anime", label: "Anime" },
  { id: "3d", label: "3D" },
];

export function ImagesView() {
  const t = STRINGS[useNobi((s) => s.language)];
  const addFile = useNobi((s) => s.addFile);
  const files = useNobi((s) => s.files.filter((f) => f.kind === "image"));
  const [tab, setTab] = useState<"generate" | "edit">("generate");
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<ImageStyle>("realistic");
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [source, setSource] = useState<string | null>(null);
  const [edited, setEdited] = useState<string | null>(null);
  const [split, setSplit] = useState(52);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  function saveImages(urls: string[], prefix: string) {
    urls.forEach((dataUrl, i) => {
      addFile({
        id: uid(),
        name: `${prefix}-${i + 1}.jpg`,
        kind: "image",
        size: byteLength(dataUrl),
        createdAt: Date.now(),
        mime: "image/jpeg",
        dataUrl,
      });
    });
  }

  async function run() {
    const check = canSend();
    if (!check.ok) {
      toast.error(check.error);
      return;
    }
    const trimmed = prompt.trim();
    if (!trimmed) return;
    if (tab === "edit" && !source) {
      toast.error("Pehle photo attach karo.");
      return;
    }
    setBusy(true);
    setSlow(false);
    setError(null);
    const slowTimer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    beginRequest();
    const wrap = withTimeout();
    try {
      const result = await fetchJson<{ images: string[] }>(
        "/api/image",
        tab === "edit"
          ? { mode: "edit", prompt: trimmed, image: source }
          : { mode: "generate", prompt: trimmed, style, n: 2 },
        wrap.signal,
      );
      if (tab === "edit") {
        const img = result.images[0];
        if (img) {
          setEdited(img);
          saveImages([img], "edit");
        }
      } else {
        setImages(result.images);
        saveImages(result.images, "nobi");
      }
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

  async function onFiles(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    try {
      const { dataUrl } = await compressImage(file, 1280, 0.78);
      setSource(dataUrl);
      setEdited(null);
      setTab("edit");
    } catch {
      toast.error("Image read nahi hui.");
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-1 border-b border-border px-3">
        <button
          type="button"
          onClick={() => setTab("generate")}
          className={`h-8 rounded-full px-3 text-xs font-medium ${tab === "generate" ? "bg-fg text-bg" : "text-muted"}`}
        >
          {t.generate}
        </button>
        <button
          type="button"
          onClick={() => setTab("edit")}
          className={`h-8 rounded-full px-3 text-xs font-medium ${tab === "edit" ? "bg-fg text-bg" : "text-muted"}`}
        >
          {t.editImage}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {tab === "generate" && (
          <>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStyle(s.id)}
                  className={`rounded-full px-3 py-1 text-xs ${
                    style === s.id ? "bg-fg text-bg" : "bg-surface text-muted"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {images.length === 0 && !busy && !error && (
              <EmptyState title={t.emptyImages} body="Do variations milengi har prompt pe." />
            )}
            {busy && <p className="shimmer text-sm">{t.thinking}</p>}
            {slow && busy && <SlowHint />}
            {error && <ErrorBanner message={error} onRetry={() => void run()} />}
            {images.length > 0 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {images.map((src, i) => (
                  <figure key={i} className="overflow-hidden rounded-[var(--radius-lg)] bg-surface">
                    <img src={src} alt="" className="nobi-img aspect-square w-full object-cover" />
                    <figcaption className="flex items-center justify-between px-2 py-1.5">
                      <span className="text-[11px] text-muted">#{i + 1}</span>
                      <ImageActions dataUrl={src} name={`nobi-${i + 1}`} />
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </>
        )}
        {tab === "edit" && (
          <>
            {!source && !busy && (
              <EmptyState title={t.editImage} body="Gallery ya camera se photo lo, phir prompt likho.">
                <div className="mt-5 flex gap-2">
                  <Button variant="secondary" onClick={() => galleryRef.current?.click()}>
                    <ImagePlus className="size-4" /> Gallery
                  </Button>
                  <Button variant="secondary" onClick={() => cameraRef.current?.click()}>
                    <Camera className="size-4" /> {t.camera}
                  </Button>
                </div>
              </EmptyState>
            )}
            {source && (
              <div className="mx-auto max-w-lg">
                {edited ? (
                  <div className="relative overflow-hidden rounded-[var(--radius-lg)]">
                    <img src={edited} alt={t.after} className="nobi-img aspect-square w-full object-cover" />
                    <div
                      className="absolute inset-0 overflow-hidden"
                      style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
                    >
                      <img src={source} alt={t.before} className="h-full w-full object-cover" />
                    </div>
                    <div className="absolute inset-x-0 bottom-3 px-4">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={split}
                        onChange={(e) => setSplit(Number(e.target.value))}
                        className="w-full"
                        aria-label="Before after"
                      />
                      <div className="mt-1 flex justify-between text-[11px] text-fg">
                        <span>{t.before}</span>
                        <span>{t.after}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <img src={source} alt="" className="nobi-img w-full rounded-[var(--radius-lg)]" />
                )}
                {edited && (
                  <div className="mt-2 flex justify-end">
                    <ImageActions dataUrl={edited} name="nobi-edit" />
                  </div>
                )}
              </div>
            )}
            {busy && <p className="shimmer mt-3 text-sm">{t.thinking}</p>}
            {error && (
              <div className="mt-3">
                <ErrorBanner message={error} onRetry={() => void run()} />
              </div>
            )}
          </>
        )}
        {files.length > 0 && tab === "generate" && images.length === 0 && (
          <div className="mt-6">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{t.gallery}</p>
            <div className="grid grid-cols-3 gap-2">
              {files.slice(0, 9).map((f) =>
                f.dataUrl ? (
                  <img
                    key={f.id}
                    src={f.dataUrl}
                    alt={f.name}
                    className="nobi-img aspect-square w-full rounded-[var(--radius-sm)] object-cover"
                  />
                ) : null,
              )}
            </div>
          </div>
        )}
      </div>
      <form
        className="shrink-0 border-t border-border px-3 py-3 sm:px-6"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <div className="mx-auto max-w-2xl rounded-[20px] bg-surface p-2 composer-shadow">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={tab === "edit" ? "Background hatao, style transfer…" : "Ek shaant coastal town, dusk…"}
            rows={2}
          />
          <div className="flex items-center justify-between px-1 pb-1">
            {tab === "edit" ? (
              <div className="flex gap-0.5">
                <Button type="button" size="iconSm" variant="ghost" onClick={() => galleryRef.current?.click()}>
                  <ImagePlus />
                </Button>
                <Button type="button" size="iconSm" variant="ghost" onClick={() => cameraRef.current?.click()}>
                  <Camera />
                </Button>
              </div>
            ) : (
              <span />
            )}
            <Button type="submit" size="sm" disabled={busy || !prompt.trim()}>
              {t.generate}
            </Button>
          </div>
        </div>
        <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onFiles(e.target.files)} />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => void onFiles(e.target.files)}
        />
      </form>
    </div>
  );
}
