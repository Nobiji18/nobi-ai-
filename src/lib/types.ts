export type Theme = "dark" | "light";
export type Lang = "hinglish" | "hi" | "en";
export type Tab = "chat" | "research" | "code" | "images" | "files";
export type FileKind = "code" | "image" | "website";
export type ImageStyle = "realistic" | "cartoon" | "anime" | "3d";
export type Role = "user" | "assistant" | "system";

export type Source = {
  title: string;
  url: string;
};

export type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  image?: string;
  sources?: Source[];
  createdAt: number;
  error?: boolean;
  pending?: boolean;
};

export type Conversation = {
  id: string;
  title: string;
  preview: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
};

export type CodeFile = {
  path: string;
  language: string;
  content: string;
};

export type SavedFile = {
  id: string;
  name: string;
  kind: FileKind;
  size: number;
  createdAt: number;
  mime: string;
  dataUrl?: string;
  html?: string;
  files?: CodeFile[];
  explanation?: string;
};

export type ResearchItem = {
  id: string;
  query: string;
  answer: string;
  sources: Source[];
  createdAt: number;
  error?: boolean;
};
