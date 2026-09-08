import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/nobi/AppShell";
import { Mark } from "@/components/nobi/shared";
import { useNobi } from "@/lib/store";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = useNobi.persist.onFinishHydration(() => setReady(true));
    if (useNobi.persist.hasHydrated()) setReady(true);
    return unsub;
  }, []);

  if (!ready) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-bg text-fg">
        <Mark className="size-12 text-sm" />
        <p className="font-display text-lg font-semibold tracking-tight">NOBI</p>
      </div>
    );
  }

  return <AppShell />;
}
