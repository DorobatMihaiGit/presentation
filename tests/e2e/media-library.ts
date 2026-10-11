import { expect, type Page } from "@playwright/test";
import sharp from "sharp";

// Admin spec files run in parallel workers: each test uploads files with
// its own alt text and deletes only those, found by their media id.

export async function pngFile(name: string, width: number, height: number) {
  const buffer = await sharp({
    create: { width, height, channels: 3, background: "#27496d" },
  })
    .png()
    .toBuffer();
  return { name, mimeType: "image/png", buffer };
}

export const PDF_FILE = {
  name: "cv.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4\n% e2e resume\n%%EOF\n"),
};

export async function uploadMedia(
  page: Page,
  file: { name: string; mimeType: string; buffer: Buffer },
  alt: { en: string; ro?: string },
) {
  await page.goto("/admin/media");
  await page.getByLabel(/^File/).setInputFiles(file);
  await page.getByLabel("Alt text (EN)", { exact: true }).fill(alt.en);
  await page.getByLabel("Alt text (RO)", { exact: true }).fill(alt.ro ?? "");
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByRole("status").first()).toHaveText("Uploaded.");
}

/** The media id behind a picker option (its label is the alt text). */
export async function mediaId(page: Page, picker: string, alt: string) {
  const id = await page
    .getByLabel(picker, { exact: true })
    .locator("option", { hasText: alt })
    .getAttribute("value");
  expect(id).toBeTruthy();
  return id ?? "";
}

export async function deleteMedia(page: Page, id: string) {
  await page.goto("/admin/media");
  const form = page
    .locator("form")
    .filter({ has: page.locator(`input[name="id"][value="${id}"]`) })
    .filter({ has: page.getByRole("button", { name: /^Delete / }) });
  page.once("dialog", (dialog) => dialog.accept());
  await form.getByRole("button", { name: /^Delete / }).click();
  await expect(form).toHaveCount(0);
}
