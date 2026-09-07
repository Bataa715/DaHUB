"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
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

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("mn");

  useEffect(() => {
    const saved = localStorage.getItem("lang") as Language | null;
    if (saved === "mn" || saved === "en") setLanguageState(saved);
  }, []);

  const value = useMemo<LanguageContextType>(
    () => ({
      language,
      setLanguage: (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem("lang", lang);
      },
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
