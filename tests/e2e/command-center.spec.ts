import { expect, test, type APIResponse } from "@playwright/test";

type ApiRecord = Record<string, unknown>;

async function readOk(response: APIResponse, label: string): Promise<ApiRecord> {
	const body = await response.text();
	expect(response.ok(), `${label} failed with ${String(response.status())}: ${body}`).toBe(true);
	const payload = JSON.parse(body) as { data?: ApiRecord };
	return payload.data ?? {};
}

function record(value: unknown): ApiRecord {
	return typeof value === "object" && value !== null ? (value as ApiRecord) : {};
}

function stringField(value: unknown, field: string): string {
	const result = record(value)[field];
	expect(typeof result, `${field} must be returned`).toBe("string");
	return result as string;
}

test("renders the command-center shell", async ({ page }) => {
	await page.goto("/");

	await expect(page.getByRole("heading", { name: "Command Center" })).toBeVisible();
	await expect(page.getByRole("link", { name: "Workspaces" })).toBeVisible();
	await expect(page.getByText("Session Required")).toBeVisible();
});

test("renders the mobile login route", async ({ page }) => {
	await page.goto("/login");

	await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();
	await expect(page.getByLabel("Email")).toBeVisible();
	await expect(page.getByLabel("Password")).toBeVisible();
});

test("authenticated MVP pages expose safe actions and keep failed form input", async ({ page, baseURL }) => {
	const suffix = `${String(Date.now())}-${Math.random().toString(36).slice(2, 8)}`;
	const password = "AuditPass123!";
	const email = `ui-audit-${suffix}@example.com`;
	const headers = { Origin: new URL(baseURL ?? "http://127.0.0.1:5173").origin };

	await readOk(
		await page.request.post("/api/auth/signup", {
			headers,
			data: { email, password, name: "UI Audit" },
		}),
		"signup",
	);

	const workspaceData = await readOk(
		await page.request.post("/api/workspaces", {
			headers,
			data: { name: `Audit Workspace ${suffix}`, slug: `audit-ws-${suffix}` },
		}),
		"workspace create",
	);
	const workspace = record(workspaceData.workspace);
	const workspaceId = stringField(workspace, "id");
	const workspaceSlug = stringField(workspace, "slug");

	const brandData = await readOk(
		await page.request.post(`/api/workspaces/${workspaceId}/brands`, {
			headers,
			data: {
				name: `Audit Brand ${suffix}`,
				websiteUrl: "https://example.com",
				industry: "Marketing",
				startOnboarding: false,
			},
		}),
		"brand create",
	);
	const brandId = stringField(brandData.brand, "id");

	const pages = [
		{ path: "/", heading: "Command Center" },
		{ path: "/workspaces", heading: "Workspaces" },
		{ path: `/workspaces/${workspaceId}`, heading: "Workspace" },
		{ path: `/workspaces/${workspaceId}/billing`, heading: "Billing" },
		{ path: `/brands/${brandId}`, heading: "Summary" },
		{ path: `/brands/${brandId}/onboarding`, heading: "Onboarding" },
		{ path: `/brands/${brandId}/intelligence`, heading: "Intelligence" },
		{ path: `/brands/${brandId}/profile`, heading: "Profile" },
		{ path: `/brands/${brandId}/target-market`, heading: "Target Market" },
		{ path: `/brands/${brandId}/calendar`, heading: "Calendar" },
		{ path: `/brands/${brandId}/approvals`, heading: "Approvals" },
		{ path: `/brands/${brandId}/media`, heading: "Media" },
		{ path: `/brands/${brandId}/dm-rules`, heading: "DM Rules" },
		{ path: `/brands/${brandId}/reports`, heading: "Reports" },
		{ path: `/brands/${brandId}/growth`, heading: "Growth" },
		{ path: "/logout", heading: "Logout" },
	];

	for (const route of pages) {
		await page.goto(route.path);
		await expect(page.getByRole("heading", { level: 1, name: route.heading })).toBeVisible();
		await expect(page.locator("main")).toBeVisible();
		await expect(page.locator("body")).not.toContainText("Could not load this page");
	}

	await page.goto(`/brands/${brandId}/onboarding`);
	await page.getByRole("button", { name: "Start Scan" }).click();
	await expect(page.getByText("Saved.")).toBeVisible();

	await page.goto(`/workspaces/${workspaceId}/billing`);
	const checkout = page.getByRole("button", { name: "Start Checkout" });
	await expect(checkout).toBeVisible();
	if (await checkout.isDisabled()) {
		await expect(page.getByText("Stripe is disabled")).toBeVisible();
	} else {
		await expect(page.getByText("Stripe configured")).toBeVisible();
	}

	await page.goto("/admin");
	await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
	await expect(page.getByText("Admin access is required.")).toBeVisible();

	await page.goto("/workspaces");
	await page.getByLabel("Workspace Name").fill("Duplicate Workspace");
	await page.getByLabel("Slug").fill(workspaceSlug);
	await page.getByRole("button", { name: "Create Workspace" }).click();
	await expect(page.getByText("Workspace slug already exists.")).toBeVisible();
	await expect(page.getByLabel("Slug")).toHaveValue(workspaceSlug);
});
