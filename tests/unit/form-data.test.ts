import { describe, expect, it } from "vitest";
import { formToObject } from "@/server/admin/form-data";

function form(entries: Array<[string, string]>): FormData {
  const data = new FormData();
  for (const [key, value] of entries) {
    data.append(key, value);
  }
  return data;
}

describe("formToObject", () => {
  it("nests dotted names into objects", () => {
    expect(
      formToObject(
        form([
          ["location", "Cluj-Napoca"],
          ["en.headline", "Hello"],
          ["ro.headline", "Salut"],
        ]),
      ),
    ).toEqual({
      location: "Cluj-Napoca",
      en: { headline: "Hello" },
      ro: { headline: "Salut" },
    });
  });

  it("turns repeated keys into arrays", () => {
    expect(
      formToObject(
        form([
          ["skills", "nextjs"],
          ["skills", "postgres"],
        ]),
      ),
    ).toEqual({ skills: ["nextjs", "postgres"] });
  });

  it("drops Next's internal action fields", () => {
    expect(
      formToObject(
        form([
          ["$ACTION_ID_abc", ""],
          ["slug", "x"],
        ]),
      ),
    ).toEqual({ slug: "x" });
  });

  it("cannot pollute Object.prototype through crafted field names", () => {
    const result = formToObject(
      form([
        ["__proto__.polluted", "yes"],
        ["en.__proto__.polluted", "yes"],
        ["constructor.prototype.polluted", "yes"],
      ]),
    );

    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(result).toEqual({});
  });
});
