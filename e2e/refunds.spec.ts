import fs from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { login } from "./helpers";

const OUT = "e2e-artifacts";

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/login/);
}

/** Dev-mode pages may not be hydrated on first click; retry until the dialog renders. */
async function openRefundDialog(page: Page, row: Locator) {
  await expect
    .poll(async () => {
      await row.getByRole("button", { name: "Refund" }).click();
      return page.getByRole("dialog", { name: "Refund transaction" }).count();
    })
    .toBeGreaterThan(0);
}

test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));

test("AC12 agent searches, opens customer, dialog generates idempotency key", async ({
  page,
}) => {
  await login(page, "agent@demo.local");
  await page.goto("/apps/refunds");
  await page.getByLabel("Search").fill("Ada");
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByRole("link", { name: "Open" }).first().click();
  await expect(
    page.getByRole("heading", { name: "Ada Lovelace" }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(4);
  await openRefundDialog(page, page.locator("tbody tr").first());
  await expect(page.getByTestId("idempotency-key")).toHaveValue(
    /^[0-9a-f-]{36}$/,
  );
});

test("agent gets 403 on approvals", async ({ page }) => {
  await login(page, "agent@demo.local");
  const res = await page.goto("/apps/refunds/approvals");
  expect(res?.status()).toBe(403);
  await expect(page.getByText("403")).toBeVisible();
});

test("AC14 e2e: agent requests above ceiling, lead approves, admin verifies chain", async ({
  page,
}) => {
  await login(page, "agent@demo.local");
  await page.goto("/apps/refunds/customers/cust-1");
  // Pick a row whose remaining is above 50001; fall back to the first row.
  const rows = page.locator("tbody tr");
  let target = rows.first();
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    const cell = await rows.nth(i).locator("td").nth(3).textContent();
    const remaining = Number((cell ?? "").replace(/[^0-9.]/g, "")) * 100;
    if (remaining > 50001) {
      target = rows.nth(i);
      break;
    }
  }
  await openRefundDialog(page, target);
  await page.getByLabel("Amount (cents)").fill("50001");
  await page
    .getByLabel("Reason")
    .fill("Customer reported duplicate charge");
  await page.getByRole("button", { name: "Submit refund" }).click();
  await expect(page.getByTestId("refund-result")).toHaveText(
    "Refund pending approval",
  );
  await signOut(page);

  await login(page, "lead@demo.local");
  await page.goto("/apps/refunds/approvals");
  const row = page.locator("tbody tr", { hasText: "50,001" }).first();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Approve" }).click();
  await expect(
    page.locator("tbody tr", { hasText: "50,001" }),
  ).toHaveCount(0);
  await signOut(page);

  await login(page, "admin@demo.local");
  await page.goto("/admin/audit");
  await expect(page.getByText("refunds.refund.approve")).toBeVisible();
  await page.getByRole("button", { name: "Verify chain" }).click();
  await expect(page.getByTestId("verify-result")).toHaveText(/^OK \d+ rows$/);
});

test("screenshots", async ({ page }) => {
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 800 });
    await login(page, "agent@demo.local");
    await page.goto("/apps/refunds");
    await page.screenshot({ path: `${OUT}/refunds-search-${width}.png` });
    await page.getByRole("link", { name: "Open" }).first().click();
    await page.screenshot({ path: `${OUT}/refunds-customer-${width}.png` });
    await signOut(page);
    await login(page, "lead@demo.local");
    await page.goto("/apps/refunds/approvals");
    await page.screenshot({ path: `${OUT}/refunds-approvals-${width}.png` });
    await signOut(page);
  }
});
