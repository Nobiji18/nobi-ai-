import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid() {
  return crypto.randomUUID();
}

export function formatSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatWhen(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function byteLength(s: string) {
  return new TextEncoder().encode(s).length;
}

export function truncate(s: string, n: number) {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1)}…`;
}

export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function downloadText(text: string, name: string, mime = "text/plain") {
  downloadBlob(new Blob([text], { type: mime }), name);
}

export async function compressImage(
  file: Blob,
  maxW = 1280,
  quality = 0.72,
): Promise<{ dataUrl: string; width: number; height: number; size: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, maxW / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not read this image");
    ctx.fillStyle = "#0b0c0e";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    return { dataUrl, width, height, size: byteLength(dataUrl) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}

export async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

export async function copyImage(dataUrl: string) {
  const blob = await (await fetch(dataUrl)).blob();
  const type = blob.type || "image/png";
  if (typeof ClipboardItem === "undefined") {
    throw new Error("Copy image is not supported here");
  }
  await navigator.clipboard.write([new ClipboardItem({ [type]: blob })]);
}

export async function shareOrCopy(opts: {
  title: string;
  text?: string;
  url?: string;
  files?: File[];
}) {
  try {
    if (navigator.share) {
      await navigator.share({
        title: opts.title,
        text: opts.text,
        url: opts.url,
        files: opts.files,
      });
      return "shared" as const;
    }
  } catch (err) {
    const name = (err as { name?: string } | null)?.name;
    if (name === "AbortError") return "aborted" as const;
  }
  if (opts.text) {
    await copyText(opts.text);
    return "copied" as const;
  }
  return "skipped" as const;
}

export function dataUrlToFile(dataUrl: string, name: string) {
  const [head, body] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(head ?? "")?.[1] ?? "image/jpeg";
  const bin = atob(body ?? "");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}
