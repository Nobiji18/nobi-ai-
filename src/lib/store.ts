import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ChatMessage,
  Conversation,
  Lang,
  ResearchItem,
  SavedFile,
  Theme,
} from "./types";
import { truncate, uid } from "./utils";

type NobiState = {
  theme: Theme;
  language: Lang;
  onboarded: boolean;
  conversations: Conversation[];
  currentId: string | null;
  files: SavedFile[];
  researchLog: ResearchItem[];
  setTheme: (theme: Theme) => void;
  setLanguage: (language: Lang) => void;
  setOnboarded: () => void;
  newChat: () => string;
  setCurrent: (id: string) => void;
  renameChat: (id: string, title: string) => void;
  deleteChat: (id: string) => void;
  clearChat: (id: string) => void;
  clearAllChats: () => void;
  addMessage: (chatId: string, message: ChatMessage) => void;
  patchMessage: (chatId: string, messageId: string, patch: Partial<ChatMessage>) => void;
  deleteMessage: (chatId: string, messageId: string) => void;
  replaceFrom: (chatId: string, messageId: string, next: ChatMessage[]) => void;
  addFile: (file: SavedFile) => void;
  renameFile: (id: string, name: string) => void;
  deleteFile: (id: string) => void;
  clearFiles: () => void;
  addResearch: (item: ResearchItem) => void;
  clearResearch: () => void;
};

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("light", theme === "light");
  root.classList.toggle("dark", theme !== "light");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#f4f4f2" : "#0b0c0e");
}

function touchTitle(conv: Conversation): Conversation {
  if (conv.title !== "New chat") return conv;
  const first = conv.messages.find((m) => m.role === "user" && m.content.trim());
  if (!first) return conv;
  return { ...conv, title: truncate(first.content, 42) };
}

export const useNobi = create<NobiState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      language: "hinglish",
      onboarded: false,
      conversations: [],
      currentId: null,
      files: [],
      researchLog: [],
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
      setLanguage: (language) => set({ language }),
      setOnboarded: () => set({ onboarded: true }),
      newChat: () => {
        const id = uid();
        const now = Date.now();
        const conv: Conversation = {
          id,
          title: "New chat",
          preview: "",
          createdAt: now,
          updatedAt: now,
          messages: [],
        };
        set({ conversations: [conv, ...get().conversations], currentId: id });
        return id;
      },
      setCurrent: (id) => set({ currentId: id }),
      renameChat: (id, title) =>
        set({
          conversations: get().conversations.map((c) =>
            c.id === id ? { ...c, title: title.trim() || c.title } : c,
          ),
        }),
      deleteChat: (id) => {
        const rest = get().conversations.filter((c) => c.id !== id);
        const currentId = get().currentId === id ? (rest[0]?.id ?? null) : get().currentId;
        set({ conversations: rest, currentId });
      },
      clearChat: (id) =>
        set({
          conversations: get().conversations.map((c) =>
            c.id === id
              ? { ...c, messages: [], preview: "", updatedAt: Date.now() }
              : c,
          ),
        }),
      clearAllChats: () => set({ conversations: [], currentId: null, researchLog: [] }),
      addMessage: (chatId, message) =>
        set({
          conversations: get().conversations.map((c) => {
            if (c.id !== chatId) return c;
            const messages = [...c.messages, message];
            const preview = truncate(
              message.role === "user" ? message.content : (c.preview || message.content),
              80,
            );
            return touchTitle({
              ...c,
              messages,
              preview,
              updatedAt: Date.now(),
            });
          }),
        }),
      patchMessage: (chatId, messageId, patch) =>
        set({
          conversations: get().conversations.map((c) => {
            if (c.id !== chatId) return c;
            const messages = c.messages.map((m) =>
              m.id === messageId ? { ...m, ...patch } : m,
            );
            const last = [...messages].reverse().find((m) => m.content);
            return {
              ...c,
              messages,
              preview: last ? truncate(last.content, 80) : c.preview,
              updatedAt: Date.now(),
            };
          }),
        }),
      deleteMessage: (chatId, messageId) =>
        set({
          conversations: get().conversations.map((c) =>
            c.id === chatId
              ? { ...c, messages: c.messages.filter((m) => m.id !== messageId) }
              : c,
          ),
        }),
      replaceFrom: (chatId, messageId, next) =>
        set({
          conversations: get().conversations.map((c) => {
            if (c.id !== chatId) return c;
            const idx = c.messages.findIndex((m) => m.id === messageId);
            const keep = idx >= 0 ? c.messages.slice(0, idx) : c.messages;
            return { ...c, messages: [...keep, ...next], updatedAt: Date.now() };
          }),
        }),
      addFile: (file) => set({ files: [file, ...get().files] }),
      renameFile: (id, name) =>
        set({
          files: get().files.map((f) =>
            f.id === id ? { ...f, name: name.trim() || f.name } : f,
          ),
        }),
      deleteFile: (id) => set({ files: get().files.filter((f) => f.id !== id) }),
      clearFiles: () => set({ files: [] }),
      addResearch: (item) => set({ researchLog: [item, ...get().researchLog].slice(0, 40) }),
      clearResearch: () => set({ researchLog: [] }),
    }),
    {
      name: "nobi-store-v1",
      partialize: (s) => ({
        theme: s.theme,
        language: s.language,
        onboarded: s.onboarded,
        conversations: s.conversations.slice(0, 80).map((c) => ({
          ...c,
          messages: c.messages.map((m) => ({
            ...m,
            pending: false,
            image: m.image && m.image.length > 220_000 ? undefined : m.image,
          })),
        })),
        currentId: s.currentId,
        files: s.files.slice(0, 60).map((f) =>
          f.dataUrl && f.dataUrl.length > 900_000 ? { ...f, dataUrl: undefined } : f,
        ),
        researchLog: s.researchLog.slice(0, 20),
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.theme) applyTheme(state.theme);
        if (state && (state.language as string) === "es") {
          state.language = "hinglish";
        }
      },
    },
  ),
);

export function currentConversation() {
  const { conversations, currentId } = useNobi.getState();
  return conversations.find((c) => c.id === currentId) ?? null;
}
