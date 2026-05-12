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
	LINKEDIN_CLIENT_ID: string;
	LINKEDIN_CLIENT_SECRET: string;
	LINKEDIN_REDIRECT_URI: string;
	LINKEDIN_WEBHOOK_SECRET: string;
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

describe("Phase B LinkedIn integration", () => {
	it("blocks OAuth start with 503 FEATURE_DISABLED when ENABLE_LINKEDIN_PUBLISH is false", async () => {
		env.ENABLE_LINKEDIN_PUBLISH = "false";
		const { client, brandId } = await seedUserAndBrand("linkedin-flag-off@example.com");
		const response = await client.get(`/api/brands/${brandId}/oauth/linkedin/start`);
		expect(response.status).toBe(503);
		expect(response.body.success).toBe(false);
		if (!response.body.success) {
			expect(response.body.error.code).toBe("FEATURE_DISABLED");
		}
	}, 30_000);

	it("returns 302 to LinkedIn authorize URL when flag is on + credentials present", async () => {
		env.ENABLE_LINKEDIN_PUBLISH = "true";
		const { client, brandId } = await seedUserAndBrand("linkedin-flag-on@example.com");
		const response = await rawRequest(env, "/api/brands/" + brandId + "/oauth/linkedin/start", {
			method: "GET",
			cookie: client.getCookie(),
		});
		expect(response.status).toBe(302);
		const location = response.headers.get("location");
		expect(location).not.toBeNull();
		expect(location!).toContain("https://www.linkedin.com/oauth/v2/authorization");
		expect(location!).toContain("client_id=test_client_id");
		expect(location!).toContain("response_type=code");
		// State param present (signed payload, base64url-encoded).
		const url = new URL(location!);
		const state = url.searchParams.get("state");
		expect(state).not.toBeNull();
		expect(state!.length).toBeGreaterThan(20);
	}, 30_000);

	it("rejects OAuth callback with invalid state (tampered)", async () => {
		env.ENABLE_LINKEDIN_PUBLISH = "true";
		const response = await rawRequest(env, "/api/oauth/linkedin/callback?code=mock_code&state=tampered_garbage", {
			method: "GET",
		});
		expect(response.status).toBe(400);
		const body = (await response.json()) as ApiResponse<unknown>;
		expect(body.success).toBe(false);
		if (!body.success) {
			expect(["OAUTH_STATE_INVALID", "OAUTH_CALLBACK_INVALID"]).toContain(body.error.code);
		}
	}, 30_000);

	it("OAuth callback exchanges code, encrypts token, inserts D1 rows on happy path", async () => {
		env.ENABLE_LINKEDIN_PUBLISH = "true";
		const { brandId } = await seedUserAndBrand("linkedin-callback@example.com");

		const state = await signTestState(env, { brandId, platform: "linkedin" });

		const fetchSpy = vi.fn((input: RequestInfo | URL): Promise<Response> => {
			const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
			if (url.startsWith("https://www.linkedin.com/oauth/v2/accessToken")) {
				return Promise.resolve(
					new Response(
						JSON.stringify({
							access_token: "AQXmocked",
							refresh_token: "AQXrefresh",
							expires_in: 3600,
							refresh_token_expires_in: 60 * 86400,
							scope: "openid profile w_member_social",
							token_type: "Bearer",
						}),
						{ status: 200, headers: { "content-type": "application/json" } },
					),
				);
			}
			if (url.startsWith("https://api.linkedin.com/v2/userinfo")) {
				return Promise.resolve(
					new Response(
						JSON.stringify({
							sub: "linkedin_user_abc",
							name: "Test User",
							email: "test@example.com",
						}),
						{ status: 200, headers: { "content-type": "application/json" } },
					),
				);
			}
			if (url.startsWith("https://api.linkedin.com/rest/organizationAcls")) {
				return Promise.resolve(
					new Response(
						JSON.stringify({
							elements: [
								{
									"organization~": {
										id: "12345",
										localizedName: "Test Org",
									},
								},
							],
						}),
						{ status: 200, headers: { "content-type": "application/json" } },
					),
				);
			}
			return Promise.reject(new Error("unexpected fetch in callback test: " + url));
		});
		vi.stubGlobal("fetch", fetchSpy);

		const response = await rawRequest(env, `/api/oauth/linkedin/callback?code=mock_code&state=${encodeURIComponent(state)}`, {
			method: "GET",
		});
		expect(response.status).toBe(302);
		const location = response.headers.get("location");
		expect(location).toContain(`/app/brands/${brandId}/connections`);
		expect(location).toContain("connected=linkedin");

		// social_account_tokens row should exist
		const dbExposed = env.DB as { prepare(sql: string): { bind(...v: unknown[]): { first<T>(): Promise<T | null> } } };
		const tokenRow = await dbExposed
			.prepare("SELECT id, brand_id, platform, external_account_id, status, scope_csv FROM social_account_tokens WHERE brand_id = ?")
			.bind(brandId)
			.first<{ brand_id: string; platform: string; external_account_id: string; status: string; scope_csv: string }>();
		expect(tokenRow).not.toBeNull();
		expect(tokenRow?.brand_id).toBe(brandId);
		expect(tokenRow?.platform).toBe("linkedin");
		expect(tokenRow?.external_account_id).toBe("linkedin_user_abc");
		expect(tokenRow?.status).toBe("active");
		expect(tokenRow?.scope_csv).toContain("w_member_social");

		// brand_social_profiles row
		const profileRow = await dbExposed
			.prepare("SELECT brand_id, platform, handle, connected_status FROM brand_social_profiles WHERE brand_id = ? AND platform = 'linkedin'")
			.bind(brandId)
			.first<{ handle: string; connected_status: string }>();
		expect(profileRow?.connected_status).toBe("connected");
		expect(profileRow?.handle).toBe("linkedin_user_abc");

		// audit_logs row
		const auditRow = await dbExposed
			.prepare("SELECT action, entity_type FROM audit_logs WHERE brand_id = ? AND action = 'platform.linkedin.connected'")
			.bind(brandId)
			.first<{ action: string; entity_type: string }>();
		expect(auditRow?.action).toBe("platform.linkedin.connected");
		expect(auditRow?.entity_type).toBe("social_account_token");
	}, 30_000);

	it("LinkedIn webhook returns 200 ignored when ENABLE_LINKEDIN_INGEST is false (silent drop)", async () => {
		env.ENABLE_LINKEDIN_INGEST = "false";
		env.ENABLE_LINKEDIN_PUBLISH = "false";
		const response = await rawRequest(env, "/api/webhooks/linkedin", {
			method: "POST",
			body: JSON.stringify({ events: [{ eventUrn: "urn:li:event:1" }] }),
			headers: { "content-type": "application/json" },
		});
		expect(response.status).toBe(200);
		const body = (await response.json()) as ApiSuccess<{ ignored: string }>;
		expect(body.success).toBe(true);
		expect(body.data.ignored).toBe("feature_disabled");
	}, 30_000);

	it("LinkedIn webhook rejects bad signature with 400 when flag is on", async () => {
		env.ENABLE_LINKEDIN_INGEST = "true";
		const response = await rawRequest(env, "/api/webhooks/linkedin", {
			method: "POST",
			body: JSON.stringify({ events: [{ eventUrn: "urn:li:event:1" }] }),
			headers: {
				"content-type": "application/json",
				"x-linkedin-signature": "deadbeef",
			},
		});
		expect(response.status).toBe(400);
		const body = (await response.json()) as ApiResponse<unknown>;
		expect(body.success).toBe(false);
		if (!body.success) {
			expect(body.error.code).toBe("INVALID_LINKEDIN_SIGNATURE");
		}
	}, 30_000);

	it("LinkedIn webhook accepts valid signature, ingests events into platform_comments + dm_events", async () => {
		env.ENABLE_LINKEDIN_INGEST = "true";
		env.ENABLE_LINKEDIN_PUBLISH = "true";
		const { brandId } = await seedUserAndBrand("linkedin-webhook@example.com");

		// Seed an active social_account_tokens row so the persistPlatformIngest
		// helper can resolve a brand for the event (no published_posts).
		const dbExposed = env.DB as { prepare(sql: string): { bind(...v: unknown[]): { run(): Promise<unknown> } } };
		await dbExposed
			.prepare(
				`INSERT INTO social_account_tokens (id, brand_id, platform, external_account_id, account_label, scope_csv, token_kv_key, access_token_expires_at, status)
				VALUES (?, ?, 'linkedin', 'lin_user_1', 'Test Account', 'w_member_social', 'social_token:test', datetime('now', '+1 hour'), 'active')`,
			)
			.bind("sat_test_webhook", brandId)
			.run();

		const payload = {
			events: [
				{
					eventUrn: "urn:li:comment:(activity:7,1)",
					actor: "urn:li:person:lin_user_1",
					object: "urn:li:share:9876",
					message: { text: "Great post!" },
				},
			],
		};
		const body = JSON.stringify(payload);
		const sig = await computeHmacHex(env.LINKEDIN_WEBHOOK_SECRET, body);

		const response = await rawRequest(env, "/api/webhooks/linkedin", {
			method: "POST",
			body,
			headers: {
				"content-type": "application/json",
				"x-linkedin-signature": sig,
			},
		});
		expect(response.status).toBe(200);
		const respBody = (await response.json()) as ApiSuccess<{ received: boolean; eventsIngested: number }>;
		expect(respBody.data.received).toBe(true);
		expect(respBody.data.eventsIngested).toBe(1);

		// platform_comments row
		const commentRow = await (env.DB as { prepare(sql: string): { bind(...v: unknown[]): { first<T>(): Promise<T | null> } } })
			.prepare("SELECT brand_id, platform, external_comment_id, body FROM platform_comments WHERE external_comment_id = 'urn:li:comment:(activity:7,1)'")
			.bind()
			.first<{ brand_id: string; platform: string; external_comment_id: string; body: string }>();
		expect(commentRow).not.toBeNull();
		expect(commentRow?.brand_id).toBe(brandId);
		expect(commentRow?.body).toBe("Great post!");

		// dm_events row with status received
		const dmRow = await (env.DB as { prepare(sql: string): { bind(...v: unknown[]): { first<T>(): Promise<T | null> } } })
			.prepare("SELECT brand_id, platform, status FROM dm_events WHERE brand_id = ? AND platform = 'linkedin'")
			.bind(brandId)
			.first<{ brand_id: string; platform: string; status: string }>();
		expect(dmRow?.status).toBe("received");
	}, 30_000);

	it("LinkedIn webhook is replay-idempotent", async () => {
		env.ENABLE_LINKEDIN_INGEST = "true";
		await seedUserAndBrand("linkedin-replay@example.com");
		const payload = {
			events: [{ eventUrn: "urn:li:comment:(activity:replay,1)", message: { text: "Hi" } }],
		};
		const body = JSON.stringify(payload);
		const sig = await computeHmacHex(env.LINKEDIN_WEBHOOK_SECRET, body);
		const first = await rawRequest(env, "/api/webhooks/linkedin", {
			method: "POST",
			body,
			headers: { "content-type": "application/json", "x-linkedin-signature": sig },
		});
		expect(first.status).toBe(200);
		const second = await rawRequest(env, "/api/webhooks/linkedin", {
			method: "POST",
			body,
			headers: { "content-type": "application/json", "x-linkedin-signature": sig },
		});
		expect(second.status).toBe(200);
		const secondBody = (await second.json()) as ApiSuccess<{ replay: boolean }>;
		expect(secondBody.data.replay).toBe(true);
	}, 30_000);

	it("GET /api/brands/:brandId/social-accounts returns the list (empty before connect)", async () => {
		const { client, brandId } = await seedUserAndBrand("linkedin-list@example.com");
		const response = await client.get<{ accounts: Array<{ id: string }> }>(
			`/api/brands/${brandId}/social-accounts`,
		);
		expect(response.status).toBe(200);
		if (response.body.success) {
			expect(Array.isArray(response.body.data.accounts)).toBe(true);
			expect(response.body.data.accounts).toHaveLength(0);
		}
	}, 30_000);

	it("DELETE /api/brands/:brandId/social-accounts/:accountId revokes (flips status, audits, KV best-effort)", async () => {
		const { client, brandId } = await seedUserAndBrand("linkedin-revoke@example.com");
		const dbExposed = env.DB as { prepare(sql: string): { bind(...v: unknown[]): { run(): Promise<unknown> } } };
		await dbExposed
			.prepare(
				`INSERT INTO social_account_tokens (id, brand_id, platform, external_account_id, account_label, scope_csv, token_kv_key, access_token_expires_at, status)
				VALUES ('sat_revoke', ?, 'linkedin', 'lin_user_revoke', 'Revoke Test', 'w_member_social', 'social_token:revoke', datetime('now', '+1 hour'), 'active')`,
			)
			.bind(brandId)
			.run();
		const response = await client.delete(`/api/brands/${brandId}/social-accounts/sat_revoke`);
		expect(response.status).toBe(200);
		const after = await (env.DB as { prepare(sql: string): { bind(...v: unknown[]): { first<T>(): Promise<T | null> } } })
			.prepare("SELECT status FROM social_account_tokens WHERE id = 'sat_revoke'")
			.bind()
			.first<{ status: string }>();
		expect(after?.status).toBe("revoked");
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
			LINKEDIN_CLIENT_ID: "test_client_id",
			LINKEDIN_CLIENT_SECRET: "test_client_secret",
			LINKEDIN_REDIRECT_URI: "http://127.0.0.1:8787/api/oauth/linkedin/callback",
			LINKEDIN_WEBHOOK_SECRET: "test_webhook_secret",
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

	delete<T>(path: string) {
		return this.request<T>("DELETE", path);
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

async function seedUserAndBrand(email: string): Promise<{ client: ApiClient; brandId: string; workspaceId: string }> {
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
	return { client, brandId: brand.body.data.brand.id, workspaceId };
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
	const headers: Record<string, string> = {
		...(input.headers ?? {}),
	};
	if (input.cookie) {
		headers.Cookie = input.cookie;
	}
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

async function signTestState(
	env: TestEnv,
	payload: { brandId: string; platform: string },
): Promise<string> {
	const { signState } = await import("../../src/server/services/platforms/oauth-state");
	return signState(env, {
		brandId: payload.brandId,
		platform: payload.platform as "linkedin",
	});
}

async function computeHmacHex(secret: string, body: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
	return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function applyMigration(db: Awaited<ReturnType<Miniflare["getD1Database"]>>, fileName: string): Promise<void> {
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
