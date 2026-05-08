import { expect, test } from "@playwright/test";

test("renders the command-center shell", async ({ page }) => {
	await page.goto("/");

	await expect(page.getByRole("heading", { name: "Command Center" })).toBeVisible();
	await expect(page.getByRole("link", { name: "Brands" })).toBeVisible();
	await expect(page.getByText("Approval first")).toBeVisible();
});

test("renders the approval-first mobile route", async ({ page }) => {
	await page.goto("/approvals");

	await expect(page.getByRole("heading", { name: "Approvals" })).toBeVisible();
	await expect(page.getByText("No direct publishing or unsafe DM automation")).toBeVisible();
});
