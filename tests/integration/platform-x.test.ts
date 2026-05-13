/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Hono } from "hono";
import { Miniflare } from "miniflare";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type ApiSuccess<T> = { success: true; data: T };
type ApiFailure = { success: false; error: { code: string; message: string } };
type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

type TestEnv = Record<string, unknown> & {
	APP_ENV: string;
	PUBLIC_APP_URL: string;
	X_CLIENT_ID: string;
	X_CLIENT_SECRET: string;
	X_REDIRECT_URI: string;
	TOKEN_ENCRYPTION_KEY: string;
};

const password = "TestPassword123";

let mf: Miniflare;
let env: TestEnv;
let testApp: Hono;

beforeAll(async () => {
	testApp = await createApiApp();
});

beforeEach(async () => {
	vi.spyOn(console, "log").mockImplementation(() => undefined);
	({ mf, env } = await createEnv());
});

afterEach(async () => {
	vi.unstubAllGlobals();
	await mf.dispose();
});

describe("Phase C X (Twitter) integration", () => {
	it("blocks OAuth start with 503 FEATURE_DISABLED when ENABLE_X_PUBLISH is false", async () => {
		env.ENABLE_X_PUBLISH = "false";
		const { client, brandId } = await seedUserAndBrand("x-flag-off@example.com");
		const response = await client.get(`/api/brands/${brandId}/oauth/x/start`);
		expect(response.status).toBe(503);
		if (!response.body.success) {
			expect(response.body.error.code).toBe("FEATURE_DISABLED");
		}
	}, 30_000);

	it("returns 302 with PKCE code_challenge when flag is on + creds present", async () => {
		env.ENABLE_X_PUBLISH = "true";
		const { client, brandId } = await seedUserAndBrand("x-flag-on@example.com");
		const response = await rawRequest(env, `/api/brands/${brandId}/oauth/x/start`, {
			method: "GET",
			cookie: client.getCookie(),
		});
		expect(response.status).toBe(302);
		const location = response.headers.get("location") ?? "";
		expect(location).toContain("https://twitter.com/i/oauth2/authorize");
		expect(location).toContain("client_id=test_x_client_id");
		expect(location).toContain("response_type=code");
		expect(location).toContain("code_challenge=");
		expect(location).toContain("code_challenge_method=S256");
		const url = new URL(location);
		const state = url.searchParams.get("state");
		expect(state).not.toBeNull();
		expect(state!.length).toBeGreaterThan(20);
	}, 30_000);

	it("rejects OAuth callback with tampered state", async () => {
		env.ENABLE_X_PUBLISH = "true";
		const response = await rawRequest(env, "/api/oauth/x/callback?code=mock&state=tampered_garbage", {
			method: "GET",
		});
		expect(response.status).toBe(400);
		const body = (await response.json()) as ApiResponse<unknown>;
		if (!body.success) {
			expect(["OAUTH_STATE_INVALID", "OAUTH_CALLBACK_INVALID"]).toContain(body.error.code);
		}
	}, 30_000);

	it("OAuth callback completes happy path: PKCE exchange + userinfo + encrypted token write", async () => {
		env.ENABLE_X_PUBLISH = "true";
		const { brandId } = await seedUserAndBrand("x-callback@example.com");

		const { signState } = await import("../../src/server/services/platforms/oauth-state");
		const state = await signState(env, {
			brandId,
			platform: "x",
			codeVerifier: "mock_code_verifier_43_chars_min_xxxxxxxxxxxxx",
		});

		const fetchSpy = vi.fn((input: RequestInfo | URL): Promise<Response> => {
			const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
			if (url.startsWith("https://api.twitter.com/2/oauth2/token")) {
				return Promise.resolve(
					new Response(
						JSON.stringify({
							access_token: "X_ACCESS",
							refresh_token: "X_REFRESH",
							expires_in: 7200,
							scope: "tweet.read tweet.write users.read offline.access",
							token_type: "bearer",
						}),
						{ status: 200, headers: { "content-type": "application/json" } },
					),
				);
			}
			if (url.startsWith("https://api.twitter.com/2/users/me")) {
				return Promise.resolve(
					new Response(
						JSON.stringify({ data: { id: "999", username: "founder", name: "Founder" } }),
						{ status: 200, headers: { "content-type": "application/json" } },
					),
				);
			}
			return Promise.reject(new Error("unexpected fetch in X callback test: " + url));
		});
		vi.stubGlobal("fetch", fetchSpy);

		const response = await rawRequest(env, `/api/oauth/x/callback?code=mock_code&state=${encodeURIComponent(state)}`, {
			method: "GET",
		});
		expect(response.status).toBe(302);
		const location = response.headers.get("location") ?? "";
		expect(location).toContain(`/app/brands/${brandId}/connections`);
		expect(location).toContain("connected=x");

		const dbExposed = env.DB as {
			prepare(sql: string): { bind(...v: unknown[]): { first<T>(): Promise<T | null> } };
		};
		const tokenRow = await dbExposed
			.prepare(
				"SELECT brand_id, platform, external_account_id, status, scope_csv FROM social_account_tokens WHERE brand_id = ? AND platform = 'x'",
			)
			.bind(brandId)
			.first<{ brand_id: string; platform: string; external_account_id: string; status: string; scope_csv: string }>();
		expect(tokenRow?.brand_id).toBe(brandId);
		expect(tokenRow?.external_account_id).toBe("999");
		expect(tokenRow?.status).toBe("active");
		expect(tokenRow?.scope_csv).toContain("tweet.write");

		const profileRow = await dbExposed
			.prepare(
				"SELECT handle, connected_status FROM brand_social_profiles WHERE brand_id = ? AND platform = 'x'",
			)
			.bind(brandId)
			.first<{ handle: string; connected_status: string }>();
		expect(profileRow?.handle).toBe("founder");
		expect(profileRow?.connected_status).toBe("connected");

		const auditRow = await dbExposed
			.prepare(
				"SELECT action FROM audit_logs WHERE brand_id = ? AND action = 'platform.x.connected'",
			)
			.bind(brandId)
			.first<{ action: string }>();
		expect(auditRow?.action).toBe("platform.x.connected");
	}, 30_000);

	it("OAuth callback fails when state has no codeVerifier (PKCE missing)", async () => {
		env.ENABLE_X_PUBLISH = "true";
		const { brandId } = await seedUserAndBrand("x-no-pkce@example.com");
		// Sign a state without codeVerifier
		const { signState } = await import("../../src/server/services/platforms/oauth-state");
		const state = await signState(env, { brandId, platform: "x" });
		const response = await rawRequest(env, `/api/oauth/x/callback?code=mock&state=${encodeURIComponent(state)}`, {
			method: "GET",
		});
		expect(response.status).toBe(302);
		const location = response.headers.get("location") ?? "";
		expect(location).toContain("error=pkce_verifier_missing");
	}, 30_000);

	it("X webhook returns 200 ignored when ENABLE_X_INGEST is false", async () => {
		env.ENABLE_X_INGEST = "false";
		const response = await rawRequest(env, "/api/webhooks/x", {
			method: "POST",
			body: JSON.stringify({ events: [] }),
			headers: { "content-type": "application/json" },
		});
		expect(response.status).toBe(200);
		const body = (await response.json()) as ApiSuccess<{ ignored: string }>;
		expect(body.data.ignored).toBe("feature_disabled");
	}, 30_000);

	it("X webhook returns 200 unsupported_tier even when flag on (X has no webhooks at Free/Basic)", async () => {
		env.ENABLE_X_INGEST = "true";
		const response = await rawRequest(env, "/api/webhooks/x", {
			method: "POST",
			body: JSON.stringify({ events: [{ id: "x" }] }),
			headers: { "content-type": "application/json" },
		});
		expect(response.status).toBe(200);
		const body = (await response.json()) as ApiSuccess<{ ignored: string; platform: string }>;
		expect(body.data.ignored).toBe("unsupported_tier");
		expect(body.data.platform).toBe("x");
	}, 30_000);

	it("Connections list includes X account after a successful callback", async () => {
		env.ENABLE_X_PUBLISH = "true";
		const { client, brandId } = await seedUserAndBrand("x-list@example.com");
		const dbExposed = env.DB as {
			prepare(sql: string): { bind(...v: unknown[]): { run(): Promise<unknown> } };
		};
		await dbExposed
			.prepare(
				`INSERT INTO social_account_tokens (id, brand_id, platform, external_account_id, account_label, scope_csv, token_kv_key, access_token_expires_at, status)
				VALUES ('sat_x_list', ?, 'x', '999', 'Founder', 'tweet.read,tweet.write', 'social_token:x_list', datetime('now', '+2 hour'), 'active')`,
			)
			.bind(brandId)
			.run();
		const list = await client.get<{ accounts: Array<{ platform: string }> }>(
			`/api/brands/${brandId}/social-accounts`,
		);
		expect(list.status).toBe(200);
		if (list.body.success) {
			const platforms = list.body.data.accounts.map((a) => a.platform);
			expect(platforms).toContain("x");
		}
	}, 30_000);
});

