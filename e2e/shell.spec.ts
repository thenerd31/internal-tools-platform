import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("unauthenticated /admin/* and /apps/* redirect to /login", async ({ page }) => {
  await page.goto("/admin/audit");
  await page.waitForURL(/\/login/);
  await page.goto("/apps/anything");
  await page.waitForURL(/\/login/);
});

test("admin login lands on / and shows name and role", async ({ page }) => {
  await login(page, "admin@demo.local");
  await expect(page.getByText("Demo Admin")).toBeVisible();
  await expect(page.getByText("admin", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /KYC review queue/ })).toBeVisible();
});

test("sign out clears the session", async ({ page }) => {
  await login(page, "admin@demo.local");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/login/);
  await page.goto("/admin/audit");
  await page.waitForURL(/\/login/);
});

test("unknown route renders the 404 page", async ({ page }) => {
  await login(page, "admin@demo.local");
  await page.goto("/no-such-page");
  await expect(page.getByText("404")).toBeVisible();
});

test("bad credentials show an inline error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@demo.local");
  await page.getByLabel("Password").fill("wrong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Invalid email or password.")).toBeVisible();
});
