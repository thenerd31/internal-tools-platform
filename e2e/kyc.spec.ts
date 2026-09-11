import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("KYC analyst and supervisor workflows", async ({ page }) => {
  await login(page, "analyst@demo.local");
  await page.goto("/apps/kyc");
  await expect(page.getByRole("heading", { name: "KYC queue" })).toBeVisible();
  await expect(page.getByText("Customer 08")).toHaveCount(0);
  await expect(page.getByText("Customer 01")).toBeVisible();
  const riskScores = await page
    .getByTestId("risk-badge")
    .evaluateAll((badges) => badges.map((badge) => Number(badge.getAttribute("data-risk"))));
  expect(riskScores).toEqual([...riskScores].sort((a, b) => b - a));

  await page.getByLabel("Status").selectOption("pending");
  await expect(page.getByTestId("case-row")).not.toHaveCount(0);
  await expect(page.getByTestId("case-row").filter({ hasText: "in_review" })).toHaveCount(0);
  await page.getByLabel("Status").selectOption("");
  await page.screenshot({ path: "e2e-artifacts/kyc-queue-1280.png", fullPage: true });

  await page.getByRole("button", { name: "Claim next" }).click();
  await page.waitForURL("/apps/kyc/kyc-0010");
  await expect(page.getByText("Customer 10")).toBeVisible();
  await page.screenshot({ path: "e2e-artifacts/kyc-case-1280.png", fullPage: true });

  await page.goto("/apps/kyc/kyc-0004");
  await expect(page.getByTestId("decision-disabled-reason")).toHaveText(
    "Cases with risk score 70+ require a supervisor",
  );
  await page.screenshot({
    path: "e2e-artifacts/kyc-case-forbidden-1280.png",
    fullPage: true,
  });

  await page.goto("/apps/kyc/kyc-0010");
  await page.getByLabel("Reason").fill("Identity documents verified");
  await page.getByRole("button", { name: "Submit decision" }).click();
  await page.waitForTimeout(1000);
  await page.reload();
  await expect(page.getByText("approved", { exact: true })).toBeVisible();

  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/apps/kyc");
  await page.screenshot({ path: "e2e-artifacts/kyc-queue-375.png", fullPage: true });
  await page.goto("/apps/kyc/kyc-0010");
  await page.screenshot({ path: "e2e-artifacts/kyc-case-375.png", fullPage: true });
  await page.goto("/apps/kyc/kyc-0004");
  await page.screenshot({
    path: "e2e-artifacts/kyc-case-forbidden-375.png",
    fullPage: true,
  });

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/login/);
  await login(page, "supervisor@demo.local");
  await page.goto("/apps/kyc/kyc-0004");
  await expect(page.getByText("Customer 04")).toBeVisible();
  await expect(page.getByTestId("decision-disabled-reason")).toHaveCount(0);
  await page.getByLabel("Reason").fill("Supervisor completed enhanced review");
  await page.getByRole("button", { name: "Submit decision" }).click();
  await page.waitForTimeout(1000);
  await page.reload();
  await expect(page.getByText("approved", { exact: true })).toBeVisible();

  await page.goto("/apps/kyc");
  await expect(page.getByText("Customer 08")).toBeVisible();
  await page.getByLabel("Status").selectOption("approved");
  await expect(page.getByTestId("case-row")).not.toHaveCount(0);
  await expect(page.getByTestId("case-row").filter({ hasText: "pending" })).toHaveCount(0);

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/login/);
  await login(page, "admin@demo.local");
  await page.goto("/admin/audit");
  await page.getByRole("button", { name: "Verify chain" }).click();
  await expect(page.getByTestId("verify-result")).toHaveText(/^OK \d+ rows$/);
});
