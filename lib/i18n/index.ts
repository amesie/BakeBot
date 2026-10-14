// UI language dictionaries (spec 7.9). English is final; isiXhosa and
// Afrikaans are drafts marked NEEDS_REVIEW until a fluent speaker checks them
// (see docs/TRANSLATIONS.md).
import en from "@/messages/en.json";
import xh from "@/messages/xh.json";
import af from "@/messages/af.json";

export type Messages = typeof en;
export type Language = "en" | "xh" | "af";

export const LANGUAGES: { code: Language; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "xh", label: "XH" },
  { code: "af", label: "AF" },
];

export const DEFAULT_LANGUAGE: Language = "en";

export const dictionaries: Record<Language, Messages> = { en, xh, af };

export function isLanguage(value: unknown): value is Language {
  return value === "en" || value === "xh" || value === "af";
}

/** Fill {placeholders} in a message: format("FROM R{price}", { price: 10 }). */
export function format(message: string, values: Record<string, string | number>) {
  return message.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
