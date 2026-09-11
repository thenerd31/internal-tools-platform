import fs from "node:fs";
import { test } from "@playwright/test";
import { login } from "./helpers";

const OUT = "e2e-artifacts";

test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));

for (const width of [1280, 375]) {
  test(`screenshots at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });

    await login(page, "admin@demo.local");
    await page.screenshot({ path: `${OUT}/admin-home-${width}.png` });
    await page.goto("/admin/audit");
    await page.getByRole("button", { name: "Verify chain" }).click();
    await page.screenshot({ path: `${OUT}/admin-audit-${width}.png` });
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/login/);

    await login(page, "analyst@demo.local");
    await page.screenshot({ path: `${OUT}/analyst-home-${width}.png` });
  });
}
