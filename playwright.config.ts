import { defineConfig, devices } from "@playwright/test";

const webServer =
	process.env.PLAYWRIGHT_SKIP_WEB_SERVER === "1"
		? null
		: {
				command: "npm run dev -- --host 127.0.0.1",
				url: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5173",
				reuseExistingServer: !process.env.CI,
				timeout: 120_000,
			};

export default defineConfig({
	testDir: "./tests/e2e",
	timeout: 30_000,
	expect: {
		timeout: 5_000,
	},
	fullyParallel: true,
	retries: process.env.CI ? 2 : 0,
	reporter: process.env.CI ? "github" : "list",
	use: {
		baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5173",
		trace: "on-first-retry",
	},
	...(webServer ? { webServer } : {}),
	projects: [
		{ name: "chromium", use: { ...devices["Desktop Chrome"] } },
		{ name: "mobile-webkit", use: { ...devices["iPhone 15"] } },
	],
});
