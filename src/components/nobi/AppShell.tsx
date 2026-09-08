import { Code2, Folder, ImageIcon, MessageSquare, Search, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/overlays";
import { STRINGS } from "@/lib/i18n";
import { useNobi } from "@/lib/store";
import type { Tab } from "@/lib/types";
import { ChatView } from "./ChatView";
import { CodeView } from "./CodeView";
import { FilesView } from "./FilesView";
import { ImagesView } from "./ImagesView";
import { Onboarding } from "./Onboarding";
import { ResearchView } from "./ResearchView";
import { SettingsSheet } from "./SettingsSheet";
import { OfflineBanner, Wordmark } from "./shared";

const NAV: { id: Tab; icon: typeof MessageSquare; label: keyof typeof STRINGS.hinglish }[] = [
  { id: "chat", icon: MessageSquare, label: "chat" },
  { id: "research", icon: Search, label: "research" },
  { id: "code", icon: Code2, label: "code" },
  { id: "images", icon: ImageIcon, label: "images" },
  { id: "files", icon: Folder, label: "files" },
];

export function AppShell() {
  const onboarded = useNobi((s) => s.onboarded);
  const language = useNobi((s) => s.language);
  const t = STRINGS[language];
  const [tab, setTab] = useState<Tab>("chat");
  const [settings, setSettings] = useState(false);
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return (
    <TooltipProvider>
      <div className="flex h-dvh bg-bg text-fg">
        <aside className="hidden w-[220px] shrink-0 flex-col border-r border-border md:flex">
          <div className="flex h-14 items-center px-4">
            <Wordmark />
          </div>
          <nav className="flex flex-1 flex-col gap-0.5 px-2 py-2">
            {NAV.map((item) => (
              <NavBtn
                key={item.id}
                active={tab === item.id}
                icon={item.icon}
                label={t[item.label]}
                onClick={() => setTab(item.id)}
              />
            ))}
          </nav>
          <div className="p-2">
            <NavBtn
              active={false}
              icon={Settings}
              label={t.settings}
              onClick={() => setSettings(true)}
            />
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3 md:hidden">
            <Wordmark compact />
            <Button size="iconSm" variant="ghost" onClick={() => setSettings(true)} aria-label={t.settings}>
              <Settings />
            </Button>
          </header>
          {!online && <OfflineBanner />}
          <main className="min-h-0 flex-1 pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
            {tab === "chat" && <ChatView />}
            {tab === "research" && <ResearchView />}
            {tab === "code" && <CodeView />}
            {tab === "images" && <ImagesView />}
            {tab === "files" && <FilesView />}
          </main>
          <nav className="fixed inset-x-0 bottom-0 z-30 flex h-14 items-center justify-around border-t border-border bg-bg pb-[env(safe-area-inset-bottom)] md:hidden">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`flex min-w-[44px] flex-col items-center gap-0.5 text-[10px] ${
                    active ? "text-fg" : "text-muted"
                  }`}
                >
                  <Icon className="size-5" />
                  {t[item.label]}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
      <SettingsSheet open={settings} onOpenChange={setSettings} />
      {!onboarded && <Onboarding />}
    </TooltipProvider>
  );
}

function NavBtn({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof MessageSquare;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-10 items-center gap-2.5 rounded-[var(--radius-sm)] px-3 text-sm ${
        active ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface hover:text-fg"
      }`}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}
