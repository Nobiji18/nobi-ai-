import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/chrome";
import { ConfirmDialog, Dialog, DialogContent } from "@/components/ui/overlays";
import { Separator } from "@/components/ui/chrome";
import { LANG_LABEL, LANGS, STRINGS } from "@/lib/i18n";
import { useNobi } from "@/lib/store";
import type { Lang } from "@/lib/types";

export function SettingsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const language = useNobi((s) => s.language);
  const setLanguage = useNobi((s) => s.setLanguage);
  const theme = useNobi((s) => s.theme);
  const setTheme = useNobi((s) => s.setTheme);
  const t = STRINGS[language];
  const clearAllChats = useNobi((s) => s.clearAllChats);
  const clearFiles = useNobi((s) => s.clearFiles);
  const clearResearch = useNobi((s) => s.clearResearch);
  const [ai, setAi] = useState<boolean | null>(null);
  const [clearH, setClearH] = useState(false);
  const [clearC, setClearC] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch("/api/status")
      .then((r) => r.json())
      .then((j: { ai?: boolean }) => setAi(Boolean(j.ai)))
      .catch(() => setAi(false));
  }, [open]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent title={t.settings} className="max-h-[min(90dvh,640px)] overflow-y-auto">
          <div className="mt-5 space-y-5">
            <section>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">{t.replyLanguage}</p>
              <p className="mt-1 text-xs leading-relaxed text-subtle">{t.replyHint}</p>
              <div className="mt-3 grid grid-cols-3 gap-1 rounded-[var(--radius-md)] bg-surface p-1">
                {LANGS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLanguage(l)}
                    className={`h-9 rounded-[var(--radius-sm)] text-xs font-medium ${
                      language === l ? "bg-elevated text-fg shadow-[var(--shadow-border)]" : "text-muted"
                    }`}
                  >
                    {LANG_LABEL[l as Lang]}
                  </button>
                ))}
              </div>
            </section>
            <Separator />
            <section className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{theme === "dark" ? t.darkMode : t.lightMode}</p>
                <p className="text-xs text-muted">Theme</p>
              </div>
              <Switch
                checked={theme === "dark"}
                onCheckedChange={(v) => setTheme(v ? "dark" : "light")}
              />
            </section>
            <Separator />
            <section>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">AI</p>
              <p className="mt-2 text-sm">{ai === null ? "…" : ai ? t.aiReady : t.aiDown}</p>
              <p className="mt-1 text-xs leading-relaxed text-subtle">
                Key is managed by the app owner — yahan paste karne ki zaroorat nahi.
              </p>
            </section>
            <Separator />
            <section className="space-y-2">
              <Button variant="secondary" className="w-full" onClick={() => setClearH(true)}>
                {t.clearAll}
              </Button>
              <Button variant="secondary" className="w-full" onClick={() => setClearC(true)}>
                {t.clearCache}
              </Button>
            </section>
            <Separator />
            <section>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">{t.about}</p>
              <p className="mt-2 font-display text-sm font-semibold">NOBI AI</p>
              <p className="text-xs text-muted">
                {t.version} 1.0.0 · All-in-one assistant
              </p>
            </section>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={clearH}
        onOpenChange={setClearH}
        title={t.clearAll}
        body={t.clearAllConfirm}
        confirmLabel={t.clearAll}
        destructive
        onConfirm={() => {
          clearAllChats();
          clearResearch();
        }}
      />
      <ConfirmDialog
        open={clearC}
        onOpenChange={setClearC}
        title={t.clearCache}
        body={t.cacheConfirm}
        confirmLabel={t.clearCache}
        destructive
        onConfirm={() => {
          clearFiles();
        }}
      />
    </>
  );
}
