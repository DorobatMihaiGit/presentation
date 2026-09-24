import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { signInAsOwner } from "./admin-login";

test("uploads an image, serves it and deletes it", async ({
  page,
  request,
}) => {
  await signInAsOwner(page);
  await page.goto("/admin/media");
  const buffer = await sharp({
    create: { width: 32, height: 24, channels: 3, background: "#7cc5ff" },
  })
    .png()
    .toBuffer();

  await page.getByLabel(/^File/).setInputFiles({
    name: "portrait.png",
    mimeType: "image/png",
    buffer,
  });
  await page.getByLabel("Alt text (EN)", { exact: true }).fill("Portrait");
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByRole("status").first()).toHaveText("Uploaded.");

  const image = page.getByRole("img", { name: "Portrait" });
  await expect(image).toBeVisible();
  const src = await image.getAttribute("src");
  expect(src).toMatch(/^\/api\/media\/[0-9a-f-]{36}\.png$/);
  const served = await request.get(src ?? "");
  expect(served.status()).toBe(200);
  expect(served.headers()["content-type"]).toBe("image/png");
  expect(served.headers()["x-content-type-options"]).toBe("nosniff");

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /^Delete / }).click();
  await expect(image).toHaveCount(0);
  expect((await request.get(src ?? "")).status()).toBe(404);
});

test("refuses a file that is not really an image", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/admin/media");

  await page.getByLabel(/^File/).setInputFiles({
    name: "cute.png",
    mimeType: "image/png",
    buffer: Buffer.from("<svg onload=alert(1)>"),
  });
  await page.getByRole("button", { name: "Upload" }).click();

  await expect(
    page.getByText("Upload a JPEG, PNG, WebP, AVIF or PDF file.").first(),
  ).toBeVisible();
});

test("the media route never serves paths outside the upload folder", async ({
  request,
}) => {
  for (const key of ["..%2F..%2Fpackage.json", "package.json", "x.svg"]) {
    expect((await request.get(`/api/media/${key}`)).status()).toBe(404);
  }
});

test("the media page has no axe violations", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/admin/media");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).analyze();

  expect(violations.map((v) => v.id)).toEqual([]);
});
