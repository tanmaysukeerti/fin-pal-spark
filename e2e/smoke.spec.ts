import { test, expect } from "@playwright/test";

test("auth guard redirects to login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText("Welcome back")).toBeVisible();
});

test("demo login → dashboard → add a transaction", async ({ page }) => {
  await page.goto("/login");

  // Use the demo account.
  await page.getByLabel("Email").fill("demo@finai.app");
  await page.getByLabel("Password").fill("demo12345");
  await page.getByRole("button", { name: /sign in/i }).click();

  // Lands on the dashboard.
  await expect(page).toHaveURL("http://localhost:8080/");
  await expect(page.getByText("Live Net Worth")).toBeVisible();

  // Navigate to transactions and open the add modal.
  await page.goto("/transactions");
  await expect(page.getByRole("heading", { name: /transactions/i })).toBeVisible();
  await page.getByRole("button", { name: /add transaction/i }).first().click();
  await expect(page.getByText(/log money in or out/i)).toBeVisible();
});

test("pods page shows seeded pods", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("demo@finai.app");
  await page.getByLabel("Password").fill("demo12345");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.goto("/pods");
  await expect(page.getByText("PlayStation 5")).toBeVisible();
});
