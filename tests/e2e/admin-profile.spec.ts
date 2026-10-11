import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { signInAsOwner } from "./admin-login";
import {
  deleteMedia,
  mediaId,
  PDF_FILE,
  pngFile,
  uploadMedia,
} from "./media-library";

const SEEDED_RO_HEADLINE =
  "Dezvoltator fullstack care construiește produse web rapide și accesibile, de la baza de date la pixel.";
const SEEDED_EN_HEADLINE =
  "Fullstack developer building fast, accessible web products from database to pixel.";

test.beforeEach(async ({ page }) => {
  await signInAsOwner(page);
});

test("a Romanian headline edited in the admin shows on /ro", async ({
  page,
}) => {
  const headline = page.getByLabel("Headline (RO)");
  await expect(headline).toHaveValue(SEEDED_RO_HEADLINE);

  await headline.fill("Construiesc produse web rapide, de la bază la pixel.");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toHaveText("Profile saved.");
  await expect(headline).toHaveValue(
    "Construiesc produse web rapide, de la bază la pixel.",
  );

  await page.goto("/ro");
  await expect(
    page.getByText("Construiesc produse web rapide, de la bază la pixel."),
  ).toBeVisible();

  await page.goto("/admin/profile");
  await page.getByLabel("Headline (RO)").fill(SEEDED_RO_HEADLINE);
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toHaveText("Profile saved.");
});

test("a blank Romanian headline falls back to English on /ro", async ({
  page,
}) => {
  await page.getByLabel("Headline (RO)").fill("");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toHaveText("Profile saved.");
  await expect(
    page.getByRole("group", { name: "Headline RO missing" }),
  ).toBeVisible();

  await page.goto("/ro");
  const fallback = page.getByText(SEEDED_EN_HEADLINE);
  await expect(fallback).toBeVisible();
  await expect(fallback).toHaveAttribute("lang", "en");

  await page.goto("/admin/profile");
  await page.getByLabel("Headline (RO)").fill(SEEDED_RO_HEADLINE);
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toHaveText("Profile saved.");
});

test("shows field errors and keeps the typed values", async ({ page }) => {
  await page.getByLabel("GitHub URL").fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Save profile" }).click();

  await expect(page.getByRole("status")).toHaveText(
    "Check the highlighted fields.",
  );
  await expect(page.getByText("Use an http(s) URL")).toBeVisible();
  await expect(page.getByLabel("GitHub URL")).toHaveValue(
    "javascript:alert(1)",
  );
});

test("the profile page has no axe violations", async ({ page }) => {
  const { violations } = await new AxeBuilder({ page }).analyze();

  expect(violations.map((v) => v.id)).toEqual([]);
});

async function pick(page: Page, picks: Record<string, string>) {
  await page.goto("/admin/profile");
  for (const [picker, option] of Object.entries(picks)) {
    await page
      .getByLabel(picker, { exact: true })
      .selectOption({ label: option });
  }
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toHaveText("Profile saved.");
}

test("the headshot and the CV PDF picked here show on the home page", async ({
  page,
  request,
}) => {
  await uploadMedia(page, await pngFile("headshot.png", 400, 400), {
    en: "Owner headshot",
  });
  await uploadMedia(page, PDF_FILE, { en: "Owner resume (EN)" });
  await page.goto("/admin/profile");
  const ids = [
    await mediaId(page, "Avatar", "Owner headshot"),
    await mediaId(page, "CV PDF (EN)", "Owner resume (EN)"),
  ];
  await pick(page, {
    Avatar: "Owner headshot",
    "CV PDF (EN)": "Owner resume (EN)",
  });

  await page.goto("/en");
  const download = page
    .getByRole("region", { name: "Alex Marin" })
    .getByRole("link", { name: /Download CV/ });
  await expect(download).toHaveAttribute("href", /^\/api\/media\/.+\.pdf$/);
  await expect(download).toHaveAttribute("type", "application/pdf");
  const pdf = await request.get((await download.getAttribute("href")) ?? "");
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  await expect(
    page
      .getByRole("region", { name: "Let's build" })
      .getByRole("link", { name: /Download CV/ }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "About" })
      .getByRole("img", { name: "Owner headshot" }),
  ).toBeVisible();

  // No Romanian PDF yet: /ro offers the English one and says so.
  await page.goto("/ro");
  await expect(
    page
      .getByRole("region", { name: "Alex Marin" })
      .getByRole("link", { name: /Descarcă CV-ul/ }),
  ).toHaveAttribute("hreflang", "en");

  await pick(page, { Avatar: "None", "CV PDF (EN)": "None" });
  await page.goto("/en");
  await expect(page.getByRole("link", { name: /Download CV/ })).toHaveCount(0);
  for (const id of ids) {
    await deleteMedia(page, id);
  }
});
