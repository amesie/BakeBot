"use client";

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";
import {
  DEFAULT_LANGUAGE,
  dictionaries,
  isLanguage,
  type Language,
  type Messages,
} from "@/lib/i18n";

// The chosen language lives in localStorage so it survives reloads without a
// cookie or account. The server always renders English; the client switches
// after hydration if another language was chosen.
const STORAGE_KEY = "kdpops-lang";
const CHANGE_EVENT = "kdpops-lang-change";

function readLanguage(): Language {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isLanguage(stored) ? stored : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

type I18nValue = { language: Language; messages: Messages; setLanguage: (l: Language) => void };

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const language = useSyncExternalStore(subscribe, readLanguage, () => DEFAULT_LANGUAGE);

  const setLanguage = useCallback((next: Language) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing: the choice just won't persist.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === "en" ? "en-ZA" : language;
  }, [language]);

  return (
    <I18nContext.Provider value={{ language, messages: dictionaries[language], setLanguage }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside <I18nProvider>");
  return value;
}
