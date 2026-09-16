"use client";

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  ReactNode,
} from "react";
import {
  translations,
  type Language,
  type TranslationKey,
} from "./translations";

// [AUDIT] Орчуулгын толь ./translations.ts руу гарсан. 78 файл эндээс
// импортолдог тул нийтийн гадаргууг хэвээр үлдээхийн тулд дахин экспортлоно —
// дуудагч талд ямар ч өөрчлөлт шаардахгүй.
export { translations };
export type { Language, TranslationKey };

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

export const LanguageContext = createContext<LanguageContextType>({
  language: "mn",
  setLanguage: () => {},
  t: (key) => translations.mn[key],
});

// ─── Хэлний сонголтын store (localStorage) ─────────────────────────────────
// useSyncExternalStore: сервер ба hydration-ы үед "mn" (getServerSnapshot),
// дараа нь хадгалсан утга — mount-ийн effect дотор setState хийх шаардлагагүй.
// Нэг вкладка дотор солиход listeners-ээр, өөр вкладкад "storage" event-ээр шинэчлэгдэнэ.
const LANG_KEY = "lang";
const langListeners = new Set<() => void>();
// localStorage ашиглах боломжгүй (private mode г.м.) үед энэ сессийн утга
let memoryLanguage: Language | null = null;

function readLanguage(): Language {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "mn" || saved === "en") return saved;
  } catch {
    /* доорх memory утга */
  }
  return memoryLanguage ?? "mn";
}

function subscribeLanguage(onChange: () => void): () => void {
  langListeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === LANG_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    langListeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function writeLanguage(lang: Language): void {
  memoryLanguage = lang;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* private mode — зөвхөн энэ сессэд хэрэгжинэ */
  }
  langListeners.forEach((notify) => notify());
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const language = useSyncExternalStore(
    subscribeLanguage,
    readLanguage,
    () => "mn" as Language,
  );

  const value = useMemo<LanguageContextType>(
    () => ({
      language,
      setLanguage: writeLanguage,
      t: (key: TranslationKey) => translations[language][key],
    }),
    [language],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
