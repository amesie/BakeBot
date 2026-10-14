"use client";

import { useI18n } from "@/components/i18n-provider";
import { LANGUAGES } from "@/lib/i18n";

export function LanguageToggle() {
  const { language, messages, setLanguage } = useI18n();
  return (
    <div className="lang-toggle" role="group" aria-label={messages.nav.language}>
      {LANGUAGES.map(({ code, label }) => (
        <button key={code} type="button" aria-pressed={language === code} onClick={() => setLanguage(code)}>
          {label}
        </button>
      ))}
    </div>
  );
}
