import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("admin sees /admin/audit newest first and Verify chain shows OK", async ({
  page,
}) => {
  await login(page, "admin@demo.local");
  await page.goto("/admin/audit");
  await expect(page.getByRole("heading", { name: "Audit log" })).toBeVisible();
  // Seed writes one row per user; newest first means highest seq on top.
  const firstSeq = await page.locator("tbody tr td").first().textContent();
  expect(Number(firstSeq)).toBe(5);
  await page.getByRole("button", { name: "Verify chain" }).click();
  await expect(page.getByTestId("verify-result")).toHaveText(/^OK \d+ rows$/);
});

test("analyst gets the 403 page at /admin/audit", async ({ page }) => {
  await login(page, "analyst@demo.local");
  const res = await page.goto("/admin/audit");
  expect(res?.status()).toBe(403);
  await expect(page.getByText("403")).toBeVisible();
  await expect(page.getByText("You do not have access to this page.")).toBeVisible();
});

test("analyst does not see the Audit log nav link", async ({ page }) => {
  await login(page, "analyst@demo.local");
  await expect(page.getByRole("link", { name: "Audit log" })).toHaveCount(0);
});