async function createApiApp(): Promise<Hono> {
	const modules = {
		error: "../../src/server/middleware/error",
		requestLogging: "../../src/server/middleware/request-logging",
		securityHeaders: "../../src/server/middleware/security-headers",
		csrf: "../../src/server/middleware/csrf",
		admin: "../../src/server/routes/admin",
		auth: "../../src/server/routes/auth",
		billing: "../../src/server/routes/billing",
		brands: "../../src/server/routes/brands",
		health: "../../src/server/routes/health",
		mcp: "../../src/server/routes/mcp",
		oauth: "../../src/server/routes/oauth",
		webhooks: "../../src/server/routes/webhooks",
		workspaces: "../../src/server/routes/workspaces",
	};
	const [
		{ handleError, handleNotFound },
		{ requestLogging },
		{ securityHeaders },
		{ csrfProtection },
		{ adminRoutes },
		{ authRoutes },
		{ billingRoutes },
		{ brandRoutes },
		{ healthRoutes },
		{ mcpRoutes },
		{ oauthRoutes },
		{ webhookRoutes },
		{ workspaceRoutes },
	] = await Promise.all([
		import(modules.error),
		import(modules.requestLogging),
		import(modules.securityHeaders),
		import(modules.csrf),
		import(modules.admin),
		import(modules.auth),
		import(modules.billing),
		import(modules.brands),
		import(modules.health),
		import(modules.mcp),
		import(modules.oauth),
		import(modules.webhooks),
		import(modules.workspaces),
	]);
	const app = new Hono();
	const api = new Hono();
	app.use("*", requestLogging());
	app.use("*", securityHeaders());
	app.use("*", csrfProtection());
	app.onError(handleError);
	api.route("/", healthRoutes);
	api.route("/auth", authRoutes);
	api.route("/billing", billingRoutes);
	api.route("/workspaces", workspaceRoutes);
	api.route("/brands", brandRoutes);
	api.route("/admin", adminRoutes);
	api.route("/mcp", mcpRoutes);
	api.route("/webhooks", webhookRoutes);
	api.route("/oauth", oauthRoutes);
	api.notFound(handleNotFound);
	app.route("/api", api);
	return app;
}

