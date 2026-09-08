import { MessageSquare, Search, Sparkles, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNobi } from "@/lib/store";
import { STRINGS } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
import { Wordmark } from "./shared";
import { useState } from "react";

const SLIDES: Record<Lang, { title: string; body: string }[]> = {
  hinglish: [
    {
      title: "Sochne ki jagah",
      body: "Chat karo, photo attach karo, ya bol ke poochho. NOBI context yaad rakhta hai.",
    },
    {
      title: "Live answers, sources ke saath",
      body: "Research mode web se naya data laata hai — links ke saath, andha vishwas nahi.",
    },
    {
      title: "Code, sites, aur images",
      body: "Project ya picture describe karo. Preview, edit, export — sab yahin.",
    },
    {
      title: "Sab ek library mein",
      body: "Generated files My Files mein milengi. Rename, share, ya cache saaf karo.",
    },
  ],
  hi: [
    {
      title: "सोचने की जगह",
      body: "चैट करें, फ़ोटो जोड़ें, या बोलकर पूछें। NOBI बात याद रखता है।",
    },
    {
      title: "लाइव जवाब, स्रोतों के साथ",
      body: "शोध मोड वेब से ताज़ा जानकारी लाता है — लिंक के साथ।",
    },
    {
      title: "कोड, साइटें और छवियाँ",
      body: "प्रोजेक्ट या तस्वीर बताएँ। पूर्वावलोकन, संपादन, निर्यात यहीं।",
    },
    {
      title: "सब एक जगह",
      body: "बनी फ़ाइलें My Files में रहेंगी। नाम बदलें, शेयर करें, कैश साफ़ करें।",
    },
  ],
  en: [
    {
      title: "A quiet place to think",
      body: "Chat with memory, attach a photo, or talk out loud. NOBI keeps the thread.",
    },
    {
      title: "Answers that cite the web",
      body: "Research mode pulls live sources so you can check the work, not just read it.",
    },
    {
      title: "Code, sites, and images",
      body: "Describe a project or a picture. Preview it, edit it, export it.",
    },
    {
      title: "Everything in one library",
      body: "Generated files live in My Files — rename, share, or clear the cache anytime.",
    },
  ],
};

const ICONS = [MessageSquare, Search, Sparkles, Folder];

export function Onboarding() {
  const language = useNobi((s) => s.language);
  const setOnboarded = useNobi((s) => s.setOnboarded);
  const t = STRINGS[language];
  const [i, setI] = useState(0);
  const slides = SLIDES[language] ?? SLIDES.hinglish;
  const slide = slides[i]!;
  const Icon = ICONS[i]!;
  const last = i === slides.length - 1;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-bg px-6 py-8 text-fg">
      <div className="flex items-center justify-between">
        <Wordmark />
        <button
          type="button"
          className="text-sm text-muted hover:text-fg"
          onClick={setOnboarded}
        >
          {t.onboardingSkip}
        </button>
      </div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center text-center">
        <div className="flex size-14 items-center justify-center rounded-[var(--radius-lg)] bg-surface shadow-[var(--shadow-border)]">
          <Icon className="size-6 text-fg" />
        </div>
        <h1 className="mt-8 font-display text-3xl font-semibold tracking-tight">
          {slide.title}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">{slide.body}</p>
        <div className="mt-8 flex gap-1.5">
          {slides.map((_, idx) => (
            <span
              key={idx}
              className={`h-1 rounded-full transition-[width,background-color] duration-200 ${
                idx === i ? "w-6 bg-fg" : "w-1.5 bg-surface-2"
              }`}
            />
          ))}
        </div>
      </div>
      <div className="mx-auto w-full max-w-md">
        <Button
          className="w-full"
          size="lg"
          onClick={() => (last ? setOnboarded() : setI(i + 1))}
        >
          {last ? t.onboardingDone : t.onboardingNext}
        </Button>
      </div>
    </div>
  );
}
