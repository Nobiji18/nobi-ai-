import {
  Camera,
  Copy,
  History,
  ImagePlus,
  Mic,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Share2,
  Square,
  Trash2,
  Volume2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Textarea } from "@/components/ui/field";
import {
  ConfirmDialog,
  Dialog,
  DialogContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/overlays";
import { Switch } from "@/components/ui/chrome";
import { isTimeout, streamChat, withTimeout } from "@/lib/ai-client";
import { beginRequest, canSend, endRequest, SLOW_AFTER_MS } from "@/lib/guard";
import { STRINGS } from "@/lib/i18n";
import { useNobi } from "@/lib/store";
import type { ChatMessage } from "@/lib/types";
import {
  compressImage,
  copyText,
  formatWhen,
  shareOrCopy,
  truncate,
  uid,
} from "@/lib/utils";
import { Markdown } from "./Markdown";
import { EmptyState, ErrorBanner, SlowHint } from "./shared";

export function ChatView() {
  const language = useNobi((s) => s.language);
  const t = STRINGS[language];
  const conversations = useNobi((s) => s.conversations);
  const currentId = useNobi((s) => s.currentId);
  const chat = conversations.find((c) => c.id === currentId) ?? null;
  const [q, setQ] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [research, setResearch] = useState(false);

  return (
    <div className="flex h-full min-h-0">
      <aside className="hidden w-[280px] shrink-0 flex-col border-r border-border lg:flex">
        <HistoryList
          filter={q}
          onFilter={setQ}
          tSearch={t.searchHistory}
          tNew={t.newChat}
        />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
          <div className="flex min-w-0 items-center gap-1">
            <Button
              size="iconSm"
              variant="ghost"
              className="lg:hidden"
              onClick={() => setHistoryOpen(true)}
              aria-label={t.history}
            >
              <History />
            </Button>
            <p className="truncate text-sm font-medium">
              {chat?.title ?? t.newChat}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <label className="mr-1 hidden items-center gap-2 text-xs text-muted sm:flex">
              {t.researchMode}
              <Switch checked={research} onCheckedChange={setResearch} />
            </label>
            <ChatMenu chatId={chat?.id ?? null} />
          </div>
        </div>
        <Thread research={research} />
      </div>
      {historyOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-bg/70"
            onClick={() => setHistoryOpen(false)}
            aria-label="Close history"
          />
          <div className="absolute inset-y-0 left-0 flex w-[min(100%,320px)] flex-col bg-elevated shadow-[var(--shadow-soft)]">
            <HistoryList
              filter={q}
              onFilter={setQ}
              tSearch={t.searchHistory}
              tNew={t.newChat}
              onPick={() => setHistoryOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryList({
  filter,
  onFilter,
  tSearch,
  tNew,
  onPick,
}: {
  filter: string;
  onFilter: (v: string) => void;
  tSearch: string;
  tNew: string;
  onPick?: () => void;
}) {
  const conversations = useNobi((s) => s.conversations);
  const currentId = useNobi((s) => s.currentId);
  const setCurrent = useNobi((s) => s.setCurrent);
  const newChat = useNobi((s) => s.newChat);
  const renameChat = useNobi((s) => s.renameChat);
  const deleteChat = useNobi((s) => s.deleteChat);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [delId, setDelId] = useState<string | null>(null);
  const t = STRINGS[useNobi((s) => s.language)];

  const list = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.preview.toLowerCase().includes(q) ||
        c.messages.some((m) => m.content.toLowerCase().includes(q)),
    );
  }, [conversations, filter]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 p-3">
        <Button
          size="sm"
          className="shrink-0"
          onClick={() => {
            newChat();
            onPick?.();
          }}
        >
          <Plus className="size-3.5" />
          {tNew}
        </Button>
      </div>
      <div className="px-3 pb-2">
        <Input
          value={filter}
          onChange={(e) => onFilter(e.target.value)}
          placeholder={tSearch}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {list.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted">{t.noResults}</p>
        )}
        {list.map((c) => (
          <div
            key={c.id}
            className={`group mb-0.5 flex items-start gap-1 rounded-[var(--radius-sm)] px-2 py-2 ${
              c.id === currentId ? "bg-surface-2" : "hover:bg-surface"
            }`}
          >
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => {
                setCurrent(c.id);
                onPick?.();
              }}
            >
              <p className="truncate text-sm font-medium">{c.title}</p>
              <p className="truncate text-[11px] text-muted">
                {formatWhen(c.updatedAt)} · {c.preview || "Empty"}
              </p>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="iconSm"
                  variant="ghost"
                  className="opacity-70 group-hover:opacity-100"
                  aria-label="Chat options"
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onSelect={() => {
                    setRenameId(c.id);
                    setRenameVal(c.title);
                  }}
                >
                  <Pencil className="size-3.5" /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem danger onSelect={() => setDelId(c.id)}>
                  <Trash2 className="size-3.5" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>
      <Dialog open={Boolean(renameId)} onOpenChange={(v) => !v && setRenameId(null)}>
        <DialogContent title="Rename chat">
          <Input
            className="mt-4"
            value={renameVal}
            onChange={(e) => setRenameVal(e.target.value)}
            autoFocus
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRenameId(null)}>
              {t.cancel}
            </Button>
            <Button
              onClick={() => {
                if (renameId) renameChat(renameId, renameVal);
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
        title="Delete chat"
        body={t.deleteConfirm}
        confirmLabel={t.delete}
        destructive
        onConfirm={() => {
          if (delId) deleteChat(delId);
          setDelId(null);
        }}
      />
    </div>
  );
}

function ChatMenu({ chatId }: { chatId: string | null }) {
  const t = STRINGS[useNobi((s) => s.language)];
  const newChat = useNobi((s) => s.newChat);
  const clearChat = useNobi((s) => s.clearChat);
  const conversations = useNobi((s) => s.conversations);
  const [clearOpen, setClearOpen] = useState(false);
  const chat = conversations.find((c) => c.id === chatId);

  async function share() {
    if (!chat) return;
    const text = chat.messages
      .filter((m) => m.content)
      .map((m) => `${m.role === "user" ? "You" : "NOBI"}: ${m.content}`)
      .join("\n\n");
    const result = await shareOrCopy({ title: chat.title, text });
    if (result === "copied") toast.success(t.copied);
  }

  return (
    <>
      <Button size="iconSm" variant="ghost" onClick={() => newChat()} aria-label={t.newChat}>
        <Plus />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="iconSm" variant="ghost" aria-label="More">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={share}>
            <Share2 className="size-3.5" /> {t.share}
          </DropdownMenuItem>
          <DropdownMenuItem danger onSelect={() => setClearOpen(true)}>
            <Trash2 className="size-3.5" /> {t.clearChat}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title={t.clearChat}
        body={t.clearConfirm}
        confirmLabel={t.clearChat}
        destructive
        onConfirm={() => {
          if (chatId) clearChat(chatId);
        }}
      />
    </>
  );
}

function Thread({ research }: { research: boolean }) {
  const t = STRINGS[useNobi((s) => s.language)];
  const conversations = useNobi((s) => s.conversations);
  const currentId = useNobi((s) => s.currentId);
  const newChat = useNobi((s) => s.newChat);
  const addMessage = useNobi((s) => s.addMessage);
  const patchMessage = useNobi((s) => s.patchMessage);
  const deleteMessage = useNobi((s) => s.deleteMessage);
  const replaceFrom = useNobi((s) => s.replaceFrom);
  const chat = conversations.find((c) => c.id === currentId) ?? null;
  const messages = chat?.messages ?? [];
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const recRef = useRef<SpeechRecognition | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages.length, messages[messages.length - 1]?.content]);

  useEffect(() => {
    return () => {
      recRef.current?.stop();
      speechSynthesis.cancel();
    };
  }, []);

  async function send(content: string, img?: string | null, chatOverride?: string) {
    const check = canSend();
    if (!check.ok) {
      toast.error(check.error);
      return;
    }
    const trimmed = content.trim();
    if (!trimmed && !img) return;
    let id = chatOverride ?? currentId;
    if (!id) id = newChat();
    const userMsg: ChatMessage = {
      id: uid(),
      role: "user",
      content: trimmed,
      image: img ?? undefined,
      createdAt: Date.now(),
    };
    const assistantId = uid();
    const assistant: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt: Date.now(),
      pending: true,
    };
    addMessage(id, userMsg);
    addMessage(id, assistant);
    setText("");
    setImage(null);
    setBusy(true);
    setSlow(false);
    const slowTimer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    beginRequest();
    const wrap = withTimeout();
    abortRef.current = new AbortController();
    const linked = new AbortController();
    wrap.signal.addEventListener("abort", () => linked.abort());
    abortRef.current.signal.addEventListener("abort", () => linked.abort());
    try {
      const hist = useNobi
        .getState()
        .conversations.find((c) => c.id === id)
        ?.messages.filter((m) => m.id !== assistantId)
        .map((m) => ({
          role: m.role,
          content: m.content,
          image: m.image,
        })) ?? [];
      const result = await streamChat({
        messages: hist,
        research,
        language: useNobi.getState().language,
        signal: linked.signal,
        onDelta: (full) => patchMessage(id!, assistantId, { content: full }),
      });
      patchMessage(id, assistantId, {
        content: result.text,
        sources: result.sources,
        pending: false,
      });
    } catch (err) {
      const msg = isTimeout(err)
        ? "That took too long. Please retry."
        : err instanceof Error
          ? err.message
          : "Something went wrong. Please retry.";
      patchMessage(id, assistantId, { content: msg, error: true, pending: false });
    } finally {
      wrap.dispose();
      window.clearTimeout(slowTimer);
      setSlow(false);
      setBusy(false);
      endRequest();
    }
  }

  async function onFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    try {
      const { dataUrl } = await compressImage(file);
      setImage(dataUrl);
    } catch {
      toast.error("Could not read that image.");
    }
  }

  function startVoice() {
    const SR =
      window.SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition })
        .webkitSpeechRecognition;
    if (!SR) {
      toast.error("Voice input is not supported in this browser.");
      return;
    }
    const rec = new SR();
    rec.lang =
      useNobi.getState().language === "hi"
        ? "hi-IN"
        : useNobi.getState().language === "en"
          ? "en-US"
          : "en-IN";
    rec.interimResults = true;
    rec.onresult = (ev: SpeechRecognitionEvent) => {
      let said = "";
      for (let i = 0; i < ev.results.length; i++) {
        said += ev.results[i]?.[0]?.transcript ?? "";
      }
      setText(said);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  function speak(m: ChatMessage) {
    if (speakingId === m.id) {
      speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(m.content);
    u.onend = () => setSpeakingId(null);
    setSpeakingId(m.id);
    speechSynthesis.speak(u);
  }

  function onEdit(m: ChatMessage) {
    setText(m.content);
    if (m.image) setImage(m.image);
  }

  function onResend(m: ChatMessage) {
    if (!chat) return;
    const nextUser: ChatMessage = { ...m, id: uid(), createdAt: Date.now() };
    replaceFrom(chat.id, m.id, [nextUser]);
    void send(m.content, m.image, chat.id);
  }

  const lastError = [...messages].reverse().find((m) => m.error);

  return (
    <>
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6">
        {messages.length === 0 ? (
          <EmptyState title={t.emptyChat} body="Chat, attach a photo, or turn on research for live sources.">
            <div className="mt-6 grid w-full gap-2">
              {[
                "Explain this like I'm new to it",
                "Solve what's in a photo I attach",
                "Draft a concise email",
              ].map((s) => (
                <button
                  key={s}
                  type="button"
                  className="rounded-[var(--radius-md)] bg-surface px-4 py-3 text-left text-sm shadow-[var(--shadow-border)] hover:bg-surface-2"
                  onClick={() => setText(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </EmptyState>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-5">
            {messages.map((m) => (
              <Message
                key={m.id}
                m={m}
                speaking={speakingId === m.id}
                onCopy={async () => {
                  await copyText(m.content);
                  toast.success(t.copied);
                }}
                onEdit={() => onEdit(m)}
                onDelete={() => chat && deleteMessage(chat.id, m.id)}
                onResend={() => onResend(m)}
                onSpeak={() => speak(m)}
              />
            ))}
            {busy && slow && <SlowHint />}
            {lastError && !busy && (
              <ErrorBanner
                message={lastError.content}
                onRetry={() => {
                  const lastUser = [...messages].reverse().find((m) => m.role === "user");
                  if (lastUser) onResend(lastUser);
                }}
              />
            )}
          </div>
        )}
      </div>
      <form
        className="shrink-0 border-t border-border px-3 py-3 sm:px-6"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text, image);
        }}
      >
        <div className="mx-auto max-w-2xl rounded-[20px] bg-surface p-2 composer-shadow">
          {image && (
            <div className="mb-2 flex items-start gap-2 px-2 pt-1">
              <img
                src={image}
                alt="Attachment"
                className="nobi-img h-16 w-16 rounded-[var(--radius-sm)] object-cover"
              />
              <Button size="iconSm" variant="ghost" onClick={() => setImage(null)} type="button">
                <Trash2 />
              </Button>
            </div>
          )}
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={research ? "Ask with live sources…" : "Message NOBI"}
            rows={1}
            className="max-h-40 min-h-[44px]"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(text, image);
              }
            }}
          />
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-0.5">
              <Button
                type="button"
                size="iconSm"
                variant="ghost"
                onClick={() => galleryRef.current?.click()}
                aria-label={t.attach}
              >
                <ImagePlus />
              </Button>
              <Button
                type="button"
                size="iconSm"
                variant="ghost"
                onClick={() => cameraRef.current?.click()}
                aria-label={t.camera}
              >
                <Camera />
              </Button>
              <Button
                type="button"
                size="iconSm"
                variant={listening ? "secondary" : "ghost"}
                onClick={() => (listening ? recRef.current?.stop() : startVoice())}
                aria-label={t.voice}
              >
                {listening ? <Square /> : <Mic />}
              </Button>
              <input
                ref={galleryRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void onFiles(e.target.files)}
              />
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => void onFiles(e.target.files)}
              />
            </div>
            <Button
              type="submit"
              size="iconSm"
              disabled={busy || (!text.trim() && !image)}
              aria-label={t.send}
            >
              <Send />
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}