async function createEnv(): Promise<{ mf: Miniflare; env: TestEnv }> {
	const mf = new Miniflare({
		modules: true,
		script: "export default { fetch() { return new Response('ok'); } }",
		d1Databases: { DB: "mustbeviral-test" },
		kvNamespaces: ["CACHE"],
		r2Buckets: ["MEDIA_BUCKET"],
		compatibilityDate: "2026-05-08",
		compatibilityFlags: ["nodejs_compat"],
	} as ConstructorParameters<typeof Miniflare>[0]);
	const db = await mf.getD1Database("DB");
	await applyMigration(db, "0001_initial.sql");
	await applyMigration(db, "0002_indexes_and_phase2.sql");
	await applyMigration(db, "0003_platform_integration.sql");

	return {
		mf,
		env: {
			DB: db,
			CACHE: await mf.getKVNamespace("CACHE"),
			MEDIA_BUCKET: await mf.getR2Bucket("MEDIA_BUCKET"),
			APP_ENV: "development",
			PUBLIC_APP_URL: "http://127.0.0.1:8787",
			DEFAULT_SCHEDULER_PROVIDER: "manual",
			DEFAULT_TEXT_MODEL: "mock",
			DEFAULT_IMAGE_MODEL: "mock-image",
			PREMIUM_IMAGE_MODEL: "mock-premium-image",
			FAST_IMAGE_MODEL: "mock-fast-image",
			USE_MOCK_AI: "true",
			USE_BROWSER_RUN: "false",
			STRIPE_SECRET_KEY: "",
			STRIPE_WEBHOOK_SECRET: "whsec_test",
			X_CLIENT_ID: "test_x_client_id",
			X_CLIENT_SECRET: "test_x_client_secret",
			X_REDIRECT_URI: "http://127.0.0.1:8787/api/oauth/x/callback",
			TOKEN_ENCRYPTION_KEY: "dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcy1leGFtcGxlPQ==",
			ENABLE_LINKEDIN_PUBLISH: "false",
			ENABLE_LINKEDIN_INGEST: "false",
			ENABLE_X_PUBLISH: "false",
			ENABLE_X_INGEST: "false",
			ENABLE_META_PUBLISH: "false",
			ENABLE_META_INGEST: "false",
			ENABLE_TIKTOK_PUBLISH: "false",
			ENABLE_TIKTOK_INGEST: "false",
		},
	};
}

