import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "phone", width: 390, height: 844 },
] as const;

for (const locale of ["en", "ro"] as const) {
  for (const viewport of VIEWPORTS) {
    test(`/${locale} has no axe violations (${viewport.name})`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto(`/${locale}`);

      const { violations } = await new AxeBuilder({ page }).analyze();

      expect(
        violations.map((v) => ({
          id: v.id,
          targets: v.nodes.map((node) => node.target.join(" ")),
        })),
      ).toEqual([]);
    });
  }
}
