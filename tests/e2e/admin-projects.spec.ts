import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import sharp from "sharp";
import { signInAsOwner } from "./admin-login";

test.beforeEach(async ({ page }) => {
  await signInAsOwner(page);
});

test("a project is created with a markdown preview and published", async ({
  page,
}) => {
  await page.goto("/admin/projects/new");
  await page.getByLabel("Slug").fill("orbit");
  await page.getByLabel("Year").fill("2026");
  await page.getByLabel("Title (EN)").fill("Orbit");
  await page.getByLabel("Summary (EN)").fill("Satellite pass planner.");
  await page.getByLabel("Role (EN)").fill("Lead developer");
  await page
    .getByLabel("Outcome (EN)")
    .fill("Planning went from hours to minutes.");
  await page
    .getByLabel("Case study (EN)")
    .fill("## Why\n\nPlain **bold**\n\n<script>alert(1)</script>");
  await page.getByRole("button", { name: "Preview Case study (EN)" }).click();
  await expect(page.getByRole("heading", { name: "Why" })).toBeVisible();
  await expect(page.locator("strong", { hasText: "bold" })).toBeVisible();
  await expect(page.locator("form script")).toHaveCount(0);
  await page.getByLabel("PostgreSQL").check();
  await page.getByLabel("Published").check();
  await page.getByRole("button", { name: "Add project" }).click();
  await expect(page).toHaveURL("/admin/projects/orbit");

  await page.goto("/en");
  await expect(page.locator("#projects")).toContainText("Orbit");

  await page.goto("/admin/projects/orbit");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL("/admin/projects");
});

/** Uploads a 1600x1000 PNG to the media library under `alt`. */
async function uploadCover(page: Page, alt: { en: string; ro: string }) {
  await page.goto("/admin/media");
  const buffer = await sharp({
    create: { width: 1600, height: 1000, channels: 3, background: "#27496d" },
  })
    .png()
    .toBuffer();
  await page.getByLabel(/^File/).setInputFiles({
    name: "cover.png",
    mimeType: "image/png",
    buffer,
  });
  await page.getByLabel("Alt text (EN)", { exact: true }).fill(alt.en);
  await page.getByLabel("Alt text (RO)", { exact: true }).fill(alt.ro);
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByRole("status").first()).toHaveText("Uploaded.");
}

test("a cover, a case study and links from the admin reach the project page", async ({
  page,
  request,
}) => {
  await uploadCover(page, {
    en: "The pass planner at dawn",
    ro: "Planificatorul de treceri în zori",
  });

  await page.goto("/admin/projects/new");
  await page.getByLabel("Slug").fill("pass-planner");
  await page.getByLabel("Year").fill("2026");
  await page.getByLabel("Live URL").fill("https://example.com/pass-planner");
  await page
    .getByLabel("Source URL")
    .fill("https://example.com/pass-planner/source");
  await page
    .getByLabel("Cover image")
    .selectOption({ label: "The pass planner at dawn" });
  await page.getByLabel("Title (EN)").fill("Pass Planner");
  await page.getByLabel("Summary (EN)").fill("Plans satellite passes.");
  await page.getByLabel("Role (EN)").fill("Lead developer");
  await page.getByLabel("Outcome (EN)").fill("Hours became minutes.");
  await page
    .getByLabel("Case study (EN)")
    .fill(
      [
        "## Why",
        "",
        "Planners worked **by hand**. See [the docs](https://example.com/docs).",
        "",
        "[Click me](javascript:alert(1))",
        "",
        "<script>alert(1)</script><b>raw</b>",
      ].join("\n"),
    );
  await page.getByLabel("Published").check();
  await page.getByRole("button", { name: "Add project" }).click();
  await expect(page).toHaveURL("/admin/projects/pass-planner");

  await page.goto("/en/projects/pass-planner");
  const project = page.getByRole("article");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Pass Planner",
  );
  const cover = project.getByRole("img", { name: "The pass planner at dawn" });
  await expect(cover).toBeVisible();
  await expect
    .poll(() =>
      cover.evaluate((img: HTMLImageElement) =>
        img.complete ? img.naturalWidth : 0,
      ),
    )
    .toBeGreaterThan(0);
  expect(await cover.getAttribute("src")).toContain(
    "/_next/image?url=%2Fapi%2Fmedia%2F",
  );
  await expect(
    project.getByRole("heading", { level: 2, name: "Why" }),
  ).toBeVisible();
  await expect(project.locator("strong")).toHaveText("by hand");
  await expect(project.getByRole("link", { name: "the docs" })).toHaveAttribute(
    "href",
    "https://example.com/docs",
  );
  expect(
    await project
      .getByText("Click me")
      .evaluate((node) => node.closest("a")?.getAttribute("href") ?? ""),
  ).not.toContain("javascript");
  await expect(project.locator("script, b")).toHaveCount(0);
  await expect(project).not.toContainText("raw");
  await expect(
    project.getByRole("link", { name: "Live site: Pass Planner" }),
  ).toHaveAttribute("href", "https://example.com/pass-planner");
  await expect(
    project.getByRole("link", { name: "Source code: Pass Planner" }),
  ).toHaveAttribute("href", "https://example.com/pass-planner/source");

  await page.goto("/ro/projects/pass-planner");
  await expect(
    page.getByRole("img", { name: "Planificatorul de treceri în zori" }),
  ).toBeVisible();
  expect(await (await request.get("/sitemap.xml")).text()).toContain(
    "/en/projects/pass-planner</loc>",
  );

  // Editing it in the admin expires the cached page (updateTag).
  await page.goto("/admin/projects/pass-planner");
  await page.getByLabel("Title (EN)").fill("Pass Planner 2");
  await page.getByRole("button", { name: "Save project" }).click();
  await expect(page.getByRole("status").first()).toHaveText("Project saved.");
  await page.goto("/en/projects/pass-planner");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Pass Planner 2",
  );

  page.once("dialog", (dialog) => dialog.accept());
  await page.goto("/admin/projects/pass-planner");
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL("/admin/projects");
  await page.goto("/admin/media");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: /^Delete / })
    .first()
    .click();
  expect((await page.goto("/en/projects/pass-planner"))?.status()).toBe(404);
});

const PATHS = [
  "/admin/projects",
  "/admin/projects/new",
  "/admin/projects/ledger-lens",
];

for (const path of PATHS) {
  test(`${path} has no axe violations`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).analyze();

    expect(
      violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((node) => node.target.join(" ")),
      })),
    ).toEqual([]);
  });
}