class ApiClient {
	private cookie = "";
	constructor(private readonly bindings: TestEnv) {}
	getCookie(): string {
		return this.cookie;
	}
	get<T>(path: string) {
		return this.request<T>("GET", path);
	}
	post<T>(path: string, body: unknown) {
		return this.request<T>("POST", path, body);
	}
	private async request<T>(
		method: "GET" | "POST" | "DELETE",
		path: string,
		body?: unknown,
	): Promise<{ status: number; body: ApiResponse<T> }> {
		const headers = new Headers({
			...(method === "GET" ? {} : { Origin: "http://test.local" }),
			...(body === undefined ? {} : { "Content-Type": "application/json" }),
			...(this.cookie ? { Cookie: this.cookie } : {}),
		});
		const response = await (testApp as { request: Hono["request"] }).request(
			"http://test.local" + path,
			{
				method,
				headers,
				...(body === undefined ? {} : { body: JSON.stringify(body) }),
			},
			this.bindings,
		);
		const setCookie = response.headers.get("set-cookie");
		if (setCookie) {
			const pair = setCookie.split(";")[0] ?? "";
			if (pair && !pair.endsWith("=")) {
				this.cookie = pair;
			}
		}
		return { status: response.status, body: (await response.json()) as ApiResponse<T> };
	}
}

async function seedUserAndBrand(email: string): Promise<{ client: ApiClient; brandId: string }> {
	const client = new ApiClient(env);
	await client.post("/api/auth/signup", { email, password, name: email });
	const ws = await client.post<{ workspace: { id: string } }>("/api/workspaces", { name: email + " ws" });
	if (!ws.body.success) throw new Error("workspace create failed");
	const workspaceId = ws.body.data.workspace.id;
	const brand = await client.post<{ brand: { id: string } }>(
		"/api/workspaces/" + workspaceId + "/brands",
		{
			name: "Test Brand",
			websiteUrl: "https://example.com/" + encodeURIComponent(email),
			startOnboarding: false,
		},
	);
	if (!brand.body.success) throw new Error("brand create failed: " + JSON.stringify(brand.body.error));
	return { client, brandId: brand.body.data.brand.id };
}

async function rawRequest(
	bindings: TestEnv,
	path: string,
	input: {
		method: string;
		body?: string;
		headers?: Record<string, string>;
		cookie?: string;
	},
): Promise<Response> {
	const headers: Record<string, string> = { ...(input.headers ?? {}) };
	if (input.cookie) headers.Cookie = input.cookie;
	return (testApp as { request: Hono["request"] }).request(
		"http://test.local" + path,
		{
			method: input.method,
			headers,
			...(input.body !== undefined ? { body: input.body } : {}),
		},
		bindings,
	);
}

async function applyMigration(
	db: Awaited<ReturnType<Miniflare["getD1Database"]>>,
	fileName: string,
): Promise<void> {
	const sql = readFileSync(join(process.cwd(), "src/server/db/migrations", fileName), "utf8");
	const statements = sql
		.split(/\r?\n/)
		.filter((line) => !line.trimStart().startsWith("--"))
		.join("\n")
		.split(";")
		.map((statement) => statement.trim())
		.filter((statement) => statement && !statement.startsWith("PRAGMA "));
	for (const statement of statements) {
		await db.prepare(statement).run();
	}
}
