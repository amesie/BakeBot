// Spec 7.9: every UI string exists in en, xh and af with the same placeholders.
import { describe, expect, it } from "vitest";
import { dictionaries, format, type Language } from "@/lib/i18n";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((out, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? { ...out, [path]: value } : { ...out, ...flatten(value, path) };
  }, {});
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

const en = flatten(dictionaries.en);

describe("message dictionaries [spec 7.9]", () => {
  it.each(["xh", "af"] as Language[])("%s has exactly the same keys as en", (lang) => {
    expect(Object.keys(flatten(dictionaries[lang])).sort()).toEqual(Object.keys(en).sort());
  });

  it.each(["xh", "af"] as Language[])("%s keeps every {placeholder}", (lang) => {
    const other = flatten(dictionaries[lang]);
    for (const key of Object.keys(en)) {
      expect(placeholders(other[key]), key).toEqual(placeholders(en[key]));
    }
  });

  it.each(["xh", "af"] as Language[])("%s is flagged for fluent-speaker review", (lang) => {
    expect(dictionaries[lang].meta.status).toBe("NEEDS_REVIEW");
  });

  it("has no empty strings", () => {
    for (const lang of ["en", "xh", "af"] as Language[]) {
      for (const [key, value] of Object.entries(flatten(dictionaries[lang]))) {
        expect(value.trim(), `${lang}.${key}`).not.toBe("");
      }
    }
  });
});

describe("format()", () => {
  it("fills placeholders and leaves unknown ones alone", () => {
    expect(format("FROM R{price}", { price: 10 })).toBe("FROM R10");
    expect(format("Hi {name}", {})).toBe("Hi {name}");
  });
});
