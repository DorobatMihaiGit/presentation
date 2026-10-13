import { describe, expect, it } from "vitest";
import { OG_SIZE, renderOgCard } from "@/lib/og-image";

// Satori lays out text with the bundled Mona Sans TTF (src/app/og). The
// built /ro card was also checked by eye: ș ț ă â î render in Mona Sans.
describe("renderOgCard", () => {
  it("draws a Romanian card with diacritics", async () => {
    const response = await renderOgCard({
      eyebrow: "Inginer Fullstack Senior",
      title: "Ștefan Țărănescu",
      lines: ["Construiește aplicații în București, încă și mâine."],
    });
    const png = Buffer.from(await response.arrayBuffer());
    expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(OG_SIZE.width);
    expect(png.readUInt32BE(20)).toBe(OG_SIZE.height);
  });
});
