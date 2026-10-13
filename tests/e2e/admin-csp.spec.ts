import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./admin-login";
import { expectSecurityHeaders, watchCsp } from "./csp";
import { deleteMedia, mediaId, pngFile, uploadMedia } from "./media-library";

// The admin runs under the same CSP as the public pages (security-headers.spec.ts).

test("signing in, an upload and the markdown preview raise no CSP violation", async ({
  page,
  request,
}) => {
  const check = await watchCsp(page);
  await signInAsOwner(page);

  await uploadMedia(page, await pngFile("csp.png", 320, 200), {
    en: "CSP check upload",
  });
  const src = await page
    .getByRole("img", { name: "CSP check upload" })
    .getAttribute("src");
  expect(src).toMatch(/^\/api\/media\//);
  const served = await request.get(src ?? "");
  expect(served.status()).toBe(200);
  expectSecurityHeaders(served.headers());

  await page.goto("/admin/projects/new");
  const id = await mediaId(page, "Cover image", "CSP check upload");
  await page.getByLabel("Case study (EN)").fill("## Heading\n\n**bold**");
  await page.getByRole("button", { name: "Preview Case study (EN)" }).click();
  await expect(page.getByRole("heading", { name: "Heading" })).toBeVisible();

  await page.goto("/admin/profile");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await check();
  await deleteMedia(page, id);
});
