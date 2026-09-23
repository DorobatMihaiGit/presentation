import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import ro from "../../messages/ro.json";

function keyPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) {
    return [prefix];
  }
  return Object.entries(value).flatMap(([key, child]) =>
    keyPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("messages", () => {
  it("ro.json defines exactly the keys of en.json", () => {
    expect(keyPaths(ro).sort()).toEqual(keyPaths(en).sort());
  });

  it("pluralises years in English", () => {
    const t = createTranslator({ locale: "en", messages: en });

    expect(t("About.years", { count: 1 })).toBe("1 year");
    expect(t("About.years", { count: 9 })).toBe("9 years");
  });

  it("pluralises years with Romanian one/few/other forms", () => {
    const t = createTranslator({ locale: "ro", messages: ro });

    expect(t("About.years", { count: 1 })).toBe("1 an");
    expect(t("About.years", { count: 9 })).toBe("9 ani");
    expect(t("About.years", { count: 20 })).toBe("20 de ani");
  });
});