function Message({
  m,
  speaking,
  onCopy,
  onEdit,
  onDelete,
  onResend,
  onSpeak,
}: {
  m: ChatMessage;
  speaking: boolean;
  onCopy: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onResend: () => void;
  onSpeak: () => void;
}) {
  const mine = m.role === "user";
  const press = useRef<number | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`flex ${mine ? "justify-end" : "justify-start"}`}
      onContextMenu={(e) => {
        e.preventDefault();
        setOpen(true);
      }}
      onPointerDown={() => {
        press.current = window.setTimeout(() => setOpen(true), 480);
      }}
      onPointerUp={() => {
        if (press.current) window.clearTimeout(press.current);
      }}
      onPointerLeave={() => {
        if (press.current) window.clearTimeout(press.current);
      }}
    >
      <div className={`max-w-[min(100%,560px)] ${mine ? "" : "w-full"}`}>
        <div
          className={
            mine
              ? "rounded-[18px] rounded-br-[6px] bg-surface-2 px-3.5 py-2.5 text-sm leading-relaxed"
              : "text-sm"
          }
        >
          {m.image && (
            <img
              src={m.image}
              alt=""
              className="nobi-img mb-2 max-h-56 rounded-[var(--radius-md)]"
            />
          )}
          {m.pending && !m.content ? (
            <span className="shimmer text-sm">{STRINGS[useNobi.getState().language].thinking}</span>
          ) : mine ? (
            <p className="whitespace-pre-wrap">{m.content}</p>
          ) : (
            <Markdown text={m.content} />
          )}
        </div>
        {m.sources && m.sources.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {m.sources.map((s) => (
              <a
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-surface px-2.5 py-1 text-[11px] text-muted shadow-[var(--shadow-border)] hover:text-fg"
              >
                {truncate(s.title, 32)}
              </a>
            ))}
          </div>
        )}
        {!mine && m.content && !m.pending && (
          <div className="mt-1 flex items-center gap-0.5">
            <Button size="iconSm" variant="ghost" onClick={onCopy} aria-label="Copy">
              <Copy />
            </Button>
            <Button size="iconSm" variant="ghost" onClick={onSpeak} aria-label="Speak">
              <Volume2 className={speaking ? "text-fg" : ""} />
            </Button>
            <DropdownMenu open={open} onOpenChange={setOpen}>
              <DropdownMenuTrigger asChild>
                <Button size="iconSm" variant="ghost" aria-label="Message options">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={onCopy}>
                  <Copy className="size-3.5" /> Copy
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onResend}>
                  <RotateCcw className="size-3.5" /> Resend
                </DropdownMenuItem>
                <DropdownMenuItem danger onSelect={onDelete}>
                  <Trash2 className="size-3.5" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
        {mine && (
          <div className="mt-1 flex justify-end">
            <DropdownMenu open={open} onOpenChange={setOpen}>
              <DropdownMenuTrigger asChild>
                <Button size="iconSm" variant="ghost" aria-label="Message options">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={onCopy}>
                  <Copy className="size-3.5" /> Copy
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onEdit}>
                  <Pencil className="size-3.5" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onResend}>
                  <RotateCcw className="size-3.5" /> Resend
                </DropdownMenuItem>
                <DropdownMenuItem danger onSelect={onDelete}>
                  <Trash2 className="size-3.5" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </div>
  );
}

declare global {
  interface Window {
    SpeechRecognition?: typeof SpeechRecognition;
    webkitSpeechRecognition?: typeof SpeechRecognition;
  }
}
